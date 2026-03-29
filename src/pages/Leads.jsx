import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STAGE_STYLES = {
  new:          { bg: "#f1f5f9", color: "#475569" },
  contacted:    { bg: "#dbeafe", color: "#1d4ed8" },
  warm:         { bg: "#fef3c7", color: "#b45309" },
  hot:          { bg: "#fee2e2", color: "#b91c1c" },
  closed:       { bg: "#dcfce7", color: "#15803d" },
  unsubscribed: { bg: "#f1f5f9", color: "#94a3b8" },
};

const INTENT_STYLES = {
  cold: { color: "#94a3b8" },
  warm: { color: "#d97706" },
  hot:  { color: "#dc2626" },
};

function initials(first, last) {
  return `${(first || "?")[0]}${(last || "")[0] || ""}`.toUpperCase();
}

function avatarColor(name) {
  const colors = ["#1e3a5f", "#1e4d3b", "#3b1f5e", "#5e1f1f", "#1a3d5e"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

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
    if (error) console.error("Error fetching leads:", error);
    else setLeads(data || []);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search name, phone, vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
            style={{ borderColor: "#e2e8f0", backgroundColor: "white" }}
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none"
          style={{ borderColor: "#e2e8f0", color: "#374151" }}
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
        <div className="py-16 text-center text-sm" style={{ color: "#94a3b8" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: "#94a3b8" }}>No leads found.</div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                {["Name", "Phone", "Vehicle", "Source", "Stage", "Intent", "Created"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => {
                const name = `${lead.first_name} ${lead.last_name}`;
                const stageStyle = STAGE_STYLES[lead.stage] || STAGE_STYLES.new;
                const intentStyle = INTENT_STYLES[lead.intent_score];
                return (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="cursor-pointer transition-colors"
                    style={{ borderTop: i > 0 ? "1px solid #f8fafc" : "none" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                          style={{ backgroundColor: avatarColor(name) }}
                        >
                          {initials(lead.first_name, lead.last_name)}
                        </div>
                        <span className="font-medium" style={{ color: "#0f172a" }}>{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>{lead.phone}</td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>
                      {lead.vehicle_interest || <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: "#64748b" }}>{lead.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                        style={{ backgroundColor: stageStyle.bg, color: stageStyle.color }}
                      >
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {intentStyle ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: intentStyle.color }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: intentStyle.color }} />
                          {lead.intent_score}
                        </span>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>
                      {new Date(lead.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
