import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STAGES = [
  { key: "new",       label: "New",       accent: "#94a3b8" },
  { key: "contacted", label: "Contacted", accent: "#3b82f6" },
  { key: "warm",      label: "Warm",      accent: "#f59e0b" },
  { key: "hot",       label: "Hot",       accent: "#ef4444" },
  { key: "closed",    label: "Closed",    accent: "#22c55e" },
];

const INTENT_DOT = {
  cold: "#cbd5e1",
  warm: "#f59e0b",
  hot:  "#ef4444",
};

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
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
  }

  const byStage = (stage) => leads.filter((l) => l.stage === stage);

  if (loading) return <div className="p-6 text-sm" style={{ color: "#94a3b8" }}>Loading...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Pipeline</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>{leads.length} active lead{leads.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(({ key, label, accent }) => {
          const stageLeads = byStage(key);
          return (
            <div key={key} className="shrink-0" style={{ width: "240px" }}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
                  <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>{label}</span>
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}
                >
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-16">
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
          );
        })}
      </div>
    </div>
  );
}

function LeadCard({ lead, stages, onOpen, onMove }) {
  return (
    <div
      className="bg-white rounded-xl p-3 transition-all cursor-pointer"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={onOpen}
          className="text-sm font-semibold text-left hover:underline"
          style={{ color: "#0f172a" }}
        >
          {lead.first_name} {lead.last_name}
        </button>
        {lead.intent_score && (
          <span
            title={lead.intent_score}
            className="w-2 h-2 rounded-full shrink-0 mt-1"
            style={{ backgroundColor: INTENT_DOT[lead.intent_score] || "#cbd5e1" }}
          />
        )}
      </div>

      {lead.vehicle_interest && (
        <p className="text-xs truncate mb-2" style={{ color: "#64748b" }}>
          {lead.vehicle_interest}
        </p>
      )}

      <select
        value={lead.stage}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onMove(lead.id, e.target.value)}
        className="w-full text-xs rounded-lg px-2 py-1.5 border focus:outline-none"
        style={{ borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#f8fafc" }}
      >
        {stages.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
