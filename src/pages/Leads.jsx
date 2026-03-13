import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STAGE_COLORS = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  warm: "bg-yellow-100 text-yellow-700",
  hot: "bg-red-100 text-red-700",
  closed: "bg-green-100 text-green-700",
  unsubscribed: "bg-gray-100 text-gray-400",
};

const INTENT_COLORS = {
  cold: "text-gray-400",
  warm: "text-yellow-600",
  hot: "text-red-600",
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }

  const filtered = leads.filter((l) => {
    const name = `${l.first_name} ${l.last_name}`.toLowerCase();
    const matchesSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      l.vehicle_interest?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "all" || l.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
        <span className="text-sm text-gray-500">{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name, phone, vehicle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All stages</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="warm">Warm</option>
          <option value="hot">Hot</option>
          <option value="closed">Closed</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No leads found.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Intent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.vehicle_interest || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{lead.source}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[lead.stage] || "bg-gray-100 text-gray-600"}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className={`px-4 py-3 capitalize font-medium ${INTENT_COLORS[lead.intent_score] || "text-gray-400"}`}>
                    {lead.intent_score || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
