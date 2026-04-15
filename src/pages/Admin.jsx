import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Edit2, FileText, Phone, Shield, Trash2, Upload, User, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { createSignedFileUrl, deleteCrmFile, formatFileSize, uploadCrmFile } from "../lib/crmFiles";
import {
  DEFAULT_SHIFT_TIMEZONE,
  formatMinutesAsTimeInput,
  formatShiftWindow,
  isRepWorking,
  parseTimeInputToMinutes,
  sortRoundRobinReps,
} from "../lib/shiftAssignments";

const TEMPLATE_VARIABLES = [
  { label: "Name", token: "{{name}}" },
  { label: "Vehicle", token: "{{vehicle}}" },
];

const EMPTY_TEMPLATE = {
  id: null,
  name: "",
  category: "general",
  body: "",
};

const TEAM_TABS = [
  { id: "roster", label: "Roster" },
  { id: "punch", label: "Punch In/Out" },
];

function isManagerRole(role) {
  return role === "manager" || role === "admin";
}

function getProfileName(profile) {
  return profile?.name || profile?.full_name || profile?.email || "Unknown";
}

function RoleBadge({ role }) {
  return isManagerRole(role) ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
      <Shield size={10} />
      {role === "admin" ? "Admin" : "Manager"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
      <User size={10} />
      Rep
    </span>
  );
}

