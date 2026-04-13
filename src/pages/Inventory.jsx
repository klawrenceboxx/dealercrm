import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const STATUS_STYLES = {
  available: { bg: "#dcfce7", color: "#15803d" },
  pending:   { bg: "#fef3c7", color: "#b45309" },
  sold:      { bg: "#f1f5f9", color: "#94a3b8" },
};

async function lookupVin(vin) {
  const clean = vin.trim().toUpperCase();
  if (clean.length !== 17) throw new Error("VIN must be 17 characters");
  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${clean}?format=json`
  );
  if (!res.ok) throw new Error("VIN lookup failed");
  const data = await res.json();
  const results = data.Results || [];
  const get = (label) =>
    (results.find((r) => r.Variable === label)?.Value || "").trim();
  const year = parseInt(get("Model Year"), 10) || null;
  const make = get("Make");
  const model = get("Model");
  const trim = get("Trim");
  if (!make || !model) throw new Error("VIN not found — check the number");
  return { vin: clean, year, make, model, trim };
}

const EMPTY_FORM = {
  vin: "", year: "", make: "", model: "", trim: "",
  color: "", mileage_km: "", price: "", stock_number: "",
  status: "available", notes: "",
};

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .order("updated_at", { ascending: false });
    setInventory(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchInventory);
  }, [fetchInventory]);

  async function handleVinLookup() {
    if (!form.vin) return;
    setVinLoading(true);
    setVinError("");
    try {
      const result = await lookupVin(form.vin);
      setForm((f) => ({ ...f, ...result }));
    } catch (e) {
      setVinError(e.message);
    }
    setVinLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    const payload = {
      vin: form.vin || null,
      year: form.year ? parseInt(form.year) : null,
      make: form.make || null,
      model: form.model || null,
      trim: form.trim || null,
      color: form.color || null,
      mileage_km: form.mileage_km ? parseInt(form.mileage_km) : 0,
      price: form.price ? parseFloat(form.price) : null,
      stock_number: form.stock_number || null,
      status: form.status,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("inventory").insert(payload);
    if (error) {
      setSaveError(error.message);
    } else {
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchInventory();
    }
    setSaving(false);
  }

  async function updateStatus(id, status) {
    await supabase.from("inventory").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setInventory((prev) => prev.map((v) => (v.id === id ? { ...v, status, available: status === "available" } : v)));
  }

  const filtered = statusFilter === "all"
    ? inventory
    : inventory.filter((v) => v.status === statusFilter);

  const available = inventory.filter((v) => v.status === "available").length;
  const pending = inventory.filter((v) => v.status === "pending").length;
  const sold = inventory.filter((v) => v.status === "sold").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Inventory</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            {available} available · {pending} pending · {sold} sold
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setVinError(""); setSaveError(""); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#2563eb" }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Vehicle
        </button>
      </div>

      {/* Add Vehicle Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-5 mb-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>Add Vehicle</h2>
            <button onClick={() => setShowForm(false)} style={{ color: "#94a3b8" }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* VIN lookup */}
          <div className="mb-5 p-4 rounded-lg" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#64748b" }}>VIN LOOKUP (optional — auto-fills year/make/model/trim)</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 1HGCM82633A004352"
                value={form.vin}
                onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value.toUpperCase() }))}
                maxLength={17}
                className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none font-mono tracking-wider"
                style={{ borderColor: "#e2e8f0", backgroundColor: "white" }}
              />
              <button
                type="button"
                onClick={handleVinLookup}
                disabled={vinLoading || form.vin.length !== 17}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "#0f172a" }}
              >
                {vinLoading ? "Looking up..." : "Look up VIN"}
              </button>
            </div>
            {vinError && <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{vinError}</p>}
            {form.make && (
              <p className="text-xs mt-2 font-medium" style={{ color: "#16a34a" }}>
                Found: {form.year} {form.make} {form.model} {form.trim}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <FormField label="Year" value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} placeholder="2024" type="number" />
              <FormField label="Make" value={form.make} onChange={(v) => setForm((f) => ({ ...f, make: v }))} placeholder="Toyota" required />
              <FormField label="Model" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} placeholder="Camry" required />
              <FormField label="Trim" value={form.trim} onChange={(v) => setForm((f) => ({ ...f, trim: v }))} placeholder="LE" />
              <FormField label="Color" value={form.color} onChange={(v) => setForm((f) => ({ ...f, color: v }))} placeholder="Silver" />
              <FormField label="Mileage (km)" value={form.mileage_km} onChange={(v) => setForm((f) => ({ ...f, mileage_km: v }))} placeholder="0" type="number" />
              <FormField label="Price ($)" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="29900" type="number" />
              <FormField label="Stock #" value={form.stock_number} onChange={(v) => setForm((f) => ({ ...f, stock_number: v }))} placeholder="A-1234" />
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#64748b" }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none bg-white"
                  style={{ borderColor: "#e2e8f0" }}
                >
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#64748b" }}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes about this vehicle..."
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none"
                style={{ borderColor: "#e2e8f0" }}
              />
            </div>

            {saveError && <p className="text-xs mb-3" style={{ color: "#dc2626" }}>{saveError}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: "#2563eb" }}
              >
                {saving ? "Saving..." : "Add to inventory"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: "#64748b", backgroundColor: "#f1f5f9" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {["all", "available", "pending", "sold"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors"
            style={{
              backgroundColor: statusFilter === s ? "#0f172a" : "#f1f5f9",
              color: statusFilter === s ? "white" : "#64748b",
            }}
          >
            {s === "all" ? `All (${inventory.length})` : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "#94a3b8" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: "#94a3b8" }}>No vehicles found.</div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                {["Vehicle", "VIN", "Color", "Mileage", "Price", "Stock #", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const statusStyle = STATUS_STYLES[v.status] || STATUS_STYLES.available;
                const vehicleName = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
                return (
                  <tr
                    key={v.id}
                    style={{ borderTop: i > 0 ? "1px solid #f8fafc" : "none" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "#0f172a" }}>
                      {vehicleName || <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#64748b" }}>
                      {v.vin || <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>{v.color || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>
                      {v.mileage_km != null ? `${v.mileage_km.toLocaleString()} km` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "#0f172a" }}>
                      {v.price != null ? `$${Number(v.price).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#64748b" }}>{v.stock_number || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={v.status}
                        onChange={(e) => updateStatus(v.id, e.target.value)}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer capitalize focus:outline-none"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        <option value="available">Available</option>
                        <option value="pending">Pending</option>
                        <option value="sold">Sold</option>
                      </select>
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

function FormField({ label, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#64748b" }}>
        {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
        style={{ borderColor: "#e2e8f0", backgroundColor: "white" }}
      />
    </div>
  );
}
