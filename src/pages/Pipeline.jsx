import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STAGES = [
  { key: "new", label: "New", color: "border-t-gray-400" },
  { key: "contacted", label: "Contacted", color: "border-t-blue-400" },
  { key: "warm", label: "Warm", color: "border-t-yellow-400" },
  { key: "hot", label: "Hot", color: "border-t-red-500" },
  { key: "closed", label: "Closed", color: "border-t-green-500" },
];

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone, vehicle_interest, stage, intent_score, created_at")
        .not("stage", "eq", "unsubscribed")
        .order("created_at", { ascending: false });
      setLeads(data || []);
      setLoading(false);
    }
    fetchLeads();
  }, []);

  async function moveStage(leadId, newStage) {
    await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    );
  }

  const byStage = (stage) => leads.filter((l) => l.stage === stage);

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Pipeline</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(({ key, label, color }) => {
          const stageLeads = byStage(key);
          return (
            <div key={key} className="w-64 shrink-0">
              <div className={`bg-white rounded-lg border border-gray-200 border-t-4 ${color} overflow-hidden`}>
                <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                    {stageLeads.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 min-h-24">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      stages={STAGES}
                      onOpen={() => navigate(`/leads/${lead.id}`)}
                      onMove={moveStage}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadCard({ lead, stages, onOpen, onMove }) {
  const INTENT_DOT = {
    cold: "bg-gray-300",
    warm: "bg-yellow-400",
    hot: "bg-red-500",
  };

  return (
    <div className="bg-gray-50 rounded-md p-3 border border-gray-200 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onOpen}
          className="text-sm font-medium text-gray-900 text-left hover:text-blue-600"
        >
          {lead.first_name} {lead.last_name}
        </button>
        {lead.intent_score && (
          <span
            title={lead.intent_score}
            className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${INTENT_DOT[lead.intent_score] || "bg-gray-300"}`}
          />
        )}
      </div>
      {lead.vehicle_interest && (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{lead.vehicle_interest}</p>
      )}
      <div className="mt-2">
        <select
          value={lead.stage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMove(lead.id, e.target.value)}
          className="text-xs text-gray-500 bg-transparent border-none cursor-pointer focus:outline-none w-full"
        >
          {stages.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
