import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabase";

const WINDOW_DAYS = 30;

export default function Dashboard() {
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [repKpis, setRepKpis] = useState([]);
  const [salesLeads, setSalesLeads] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      setError("");

      const [dailyRes, kpiRes, salesRes, profilesRes] = await Promise.all([
        supabase.rpc("rep_daily_metrics", { p_days: WINDOW_DAYS }),
        supabase.rpc("rep_kpi_metrics", { p_days: WINDOW_DAYS }),
        supabase
          .from("leads")
          .select("id, stage, assigned_to, sold_price, cost_of_car, recon_cost"),
        supabase
          .from("profiles")
          .select("id, name, full_name"),
      ]);

      setDailyMetrics(dailyRes.error ? [] : (dailyRes.data || []));
      setRepKpis(kpiRes.error ? [] : (kpiRes.data || []).filter((row) => row.rep_id));
      setSalesLeads(salesRes.error ? [] : (salesRes.data || []));
      setProfiles(profilesRes.error ? [] : (profilesRes.data || []));
      setSelectedRepId((current) => (
        current === "all" || (kpiRes.data || []).some((row) => row.rep_id === current) ? current : "all"
      ));
      setError(
        dailyRes.error?.message
        || kpiRes.error?.message
        || salesRes.error?.message
        || profilesRes.error?.message
        || "",
      );
      setLoading(false);
    }

    fetchDashboard();
  }, []);

  if (loading) return <div className="p-6 text-sm" style={{ color: "#94a3b8" }}>Loading...</div>;

  const selectedSummary = selectedRepId === "all"
    ? aggregateSummary(repKpis)
    : repKpis.find((row) => row.rep_id === selectedRepId) || emptySummary();

  const chartData = selectedRepId === "all"
    ? aggregateDailyMetrics(dailyMetrics)
    : dailyMetrics
        .filter((row) => row.rep_id === selectedRepId)
        .map((row) => ({
          metric_date: row.metric_date,
          label: shortDate(row.metric_date),
          assigned: Number(row.leads_assigned || 0),
          responses: Number(row.responses || 0),
          deals: Number(row.deals_closed || 0),
        }));

  const leaderboard = [...repKpis].sort((a, b) => {
    if ((b.response_rate || 0) !== (a.response_rate || 0)) {
      return (b.response_rate || 0) - (a.response_rate || 0);
    }

    return (b.assigned_leads || 0) - (a.assigned_leads || 0);
  });

  const soldLeads = salesLeads.filter((lead) => lead.stage === "closed");
  const totalSoldRevenue = sumBy(soldLeads, (lead) => lead.sold_price);
  const totalCarCost = sumBy(soldLeads, (lead) => lead.cost_of_car);
  const totalRecon = sumBy(soldLeads, (lead) => lead.recon_cost);
  const totalProfit = soldLeads.reduce(
    (sum, lead) => sum + getProfit(lead.sold_price, lead.cost_of_car, lead.recon_cost),
    0,
  );
  const profileMap = Object.fromEntries(
    profiles.map((profile) => [profile.id, profile.full_name || profile.name || "Unknown rep"]),
  );
  const salesBreakdown = Object.values(
    soldLeads.reduce((acc, lead) => {
      const key = lead.assigned_to || "unassigned";

      if (!acc[key]) {
        acc[key] = {
          key,
          repName: lead.assigned_to ? profileMap[lead.assigned_to] || "Unknown rep" : "Unassigned",
          deals: 0,
          sold: 0,
          carCost: 0,
          recon: 0,
          profit: 0,
        };
      }

      acc[key].deals += 1;
      acc[key].sold += toNumber(lead.sold_price);
      acc[key].carCost += toNumber(lead.cost_of_car);
      acc[key].recon += toNumber(lead.recon_cost);
      acc[key].profit += getProfit(lead.sold_price, lead.cost_of_car, lead.recon_cost);
      return acc;
    }, {}),
  ).sort((a, b) => b.profit - a.profit);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            Rep performance over the last {WINDOW_DAYS} days
          </p>
        </div>

        <label className="text-sm font-medium flex flex-col gap-1.5" style={{ color: "#475569" }}>
          Rep view
          <select
            value={selectedRepId}
            onChange={(e) => setSelectedRepId(e.target.value)}
            className="min-w-52 rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none"
            style={{ borderColor: "#e2e8f0", color: "#0f172a" }}
          >
            <option value="all">All reps</option>
            {repKpis.map((row) => (
              <option key={row.rep_id} value={row.rep_id}>
                {row.rep_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#fecaca", color: "#b91c1c", backgroundColor: "#fef2f2" }}>
          {error}
        </div>
      )}

      <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Sold" value={formatCurrency(totalSoldRevenue)} accent="#2563eb" />
        <StatCard label="Total Profit" value={formatCurrency(totalProfit)} accent={totalProfit >= 0 ? "#16a34a" : "#dc2626"} />
        <StatCard label="Cost Of Car" value={formatCurrency(totalCarCost)} accent="#ea580c" />
        <StatCard label="Recon Costs" value={formatCurrency(totalRecon)} accent="#dc2626" />
      </div>

      <div className="bg-white rounded-xl p-5 mb-6 overflow-x-auto" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>Per-rep sales breakdown</h2>
          <p className="text-xs mt-1" style={{ color: "#64748b" }}>Closed deals with sold totals, car cost, recon, and profit.</p>
        </div>

        {salesBreakdown.length === 0 ? (
          <p className="text-sm" style={{ color: "#94a3b8" }}>No sold leads with financial data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {["Rep", "Deals", "Total Sold", "Car Cost", "Recon", "Profit"].map((heading) => (
                  <th key={heading} className="text-left py-3 text-xs font-semibold" style={{ color: "#64748b" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesBreakdown.map((row, index) => (
                <tr key={row.key} style={{ borderTop: index > 0 ? "1px solid #f8fafc" : "none" }}>
                  <td className="py-3 font-medium" style={{ color: "#0f172a" }}>{row.repName}</td>
                  <td className="py-3" style={{ color: "#475569" }}>{row.deals}</td>
                  <td className="py-3" style={{ color: "#475569" }}>{formatCurrency(row.sold)}</td>
                  <td className="py-3" style={{ color: "#475569" }}>{formatCurrency(row.carCost)}</td>
                  <td className="py-3" style={{ color: "#475569" }}>{formatCurrency(row.recon)}</td>
                  <td className="py-3 font-semibold" style={{ color: row.profit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {formatCurrency(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Leads Assigned" value={selectedSummary.assigned_leads} accent="#2563eb" />
        <StatCard label="Responses Logged" value={selectedSummary.responded_leads} accent="#0f766e" />
        <StatCard label="Deals Closed" value={selectedSummary.deals_closed} accent="#16a34a" />
        <StatCard label="Response Rate" value={`${selectedSummary.response_rate.toFixed(1)}%`} accent="#7c3aed" />
        <StatCard label="Avg Response Time" value={formatDuration(selectedSummary.avg_response_minutes)} accent="#ea580c" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_340px]">
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>
              {selectedRepId === "all" ? "Team trend" : `${selectedSummary.rep_name} trend`}
            </h2>
            <p className="text-xs mt-1" style={{ color: "#64748b" }}>
              Leads assigned, rep responses, and deals closed over time
            </p>
          </div>

          {chartData.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm" style={{ color: "#94a3b8", borderColor: "#cbd5e1" }}>
              No event data yet.
            </div>
          ) : (
            <div style={{ height: "340px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", borderColor: "#e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}
                    labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line type="monotone" dataKey="assigned" name="Assigned" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="responses" name="Responses" stroke="#0f766e" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="deals" name="Deals" stroke="#16a34a" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>Rep leaderboard</h2>
            <p className="text-xs mt-1" style={{ color: "#64748b" }}>Response rate and speed by rep</p>
          </div>

          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-sm" style={{ color: "#94a3b8" }}>No rep activity yet.</p>
            ) : (
              leaderboard.map((row) => {
                const selected = row.rep_id === selectedRepId;

                return (
                  <button
                    key={row.rep_id}
                    type="button"
                    onClick={() => setSelectedRepId(row.rep_id)}
                    className="w-full rounded-xl border p-4 text-left transition-colors"
                    style={{
                      borderColor: selected ? "#bfdbfe" : "#e2e8f0",
                      backgroundColor: selected ? "#eff6ff" : "white",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>{row.rep_name}</p>
                        <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                          {row.assigned_leads} assigned · {row.responded_leads} responded
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: "#2563eb" }}>{Number(row.response_rate || 0).toFixed(1)}%</p>
                        <p className="text-xs mt-1" style={{ color: "#64748b" }}>{formatDuration(row.avg_response_minutes)}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <p className="text-xs font-medium" style={{ color: "#64748b" }}>{label}</p>
      <p className="text-2xl font-semibold mt-2" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function aggregateSummary(rows) {
  const assigned = rows.reduce((sum, row) => sum + Number(row.assigned_leads || 0), 0);
  const responded = rows.reduce((sum, row) => sum + Number(row.responded_leads || 0), 0);
  const deals = rows.reduce((sum, row) => sum + Number(row.deals_closed || 0), 0);
  const weightedMinutes = rows.reduce(
    (sum, row) => sum + (Number(row.avg_response_minutes || 0) * Number(row.responded_leads || 0)),
    0,
  );

  return {
    rep_name: "All reps",
    assigned_leads: assigned,
    responded_leads: responded,
    deals_closed: deals,
    response_rate: assigned > 0 ? (responded / assigned) * 100 : 0,
    avg_response_minutes: responded > 0 ? weightedMinutes / responded : 0,
  };
}

function aggregateDailyMetrics(rows) {
  const byDate = rows.reduce((acc, row) => {
    const key = row.metric_date;

    if (!acc[key]) {
      acc[key] = {
        metric_date: row.metric_date,
        label: shortDate(row.metric_date),
        assigned: 0,
        responses: 0,
        deals: 0,
      };
    }

    acc[key].assigned += Number(row.leads_assigned || 0);
    acc[key].responses += Number(row.responses || 0);
    acc[key].deals += Number(row.deals_closed || 0);

    return acc;
  }, {});

  return Object.values(byDate).sort((a, b) => new Date(a.metric_date) - new Date(b.metric_date));
}

function shortDate(value) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(minutes) {
  const safeMinutes = Number(minutes || 0);

  if (!safeMinutes) return "No responses";
  if (safeMinutes < 60) return `${safeMinutes.toFixed(0)} min`;

  const hours = safeMinutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hr`;

  return `${(hours / 24).toFixed(1)} d`;
}

function emptySummary() {
  return {
    rep_name: "Unknown rep",
    assigned_leads: 0,
    responded_leads: 0,
    deals_closed: 0,
    response_rate: 0,
    avg_response_minutes: 0,
  };
}

function toNumber(value) {
  return Number(value) || 0;
}

function getProfit(soldPrice, carCost, reconCost) {
  return toNumber(soldPrice) - toNumber(carCost) - toNumber(reconCost);
}

function sumBy(items, getter) {
  return items.reduce((sum, item) => sum + toNumber(getter(item)), 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