function EditMemberModal({ member, leadCount, onClose, onSave, onSuspensionChange, onDelete }) {
  const [form, setForm] = useState({
    name: member.name || member.full_name || "",
    phone: member.phone || "",
    role: member.role || "rep",
    active: member.active ?? true,
    rr_order: member.rr_order ?? 0,
    shift_start_minutes: member.shift_start_minutes ?? parseTimeInputToMinutes("09:00"),
    shift_end_minutes: member.shift_end_minutes ?? parseTimeInputToMinutes("17:00"),
    shift_timezone: member.shift_timezone || DEFAULT_SHIFT_TIMEZONE,
  });
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  async function handleSave() {
    setSaving(true);
    const cleanName = form.name.trim();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: cleanName,
        phone: form.phone.trim() || null,
        role: form.role,
        active: form.active,
        rr_order: form.rr_order,
        shift_start_minutes: form.shift_start_minutes,
        shift_end_minutes: form.shift_end_minutes,
        shift_timezone: form.shift_timezone,
      })
      .eq("id", member.id)
      .select("*")
      .single();

    setSaving(false);

    if (!error && data) {
      onSave(data);
    }
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
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+15141234567"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="rep">Sales Rep</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Round robin order</label>
            <input
              type="number"
              min="0"
              value={form.rr_order}
              onChange={(event) => setForm((current) => ({ ...current, rr_order: parseInt(event.target.value, 10) || 0 }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Lower number gets first pass whenever reps overlap on shift.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Punch in</label>
              <input
                type="time"
                value={formatMinutesAsTimeInput(form.shift_start_minutes)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  shift_start_minutes: parseTimeInputToMinutes(event.target.value) ?? current.shift_start_minutes,
                }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Punch out</label>
              <input
                type="time"
                value={formatMinutesAsTimeInput(form.shift_end_minutes)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  shift_end_minutes: parseTimeInputToMinutes(event.target.value) ?? current.shift_end_minutes,
                }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">Active</span>
            <div
              onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.active ? "bg-blue-600" : "bg-slate-200"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-xs text-slate-400">{form.active ? "Eligible when punched in" : "Excluded from rotation"}</span>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Account access</p>
            <p className="text-sm text-slate-600 mb-4">
              {member.suspended_at
                ? `Suspended on ${new Date(member.suspended_at).toLocaleDateString()}.`
                : "Account can sign in normally."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setActing(true);
                  await onSuspensionChange(member, !member.suspended_at);
                  setActing(false);
                }}
                disabled={acting}
                className={`px-3 py-2 text-sm font-semibold rounded-lg ${member.suspended_at ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}
              >
                {member.suspended_at ? "Unsuspend" : "Suspend"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActing(true);
                  await onDelete(member);
                  setActing(false);
                }}
                disabled={acting}
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-red-50 text-red-700"
              >
                Delete account
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {leadCount} assigned lead{leadCount !== 1 ? "s" : ""} will become unassigned if the account is deleted.
            </p>
          </div>
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

export default function Admin({ currentProfile }) {
  const [members, setMembers] = useState([]);
  const [leadCounts, setLeadCounts] = useState({});
  const [templates, setTemplates] = useState([]);
  const [teamFiles, setTeamFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState(null);
  const [templateDraft, setTemplateDraft] = useState(EMPTY_TEMPLATE);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [uploadingTeamFiles, setUploadingTeamFiles] = useState(false);
  const [openingFileId, setOpeningFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [activeTeamTab, setActiveTeamTab] = useState("roster");
  const templateBodyRef = useRef(null);

  const isManager = isManagerRole(currentProfile?.role);
  const currentUserId = currentProfile?.id || null;

  async function fetchData() {
    setLoading(true);

    const [profilesRes, leadsRes, templatesRes, filesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("leads").select("assigned_to").not("assigned_to", "is", null),
      supabase.from("templates").select("*").order("updated_at", { ascending: false }),
      supabase.from("crm_files").select("*").eq("scope", "team").order("created_at", { ascending: false }),
    ]);

    setMembers(sortRoundRobinReps(profilesRes.data || []));
    setTemplates(templatesRes.data || []);
    setTeamFiles(filesRes.data || []);

    const counts = {};
    for (const lead of leadsRes.data || []) {
      counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
    }
    setLeadCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  const activeMembers = useMemo(
    () => sortRoundRobinReps(members.filter((member) => (member.active ?? true) && !member.suspended_at)),
    [members],
  );

  const inactiveMembers = useMemo(
    () => sortRoundRobinReps(members.filter((member) => member.active === false || member.suspended_at)),
    [members],
  );

  const onShiftMembers = useMemo(
    () => activeMembers.filter((member) => isRepWorking(member)),
    [activeMembers],
  );

  const membersById = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member])),
    [members],
  );

  function handleSavedMember(updatedMember) {
    setMembers((current) => sortRoundRobinReps(current.map((member) => (member.id === updatedMember.id ? updatedMember : member))));
    setEditingMember(null);
  }

  async function handleSuspensionChange(member, shouldSuspend) {
    if (!window.confirm(`${shouldSuspend ? "Suspend" : "Unsuspend"} ${getProfileName(member)}?`)) return;

    const { data, error } = await supabase.rpc("admin_set_user_suspension", {
      target_user_id: member.id,
      should_suspend: shouldSuspend,
    });

    if (error || !data) {
      console.error("Failed to update suspension", error);
      return;
    }

    setMembers((current) => sortRoundRobinReps(current.map((entry) => (entry.id === data.id ? data : entry))));
    setEditingMember((current) => (current?.id === data.id ? data : current));
  }

  async function handleDeleteMember(member) {
    if (!window.confirm(`Delete ${getProfileName(member)}? This removes the auth account and unassigns their leads.`)) return;

    const { error } = await supabase.rpc("admin_delete_user_account", {
      target_user_id: member.id,
    });

    if (error) {
      console.error("Failed to delete user", error);
      return;
    }

    setMembers((current) => current.filter((entry) => entry.id !== member.id));
    setEditingMember(null);
  }

  function resetTemplateDraft() {
    setTemplateDraft(EMPTY_TEMPLATE);
  }

  function editTemplate(template) {
    setTemplateDraft({
      id: template.id,
      name: template.name || "",
      category: template.category || "general",
      body: template.body || "",
    });
  }

  function insertVariable(token) {
    const element = templateBodyRef.current;
    if (!element) {
      setTemplateDraft((current) => ({
        ...current,
        body: `${current.body}${current.body ? " " : ""}${token}`,
      }));
      return;
    }

    const start = element.selectionStart ?? templateDraft.body.length;
    const end = element.selectionEnd ?? templateDraft.body.length;
    const nextBody = `${templateDraft.body.slice(0, start)}${token}${templateDraft.body.slice(end)}`;

    setTemplateDraft((current) => ({ ...current, body: nextBody }));

    requestAnimationFrame(() => {
      element.focus();
      const nextCursor = start + token.length;
      element.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function saveTemplate(event) {
    event.preventDefault();
    if (!isManager) return;

    setTemplateSaving(true);

    const payload = {
      name: templateDraft.name.trim(),
      category: templateDraft.category,
      body: templateDraft.body.trim(),
      variables: TEMPLATE_VARIABLES.map((item) => item.token.replace(/[{}]/g, "")),
      updated_by: currentUserId,
    };

    const query = templateDraft.id
      ? supabase.from("templates").update(payload).eq("id", templateDraft.id)
      : supabase.from("templates").insert({ ...payload, created_by: currentUserId });

    const { error } = await query.select().single();
    setTemplateSaving(false);

    if (!error) {
      resetTemplateDraft();
      fetchData();
    }
  }

  async function deleteTemplate(templateId) {
    if (!isManager || !window.confirm("Delete this SMS template?")) return;

    setDeletingTemplateId(templateId);
    const { error } = await supabase.from("templates").delete().eq("id", templateId);
    setDeletingTemplateId(null);

    if (!error) {
      if (templateDraft.id === templateId) {
        resetTemplateDraft();
      }
      fetchData();
    }
  }

  async function handleTeamFileUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploadingTeamFiles(true);

    for (const file of selectedFiles) {
      try {
        await uploadCrmFile({
          file,
          scope: "team",
          category: "team",
          userId: currentUserId,
        });
      } catch (error) {
        console.error("Failed to upload team file", error);
      }
    }

    event.target.value = "";
    setUploadingTeamFiles(false);
    fetchData();
  }

  async function openFile(file) {
    setOpeningFileId(file.id);

    try {
      const signedUrl = await createSignedFileUrl(file.storage_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open file", error);
    }

    setOpeningFileId(null);
  }

  async function removeFile(file) {
    if (!(isManager || file.uploaded_by === currentUserId)) return;
    if (!window.confirm(`Delete ${file.file_name}?`)) return;

    setDeletingFileId(file.id);

    try {
      await deleteCrmFile(file.id, file.storage_path);
      fetchData();
    } catch (error) {
      console.error("Failed to delete file", error);
    }

    setDeletingFileId(null);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-7 w-28 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-28 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500 mt-1">
          Team setup, reusable SMS templates, and private backend files.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-slate-900">Team</h2>
            <p className="text-sm text-slate-500 mt-1">
              {onShiftMembers.length} rep{onShiftMembers.length !== 1 ? "s" : ""} currently punched in for round robin.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-700">
            <strong>Round robin:</strong> only active reps inside their punch window can receive new leads.
            If nobody is on shift, AI should take first contact instead of letting the lead sit.
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 mb-5">
            {TEAM_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTeamTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTeamTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTeamTab === "roster" ? (
            <div className="space-y-2">
              {activeMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-xl border border-slate-200 px-4 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 font-semibold text-sm">
                      {getProfileName(member).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{getProfileName(member)}</span>
                        <RoleBadge role={member.role} />
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isRepWorking(member) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {isRepWorking(member) ? "On shift" : "Off shift"}
                        </span>
                        {member.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                        {member.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} />
                            {member.phone}
                          </span>
                        )}
                        <span>{leadCounts[member.id] || 0} assigned lead{(leadCounts[member.id] || 0) !== 1 ? "s" : ""}</span>
                        <span>order: {member.rr_order ?? 0}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={10} />
                          {formatShiftWindow(member.shift_start_minutes, member.shift_end_minutes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isManager && (
                    <button
                      onClick={() => setEditingMember(member)}
                      className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit team member"
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[...activeMembers, ...inactiveMembers].map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-xl border border-slate-200 px-4 py-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{getProfileName(member)}</span>
                      <RoleBadge role={member.role} />
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isRepWorking(member) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {isRepWorking(member) ? "Working now" : "Outside shift"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {member.active ? formatShiftWindow(member.shift_start_minutes, member.shift_end_minutes) : "Inactive rep"}
                    </p>
                  </div>

                  {isManager && (
                    <button
                      onClick={() => setEditingMember(member)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Edit shift
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTeamTab === "roster" && inactiveMembers.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Inactive</p>
              <div className="space-y-2">
                {inactiveMembers.map((member) => (
                  <div key={member.id} className="rounded-xl border border-slate-200 px-4 py-3 opacity-60 bg-slate-50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-700">{getProfileName(member)}</span>
                      <RoleBadge role={member.role} />
                      {member.suspended_at && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          Suspended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {member.suspended_at ? "Sign-in blocked" : "Not in rotation"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">SMS Templates</h2>
              <p className="text-sm text-slate-500 mt-1">
                CRUD templates with lead variables like <code>{"{{name}}"}</code> and <code>{"{{vehicle}}"}</code>.
              </p>
            </div>
            {!isManager && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                Read only
              </span>
            )}
          </div>

          <form onSubmit={saveTemplate} className="space-y-3 mb-5">
            <div className="grid sm:grid-cols-[1fr_180px] gap-3">
              <input
                type="text"
                value={templateDraft.name}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Template name"
                disabled={!isManager}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
              <select
                value={templateDraft.category}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))}
                disabled={!isManager}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50"
              >
                <option value="general">General</option>
                <option value="follow_up">Follow-up</option>
                <option value="inspection">Inspection</option>
                <option value="appointment">Appointment</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => insertVariable(item.token)}
                  disabled={!isManager}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:bg-slate-50"
                >
                  {item.token}
                </button>
              ))}
            </div>

            <textarea
              ref={templateBodyRef}
              value={templateDraft.body}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))}
              placeholder="Hi {{name}}, the {{vehicle}} is ready for you."
              rows={5}
              disabled={!isManager}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />

            {isManager && (
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={templateSaving || !templateDraft.name.trim() || !templateDraft.body.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {templateSaving ? "Saving..." : templateDraft.id ? "Update template" : "Create template"}
                </button>
                {templateDraft.id && (
                  <button
                    type="button"
                    onClick={resetTemplateDraft}
                    className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="space-y-3">
            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No SMS templates yet.
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {template.category?.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{template.body}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Updated {new Date(template.updated_at || template.created_at).toLocaleString()}
                      </p>
                    </div>

                    {isManager && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => editTemplate(template)}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                          title="Edit template"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          disabled={deletingTemplateId === template.id}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                          title="Delete template"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Backend Files</h2>
            <p className="text-sm text-slate-500 mt-1">
              Shared team files stored in private Supabase storage.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium cursor-pointer hover:bg-slate-800">
            <Upload size={15} />
            {uploadingTeamFiles ? "Uploading..." : "Upload files"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleTeamFileUpload}
              disabled={uploadingTeamFiles}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
            />
          </label>
        </div>

        <div className="space-y-3">
          {teamFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No backend files uploaded yet.
            </div>
          ) : (
            teamFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <button
                      onClick={() => openFile(file)}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-700 truncate text-left"
                    >
                      {openingFileId === file.id ? "Opening..." : file.file_name}
                    </button>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleString()} · uploaded by {getProfileName(membersById[file.uploaded_by])}
                    </p>
                  </div>
                </div>

                {(isManager || file.uploaded_by === currentUserId) && (
                  <button
                    onClick={() => removeFile(file)}
                    disabled={deletingFileId === file.id}
                    className="shrink-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                    title="Delete file"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {isManager && (
        <section className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-700 mb-2">Add a new rep</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-500">
            <li>Create the user in Supabase Auth.</li>
            <li>Have them log in once so their profile is created.</li>
            <li>Set their name, phone, role, round robin order, and punch window here.</li>
          </ol>
        </section>
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          leadCount={leadCounts[editingMember.id] || 0}
          onClose={() => setEditingMember(null)}
          onSave={handleSavedMember}
          onSuspensionChange={handleSuspensionChange}
          onDelete={handleDeleteMember}
        />
      )}
    </div>
  );
}
