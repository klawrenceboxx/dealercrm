import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { createSignedFileUrl, deleteCrmFile, formatFileSize, uploadCrmFile } from "../lib/crmFiles";
import { useProfile } from "../lib/ProfileContext";
import { isManagerRole } from "../lib/roles";

const STAGES = ["new", "contacted", "warm", "hot", "closed", "unsubscribed"];
const FILE_TABS = ["overview", "files"];
const WEBHOOK_WARNING = "n8n webhook not configured — message saved to DB but not delivered.";

const STAGE_STYLES = {
  new: { bg: "#f1f5f9", color: "#475569" },
  contacted: { bg: "#dbeafe", color: "#1d4ed8" },
  warm: { bg: "#fef3c7", color: "#b45309" },
  hot: { bg: "#fee2e2", color: "#b91c1c" },
  closed: { bg: "#dcfce7", color: "#15803d" },
  unsubscribed: { bg: "#f1f5f9", color: "#94a3b8" },
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [dealForm, setDealForm] = useState({
    sold_price: "",
    cost_of_car: "",
    recon_cost: "",
    sold_at: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [fileCategory, setFileCategory] = useState("inspection_report");
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [savingFinancials, setSavingFinancials] = useState(false);
  const [sendingChannel, setSendingChannel] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [openingFileId, setOpeningFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [togglingHot, setTogglingHot] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [deliveryWarning, setDeliveryWarning] = useState("");
  const currentUserRef = useRef(null);
  const isManager = isManagerRole(profile?.role);
  const webhookBaseUrl = (import.meta.env.VITE_N8N_WEBHOOK_BASE_URL || "").trim();

  async function fetchAll() {
    setLoading(true);

    const [leadRes, messagesRes, notesRes, activityRes, filesRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase
        .from("messages")
        .select("id, lead_id, created_at, content, direction, channel, sender_type, sender_id, ai_generated, opened_at, delivered_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("notes")
        .select("id, lead_id, content, created_by, created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("id, event_type, metadata, created_at, actor_id, actor:profiles!activity_log_actor_id_fkey(full_name)")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("crm_files").select("*").eq("scope", "lead").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);

    if (leadRes.data) {
      setLead(leadRes.data);
      setDealForm({
        sold_price: leadRes.data.sold_price ?? "",
        cost_of_car: leadRes.data.cost_of_car ?? "",
        recon_cost: leadRes.data.recon_cost ?? "",
        sold_at: toDateTimeLocalValue(leadRes.data.sold_at),
      });
    }
    setMessages(messagesRes.data || []);
    setNotes(notesRes.data || []);
    setActivity(activityRes.data || []);
    setFiles(filesRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const { data: { session } } = await supabase.auth.getSession();
      currentUserRef.current = session?.user?.id || null;

      if (isMounted) {
        fetchAll();
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStage(stage) {
    const { data } = await supabase
      .from("leads")
      .update({ stage })
      .eq("id", id)
      .select()
      .single();

    if (data) {
      setLead(data);
      fetchAll();
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!newNote.trim()) return;

    setSavingNote(true);

    const { data } = await supabase
      .from("notes")
      .insert({
        lead_id: id,
        content: newNote.trim(),
        created_by: currentUserRef.current,
      })
      .select()
      .single();

    if (data) {
      setNotes((current) => [data, ...current]);
      fetchAll();
    }

    setNewNote("");
    setSavingNote(false);
  }

  async function toggleHotLead() {
    if (!lead) return;

    setTogglingHot(true);

    const { data } = await supabase
      .from("leads")
      .update({ is_hot: !lead.is_hot })
      .eq("id", id)
      .select()
      .single();

    if (data) {
      setLead(data);
    }

    setTogglingHot(false);
  }

  async function handleSendMessage(channel) {
    const trimmedDraft = messageDraft.trim();

    if (!trimmedDraft) return;

    if (!currentUserRef.current) {
      setComposeError("You need an active session before sending a message.");
      return;
    }

    if (channel === "sms" && !lead?.phone) {
      setComposeError("This lead does not have a phone number.");
      return;
    }

    if (channel === "email" && !lead?.email) {
      setComposeError("This lead does not have an email address.");
      return;
    }

    setSendingChannel(channel);
    setComposeError("");
    setDeliveryWarning("");

    try {
      if (!webhookBaseUrl) {
        // TODO: Replace this DB-only fallback with the outbound n8n workflow once that webhook contract is finalized.
        const { data, error } = await supabase
          .from("messages")
          .insert({
            lead_id: id,
            content: trimmedDraft,
            direction: "outbound",
            channel,
            sender_type: "rep",
            sender_id: currentUserRef.current,
            ai_generated: false,
          })
          .select("id, lead_id, created_at, content, direction, channel, sender_type, sender_id, ai_generated, opened_at, delivered_at")
          .single();

        if (error) {
          throw error;
        }

        setMessages((current) => [...current, data]);
        setMessageDraft("");
        setDeliveryWarning(WEBHOOK_WARNING);
        return;
      }

      const response = await fetch(webhookBaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: id,
          channel,
          content: trimmedDraft,
          sender_type: "rep",
          sender_id: currentUserRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      setMessageDraft("");
      await fetchAll();
    } catch (error) {
      console.error(`Failed to send ${channel}`, error);
      setComposeError(`Failed to send ${channel.toUpperCase()}.`);
    } finally {
      setSendingChannel("");
    }
  }

  async function saveFinancials(event) {
    event.preventDefault();
    setSavingFinancials(true);

    const { data } = await supabase
      .from("leads")
      .update({
        sold_price: dealForm.sold_price === "" ? null : parseFloat(dealForm.sold_price),
        cost_of_car: dealForm.cost_of_car === "" ? null : parseFloat(dealForm.cost_of_car),
        recon_cost: dealForm.recon_cost === "" ? 0 : parseFloat(dealForm.recon_cost),
        sold_at: dealForm.sold_at ? new Date(dealForm.sold_at).toISOString() : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (data) {
      setLead(data);
      setDealForm({
        sold_price: data.sold_price ?? "",
        cost_of_car: data.cost_of_car ?? "",
        recon_cost: data.recon_cost ?? "",
        sold_at: toDateTimeLocalValue(data.sold_at),
      });
    }

    setSavingFinancials(false);
  }

  async function handleFileUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploadingFiles(true);

    for (const file of selectedFiles) {
      try {
        await uploadCrmFile({
          file,
          scope: "lead",
          leadId: id,
          category: fileCategory,
          userId: currentUserRef.current,
        });
      } catch (error) {
        console.error("Failed to upload lead file", error);
      }
    }

    event.target.value = "";
    setUploadingFiles(false);
    fetchAll();
  }

  async function openFile(file) {
    setOpeningFileId(file.id);

    try {
      const signedUrl = await createSignedFileUrl(file.storage_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open lead file", error);
    }

    setOpeningFileId(null);
  }

  async function removeFile(file) {
    const canDelete = isManager || file.uploaded_by === currentUserRef.current;

    if (!canDelete || !window.confirm(`Delete ${file.file_name}?`)) return;

    setDeletingFileId(file.id);

    try {
      await deleteCrmFile(file.id, file.storage_path);
      fetchAll();
    } catch (error) {
      console.error("Failed to delete lead file", error);
    }

    setDeletingFileId(null);
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading...</div>;
  }

  if (!lead) {
    return <div className="p-6 text-sm text-rose-600">Lead not found.</div>;
  }

  const stageStyle = STAGE_STYLES[lead.stage] || STAGE_STYLES.new;
  const fullName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unknown lead";
  const profit = getProfit(lead.sold_price, lead.cost_of_car, lead.recon_cost);

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <button
        onClick={() => navigate("/leads")}
        className="flex items-center gap-1.5 text-sm transition-colors text-slate-500 hover:text-slate-900"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to leads
      </button>

      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold text-white shrink-0"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              {`${(lead.first_name || "?")[0]}${(lead.last_name || "")[0] || ""}`.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900">{fullName}</h1>
              <p className="text-sm mt-0.5 text-slate-500">
                {lead.phone}
                {lead.email ? ` | ${lead.email}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleHotLead}
              disabled={togglingHot}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                lead.is_hot
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              } disabled:opacity-50`}
            >
              {togglingHot ? "Saving..." : lead.is_hot ? "Hot lead" : "Mark hot"}
            </button>

            <select
              value={lead.stage}
              onChange={(event) => updateStage(event.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer capitalize focus:outline-none"
              style={{ backgroundColor: stageStyle.bg, color: stageStyle.color }}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5 border-b border-slate-200">
          {FILE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab ? "border-blue-600 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h2 className="text-xs font-semibold tracking-wider mb-4 text-slate-500">LEAD DETAILS</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InfoItem label="Source" value={lead.source} />
              <InfoItem label="Vehicle Interest" value={lead.vehicle_interest || "-"} />
              <InfoItem label="Intent Score" value={lead.intent_score || "-"} />
              <InfoItem label="Sequence Step" value={lead.sequence_step ?? "-"} />
              <InfoItem label="SMS Count" value={lead.sms_count ?? 0} />
              <InfoItem label="Opted Out" value={lead.opted_out ? "Yes" : "No"} />
              <InfoItem label="Next Follow-up" value={lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "-"} />
              <InfoItem label="Last Reply" value={lead.last_reply_at ? new Date(lead.last_reply_at).toLocaleString() : "-"} />
            </div>
          </div>

          {isManager && (
            <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xs font-semibold tracking-wider text-slate-500">DEAL FINANCIALS</h2>
                  <p className="text-sm mt-1 text-slate-500">
                    Manager-only numbers for sold totals, cost of car, recon, and profit.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-400">Estimated Profit</p>
                  <p className="text-lg font-semibold" style={{ color: profit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {formatCurrency(profit)}
                  </p>
                </div>
              </div>

              <form onSubmit={saveFinancials}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-4">
                  <MoneyField label="Total Sold" value={dealForm.sold_price} onChange={(value) => setDealForm((current) => ({ ...current, sold_price: value }))} />
                  <MoneyField label="Cost Of Car" value={dealForm.cost_of_car} onChange={(value) => setDealForm((current) => ({ ...current, cost_of_car: value }))} />
                  <MoneyField label="Recon Cost" value={dealForm.recon_cost} onChange={(value) => setDealForm((current) => ({ ...current, recon_cost: value }))} />
                  <div>
                    <label className="block text-xs font-medium mb-0.5 text-slate-400">Sold At</label>
                    <input
                      type="datetime-local"
                      value={dealForm.sold_at}
                      onChange={(event) => setDealForm((current) => ({ ...current, sold_at: event.target.value }))}
                      className="w-full text-sm px-3 py-2.5 border rounded-lg focus:outline-none"
                      style={{ borderColor: "#e2e8f0", color: "#0f172a" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingFinancials}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
                  style={{ backgroundColor: "#0f172a" }}
                >
                  {savingFinancials ? "Saving..." : "Save financials"}
                </button>
              </form>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xs font-semibold tracking-wider text-slate-500">CONVERSATION</h2>
                  <p className="text-sm mt-1 text-slate-500">
                    Unified SMS and email timeline from the `messages` table.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 mb-4 bg-slate-50">
                <label className="block text-xs font-semibold tracking-wider text-slate-500 mb-2">
                  NEW MESSAGE
                </label>
                <textarea
                  value={messageDraft}
                  onChange={(event) => {
                    setMessageDraft(event.target.value);
                    if (composeError) {
                      setComposeError("");
                    }
                    if (deliveryWarning) {
                      setDeliveryWarning("");
                    }
                  }}
                  placeholder="Write an SMS or email update..."
                  rows={4}
                  className="w-full text-sm px-3 py-2.5 border rounded-lg resize-none focus:outline-none"
                  style={{ borderColor: "#cbd5e1", color: "#0f172a", backgroundColor: "#ffffff" }}
                />
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleSendMessage("sms")}
                    disabled={!messageDraft.trim() || sendingChannel === "sms" || !lead.phone}
                    className="px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
                    style={{ backgroundColor: "#2563eb" }}
                  >
                    {sendingChannel === "sms" ? "Sending SMS..." : "Send SMS"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("email")}
                    disabled={!messageDraft.trim() || sendingChannel === "email" || !lead.email}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white disabled:opacity-50"
                  >
                    {sendingChannel === "email" ? "Sending Email..." : "Send Email"}
                  </button>
                  {!lead.phone ? (
                    <span className="text-xs text-slate-400">No phone number on this lead.</span>
                  ) : null}
                  {!lead.email ? (
                    <span className="text-xs text-slate-400">No email address on this lead.</span>
                  ) : null}
                </div>
                {composeError ? (
                  <p className="mt-3 text-sm text-rose-600">{composeError}</p>
                ) : null}
                {deliveryWarning ? (
                  <p className="mt-3 text-sm text-amber-700">{deliveryWarning}</p>
                ) : null}
              </div>

              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 380 }}>
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-400">No messages yet.</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl px-3.5 py-2.5 text-sm ${message.direction === "outbound" ? "ml-8" : "mr-8"}`}
                      style={{
                        backgroundColor: message.direction === "outbound" ? "#2563eb" : "#f1f5f9",
                        color: message.direction === "outbound" ? "white" : "#0f172a",
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                          {message.channel}
                        </span>
                        <span className="text-[11px] opacity-70">
                          {getMessageSenderLabel(message)}
                        </span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleString()}
                        {message.ai_generated ? " | AI" : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <h2 className="text-xs font-semibold tracking-wider mb-4 text-slate-500">NOTES</h2>
              <form onSubmit={addNote} className="mb-4">
                <textarea
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full text-sm px-3 py-2.5 border rounded-lg resize-none focus:outline-none"
                  style={{ borderColor: "#e2e8f0", color: "#0f172a" }}
                />
                <button
                  type="submit"
                  disabled={savingNote || !newNote.trim()}
                  className="mt-2 px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "#2563eb" }}
                >
                  {savingNote ? "Saving..." : "Add note"}
                </button>
              </form>

              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 280 }}>
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-400">No notes yet.</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="rounded-lg px-3.5 py-2.5 bg-slate-50 border border-slate-100">
                      <p className="text-sm text-slate-900">{note.content}</p>
                      <p className="text-xs mt-1 text-slate-400">
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h2 className="text-xs font-semibold tracking-wider mb-4 text-slate-500">ACTIVITY</h2>
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400">No activity logged yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="bg-white rounded-xl p-5 space-y-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Lead Files</h2>
              <p className="text-sm text-slate-500 mt-1">
                Upload inspection reports, PDFs, and other lead-specific files to private storage.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={fileCategory}
                onChange={(event) => setFileCategory(event.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="inspection_report">Inspection report</option>
                <option value="attachment">General file</option>
              </select>

              <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium cursor-pointer hover:bg-slate-800">
                {uploadingFiles ? "Uploading..." : "Upload files"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFiles}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {files.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No files uploaded for this lead yet.
              </div>
            ) : (
              files.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openFile(file)}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-700 text-left"
                      >
                        {openingFileId === file.id ? "Opening..." : file.file_name}
                      </button>
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {file.category === "inspection_report" ? "inspection" : "file"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatFileSize(file.file_size)} | {new Date(file.created_at).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => removeFile(file)}
                    disabled={deletingFileId === file.id}
                    className="shrink-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                    title="Delete file"
                  >
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium mb-0.5 text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function MoneyField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-0.5 text-slate-400">{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full text-sm px-3 py-2.5 border rounded-lg focus:outline-none"
        style={{ borderColor: "#e2e8f0", color: "#0f172a" }}
      />
    </div>
  );
}

function ActivityItem({ entry }) {
  const actorName = entry.actor?.full_name || null;
  const details = describeActivity(entry, actorName);

  return (
    <div className="rounded-lg px-4 py-3 bg-slate-50 border border-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{details.title}</p>
          {details.description ? (
            <p className="text-sm mt-1 text-slate-600">{details.description}</p>
          ) : null}
        </div>
        <span className="text-xs shrink-0 text-slate-400">
          {new Date(entry.created_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function describeActivity(entry, actorName) {
  const metadata = entry.metadata || {};

  switch (entry.event_type) {
    case "form_submitted":
      return {
        title: "Website form submitted",
        description: metadata.vehicle_interest ? `Vehicle interest: ${metadata.vehicle_interest}` : null,
      };
    case "lead_assigned":
      return {
        title: actorName ? `Lead assigned to ${actorName}` : "Lead assigned",
        description: metadata.previous_assigned_to ? "Reassignment logged." : "Initial ownership captured.",
      };
    case "rep_response":
      return {
        title: actorName ? `${actorName} logged a response` : "Rep response logged",
        description: metadata.note_excerpt || "Rep interaction captured.",
      };
    case "sms_sent":
      return {
        title: "SMS sent",
        description: metadata.body_excerpt || metadata.trigger_type || "Outbound SMS logged.",
      };
    case "ai_auto_reply_sent":
      return {
        title: "AI email auto-reply sent",
        description: metadata.subject || null,
      };
    case "email_opened":
      return {
        title: "Email opened",
        description: metadata.recipient || "Resend open webhook received.",
      };
    case "email_clicked":
      return {
        title: "Email link clicked",
        description: metadata.link || metadata.recipient || "Resend click webhook received.",
      };
    case "deal_closed":
      return {
        title: "Deal closed",
        description: actorName ? `Attributed to ${actorName}.` : "Lead stage moved to closed.",
      };
    default:
      return {
        title: entry.event_type.replace(/_/g, " "),
        description: null,
      };
  }
}

function getMessageSenderLabel(message) {
  if (message.sender_type === "lead") {
    return "Lead";
  }

  if (message.sender_type === "rep") {
    return "Rep";
  }

  if (message.sender_type === "ai") {
    return "AI";
  }

  return "System";
}

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function getProfit(soldPrice, carCost, reconCost) {
  return (Number(soldPrice) || 0) - (Number(carCost) || 0) - (Number(reconCost) || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

