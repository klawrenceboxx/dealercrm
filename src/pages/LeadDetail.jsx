import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STAGES = ["new", "contacted", "warm", "hot", "closed", "unsubscribed"];

const STAGE_STYLES = {
  new:          { bg: "#f1f5f9", color: "#475569" },
  contacted:    { bg: "#dbeafe", color: "#1d4ed8" },
  warm:         { bg: "#fef3c7", color: "#b45309" },
  hot:          { bg: "#fee2e2", color: "#b91c1c" },
  closed:       { bg: "#dcfce7", color: "#15803d" },
  unsubscribed: { bg: "#f1f5f9", color: "#94a3b8" },
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const currentUserRef = useRef(null);

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from("activity_log")
      .select("id, event_type, metadata, created_at, actor_id, actor:profiles!activity_log_actor_id_fkey(full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    setActivity(data || []);
  }, [id]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [leadRes, msgRes, noteRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase.from("sms_log").select("*").eq("lead_id", id).order("sent_at", { ascending: true }),
      supabase.from("notes").select("*, profiles(full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    if (leadRes.data) setLead(leadRes.data);
    if (msgRes.data) setMessages(msgRes.data);
    if (noteRes.data) setNotes(noteRes.data);
    await fetchActivity();
    setLoading(false);
  }, [fetchActivity, id]);

  async function logRepResponse(noteExcerpt = null) {
    const repResponseAt = new Date().toISOString();
    const { data } = await supabase
      .from("leads")
      .update({ rep_response_at: repResponseAt, autopilot_active: false })
      .eq("id", id)
      .select()
      .single();

    await supabase.from("activity_log").insert({
      lead_id: id,
      event_type: "rep_response",
      actor_id: currentUserRef.current,
      metadata: noteExcerpt ? { note_excerpt: noteExcerpt } : {},
    });

    if (data) {
      setLead(data);
    }
  }

  async function updateStage(stage) {
    const payload = { stage };
    if (stage !== "new") {
      payload.autopilot_active = false;
      payload.rep_response_at = lead?.rep_response_at || new Date().toISOString();
    }

    const { data } = await supabase.from("leads").update(payload).eq("id", id).select().single();
    if (data) {
      setLead(data);
      await fetchActivity();
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);
    const noteContent = newNote.trim();
    const { data } = await supabase.from("notes").insert({ lead_id: id, content: noteContent, created_by: currentUserRef.current }).select("*, profiles(full_name)").single();
    if (data) {
      setNotes([data, ...notes]);
      await logRepResponse(noteContent.slice(0, 120));
      await fetchActivity();
    }
    setNewNote("");
    setSaving(false);
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserRef.current = session?.user?.id || null;
    });

    Promise.resolve().then(() => {
      if (!cancelled) {
        fetchAll();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchAll, id]);

  if (loading) return <div className="p-6 text-sm" style={{ color: "#94a3b8" }}>Loading...</div>;
  if (!lead) return <div className="p-6 text-sm" style={{ color: "#dc2626" }}>Lead not found.</div>;

  const stageStyle = STAGE_STYLES[lead.stage] || STAGE_STYLES.new;
  const fullName = `${lead.first_name} ${lead.last_name}`;

  return (
    <div className="p-6 max-w-5xl">
      {/* Back */}
      <button
        onClick={() => navigate("/leads")}
        className="flex items-center gap-1.5 text-sm mb-5 transition-colors"
        style={{ color: "#64748b" }}
        onMouseEnter={e => e.currentTarget.style.color = "#0f172a"}
        onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to leads
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold text-white shrink-0"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              {`${(lead.first_name || "?")[0]}${(lead.last_name || "")[0] || ""}`.toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>{fullName}</h1>
              <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
                {lead.phone}{lead.email ? ` · ${lead.email}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => logRepResponse()}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Mark rep responded
            </button>
            <select
              value={lead.stage}
              onChange={(e) => updateStage(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer capitalize focus:outline-none"
              style={{ backgroundColor: stageStyle.bg, color: stageStyle.color }}
            >
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="bg-white rounded-xl p-5 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h2 className="text-xs font-semibold tracking-wider mb-4" style={{ color: "#64748b" }}>LEAD DETAILS</h2>
        <div className="grid grid-cols-4 gap-4">
          <InfoItem label="Source" value={lead.source} />
          <InfoItem label="Vehicle Interest" value={lead.vehicle_interest || "—"} />
          <InfoItem label="Intent Score" value={lead.intent_score || "—"} />
          <InfoItem label="Sequence Step" value={lead.sequence_step ?? "—"} />
          <InfoItem label="SMS Count" value={lead.sms_count ?? 0} />
          <InfoItem label="Opted Out" value={lead.opted_out ? "Yes" : "No"} />
          <InfoItem label="Next Follow-up" value={lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "—"} />
          <InfoItem label="Last Reply" value={lead.last_reply_at ? new Date(lead.last_reply_at).toLocaleString() : "—"} />
        </div>
      </div>

      {/* SMS + Notes */}
      <div className="grid grid-cols-2 gap-4">
        {/* SMS thread */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="text-xs font-semibold tracking-wider mb-4" style={{ color: "#64748b" }}>SMS THREAD</h2>
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "380px" }}>
            {messages.length === 0 ? (
              <p className="text-xs" style={{ color: "#94a3b8" }}>No messages yet.</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl px-3.5 py-2.5 text-sm ${msg.direction === "outbound" ? "ml-8" : "mr-8"}`}
                  style={{
                    backgroundColor: msg.direction === "outbound" ? "#2563eb" : "#f1f5f9",
                    color: msg.direction === "outbound" ? "white" : "#0f172a",
                  }}
                >
                  <p className="leading-relaxed">{msg.body}</p>
                  <p className="text-xs mt-1" style={{ opacity: 0.65 }}>
                    {new Date(msg.sent_at).toLocaleString()}
                    {msg.demo && " · demo"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="text-xs font-semibold tracking-wider mb-4" style={{ color: "#64748b" }}>NOTES</h2>
          <form onSubmit={addNote} className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="w-full text-sm px-3 py-2.5 border rounded-lg resize-none focus:outline-none"
              style={{ borderColor: "#e2e8f0", color: "#0f172a" }}
            />
            <button
              type="submit"
              disabled={saving || !newNote.trim()}
              className="mt-2 px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "#2563eb" }}
            >
              {saving ? "Saving..." : "Add note"}
            </button>
          </form>
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "280px" }}>
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <p className="text-sm" style={{ color: "#0f172a" }}>{note.content}</p>
                <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                  {note.profiles?.full_name && <span className="font-medium" style={{ color: "#64748b" }}>{note.profiles.full_name} · </span>}
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 mt-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h2 className="text-xs font-semibold tracking-wider mb-4" style={{ color: "#64748b" }}>ACTIVITY</h2>
        {activity.length === 0 ? (
          <p className="text-xs" style={{ color: "#94a3b8" }}>No activity logged yet.</p>
        ) : (
          <div className="space-y-3">
            {activity.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium mb-0.5" style={{ color: "#94a3b8" }}>{label}</dt>
      <dd className="text-sm font-medium capitalize" style={{ color: "#0f172a" }}>{value}</dd>
    </div>
  );
}

function ActivityItem({ entry }) {
  const actorName = entry.actor?.full_name || null;
  const details = describeActivity(entry, actorName);

  return (
    <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>{details.title}</p>
          {details.description && (
            <p className="text-sm mt-1" style={{ color: "#475569" }}>{details.description}</p>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: "#94a3b8" }}>
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
        description: metadata.previous_assigned_to ? "Round-robin or manual reassignment logged." : "Initial ownership captured.",
      };
    case "rep_response":
      return {
        title: actorName ? `${actorName} logged a response` : "Rep response logged",
        description: metadata.note_excerpt || "A rep interaction was captured from a note.",
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
