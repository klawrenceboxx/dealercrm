import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STAGES = ["new", "contacted", "warm", "hot", "closed", "unsubscribed"];

const STAGE_COLORS = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  warm: "bg-yellow-100 text-yellow-700",
  hot: "bg-red-100 text-red-700",
  closed: "bg-green-100 text-green-700",
  unsubscribed: "bg-gray-100 text-gray-400",
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [id]);

  async function fetchAll() {
    setLoading(true);
    const [leadRes, msgRes, noteRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase.from("sms_log").select("*").eq("lead_id", id).order("sent_at", { ascending: true }),
      supabase.from("notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    if (leadRes.data) setLead(leadRes.data);
    if (msgRes.data) setMessages(msgRes.data);
    if (noteRes.data) setNotes(noteRes.data);
    setLoading(false);
  }

  async function updateStage(stage) {
    const { data } = await supabase
      .from("leads")
      .update({ stage })
      .eq("id", id)
      .select()
      .single();
    if (data) setLead(data);
  }

  async function addNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("notes")
      .insert({ lead_id: id, content: newNote.trim() })
      .select()
      .single();
    if (data) setNotes([data, ...notes]);
    setNewNote("");
    setSaving(false);
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading...</div>;
  if (!lead) return <div className="p-6 text-sm text-red-500">Lead not found.</div>;

  return (
    <div className="p-6 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate("/leads")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        ← Back to leads
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {lead.first_name} {lead.last_name}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{lead.phone} · {lead.email}</p>
        </div>
        <select
          value={lead.stage}
          onChange={(e) => updateStage(e.target.value)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer capitalize ${STAGE_COLORS[lead.stage]}`}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <InfoRow label="Source" value={lead.source} />
        <InfoRow label="Vehicle interest" value={lead.vehicle_interest || "—"} />
        <InfoRow label="Intent score" value={lead.intent_score || "—"} />
        <InfoRow label="Sequence step" value={lead.sequence_step ?? "—"} />
        <InfoRow label="SMS count" value={lead.sms_count ?? 0} />
        <InfoRow label="Opted out" value={lead.opted_out ? "Yes" : "No"} />
        <InfoRow
          label="Next follow-up"
          value={lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "—"}
        />
        <InfoRow
          label="Last reply"
          value={lead.last_reply_at ? new Date(lead.last_reply_at).toLocaleString() : "—"}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* SMS thread */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">SMS Thread</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-400">No messages yet.</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg px-3 py-2 text-sm max-w-xs ${
                    msg.direction === "outbound"
                      ? "bg-blue-600 text-white ml-auto"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p>{msg.body}</p>
                  <p className={`text-xs mt-1 ${msg.direction === "outbound" ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(msg.sent_at).toLocaleString()}
                    {msg.demo && " [DEMO]"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
          <form onSubmit={addNote} className="mb-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={saving || !newNote.trim()}
              className="mt-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Add note"}
            </button>
          </form>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {notes.map((note) => (
              <div key={note.id} className="bg-white border border-gray-200 rounded-md px-3 py-2">
                <p className="text-sm text-gray-800">{note.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(note.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 capitalize">{value}</dd>
    </div>
  );
}
