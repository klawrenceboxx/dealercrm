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

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  const total = leads.length;
  const hot = leads.filter((l) => l.stage === "hot").length;
  const closed = leads.filter((l) => l.stage === "closed").length;
  const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  const byStage = countBy(leads, "stage");
  const bySource = countBy(leads, "source");
  const byIntent = countBy(leads, "intent_score");

  // Leads per day (last 14 days)
  const now = new Date();
  const dailyCounts = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const count = leads.filter((l) => {
      const ld = new Date(l.created_at);
      return ld.toDateString() === d.toDateString();
    }).length;
    dailyCounts.push({ label, count });
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads" value={total} />
        <StatCard label="Hot Leads" value={hot} accent="red" />
        <StatCard label="Closed" value={closed} accent="green" />
        <StatCard label="Conversion" value={`${conversionRate}%`} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* By Stage */}
        <BreakdownCard title="By Stage" data={byStage} />
        {/* By Source */}
        <BreakdownCard title="By Source" data={bySource} />
      </div>

      {/* By Intent */}
      <BreakdownCard title="By Intent Score" data={byIntent} />

      {/* Daily leads (last 14 days) */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Leads — last 14 days</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-end gap-1 h-24">
            {dailyCounts.map(({ label, count }) => {
              const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1);
              const height = Math.round((count / maxCount) * 100);
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: count > 0 ? "4px" : "0" }}
                  />
                  <span className="text-xs text-gray-400 rotate-45 origin-left whitespace-nowrap" style={{ fontSize: "9px" }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const valueClass =
    accent === "red"
      ? "text-red-600"
      : accent === "green"
      ? "text-green-600"
      : "text-gray-900";

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function BreakdownCard({ title, data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {total === 0 ? (
        <p className="text-xs text-gray-400">No data</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(data).map(([key, count]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 capitalize w-24 truncate">{key || "unknown"}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full"
                  style={{ width: `${Math.round((count / total) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
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
