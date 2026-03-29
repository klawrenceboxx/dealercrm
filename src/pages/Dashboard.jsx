import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase
        .from("leads")
        .select("stage, intent_score, source, created_at");
      setLeads(data || []);
      setLoading(false);
    }
    fetchLeads();
  }, []);

  if (loading) return <div className="p-6 text-sm" style={{ color: "#94a3b8" }}>Loading...</div>;

  const total = leads.length;
  const hot = leads.filter((l) => l.stage === "hot").length;
  const closed = leads.filter((l) => l.stage === "closed").length;
  const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  const byStage = countBy(leads, "stage");
  const bySource = countBy(leads, "source");
  const byIntent = countBy(leads, "intent_score");

  const now = new Date();
  const dailyCounts = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const count = leads.filter((l) => new Date(l.created_at).toDateString() === d.toDateString()).length;
    dailyCounts.push({ label, count });
  }
  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>Lead performance overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Leads"
          value={total}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          iconBg="#eff6ff"
          iconColor="#2563eb"
        />
        <StatCard
          label="Hot Leads"
          value={hot}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
          iconBg="#fff1f2"
          iconColor="#dc2626"
          valueColor="#dc2626"
        />
        <StatCard
          label="Closed"
          value={closed}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          iconBg="#f0fdf4"
          iconColor="#16a34a"
          valueColor="#16a34a"
        />
        <StatCard
          label="Conversion"
          value={`${conversionRate}%`}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
            </svg>
          }
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
        />
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <BreakdownCard title="By Stage" data={byStage} />
        <BreakdownCard title="By Source" data={bySource} />
        <BreakdownCard title="By Intent" data={byIntent} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#0f172a" }}>Leads — last 14 days</h3>
        <div className="flex items-end gap-1.5" style={{ height: "100px" }}>
          {dailyCounts.map(({ label, count }) => {
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={label} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: count > 0 ? `${pct}%` : "2px",
                    backgroundColor: count > 0 ? "#2563eb" : "#e2e8f0",
                    minHeight: "2px",
                  }}
                />
                <span style={{ fontSize: "9px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {label.split(" ")[1]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, iconBg, iconColor, valueColor }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: "#64748b" }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold" style={{ color: valueColor || "#0f172a" }}>{value}</p>
    </div>
  );
}

function BreakdownCard({ title, data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <div className="bg-white rounded-xl p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "#0f172a" }}>{title}</h3>
      {total === 0 ? (
        <p className="text-xs" style={{ color: "#94a3b8" }}>No data yet</p>
      ) : (
        <div className="space-y-2.5">
          {Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs capitalize truncate" style={{ color: "#475569", minWidth: "64px" }}>{key || "unknown"}</span>
                <div className="flex-1 rounded-full" style={{ backgroundColor: "#f1f5f9", height: "6px" }}>
                  <div
                    className="rounded-full"
                    style={{
                      width: `${Math.round((count / total) * 100)}%`,
                      height: "6px",
                      backgroundColor: "#2563eb",
                    }}
                  />
                </div>
                <span className="text-xs font-medium" style={{ color: "#64748b", minWidth: "16px", textAlign: "right" }}>{count}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] || "unknown";
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}
