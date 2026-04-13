import { useEffect, useState } from "react";
import { UserCheck, Phone, Shield, User, ToggleLeft, ToggleRight, Edit2, X, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../lib/ProfileContext";

function RoleBadge({ role }) {
  return role === "manager" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
      <Shield size={10} />
      Manager
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
      <User size={10} />
      Rep
    </span>
  );
}

function EditModal({ member, leadCount, onClose, onSave }) {
  const [form, setForm] = useState({
    name: member.name,
    phone: member.phone || "",
    role: member.role,
    active: member.active,
    rr_order: member.rr_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data } = await supabase
      .from("profiles")
      .update(form)
      .eq("id", member.id)
      .select()
      .single();
    if (data) onSave(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-900">Edit team member</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+15141234567"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="rep">Sales Rep</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Round robin order</label>
            <input
              type="number"
              min="0"
              value={form.rr_order}
              onChange={(e) => setForm({ ...form, rr_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Lower number = assigned first. Reps with same order rotate alphabetically.</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">Active</span>
            <div
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.active ? "bg-blue-600" : "bg-slate-200"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-xs text-slate-400">{form.active ? "Gets assigned leads" : "Excluded from rotation"}</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { profile: currentProfile } = useProfile();
  const [members, setMembers] = useState([]);
  const [leadCounts, setLeadCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const isManager = currentProfile?.role === "manager";

  useEffect(() => {
    async function fetchData() {
      const [profilesRes, leadsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("rr_order").order("name"),
        supabase.from("leads").select("assigned_to").not("assigned_to", "is", null),
      ]);
      setMembers(profilesRes.data || []);

      // Count leads per rep
      const counts = {};
      for (const lead of leadsRes.data || []) {
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      }
      setLeadCounts(counts);
      setLoading(false);
    }
    fetchData();
  }, []);

  function handleSaved(updated) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditing(null);
  }

  if (loading) return (
    <div className="p-6">
      <div className="h-7 w-24 bg-slate-100 rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );

  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Team</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {active.length} active member{active.length !== 1 ? "s" : ""} · round robin enabled
        </p>
      </div>

      {/* Round robin note */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-700">
        <strong>Round robin:</strong> New leads from n8n are auto-assigned to active reps in <code className="bg-blue-100 px-1 rounded">rr_order</code> sequence.
        Reps with lower numbers get assigned first. Update order below to change rotation.
      </div>

      {/* Active members */}
      <div className="space-y-2 mb-6">
        {active.map((member) => (
          <div
            key={member.id}
            className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 font-semibold text-sm">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{member.name}</span>
                  <RoleBadge role={member.role} />
                  {member.id === currentProfile?.id && (
                    <span className="text-xs text-slate-400">(you)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {member.phone && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone size={10} />
                      {member.phone}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {leadCounts[member.id] || 0} lead{(leadCounts[member.id] || 0) !== 1 ? "s" : ""} assigned
                  </span>
                  <span className="text-xs text-slate-300">order: {member.rr_order}</span>
                </div>
              </div>
            </div>
            {isManager && (
              <button
                onClick={() => setEditing(member)}
                className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Edit2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Inactive members */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Inactive</p>
          <div className="space-y-2">
            {inactive.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-slate-100 px-5 py-4 flex items-center justify-between gap-4 opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 font-semibold text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 text-sm">{member.name}</span>
                      <RoleBadge role={member.role} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Not in rotation</p>
                  </div>
                </div>
                {isManager && (
                  <button
                    onClick={() => setEditing(member)}
                    className="shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New rep instructions */}
      {isManager && (
        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-700 mb-2">Adding a new rep</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-500">
            <li>Create their account in <a href="https://supabase.com/dashboard/project/ntohjufkraavvvarqiyq/auth/users" target="_blank" rel="noreferrer" className="text-blue-600 underline">Supabase Auth</a></li>
            <li>They log in — a profile is created automatically as a rep</li>
            <li>Find them here and update their name, phone, and round robin order</li>
          </ol>
        </div>
      )}

      {editing && (
        <EditModal
          member={editing}
          leadCount={leadCounts[editing.id] || 0}
          onClose={() => setEditing(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
