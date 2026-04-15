import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from "lucide-react";
import { supabase } from "../lib/supabase";

const INTENT_BADGE = {
  cold: "bg-slate-100 text-slate-600",
  warm: "bg-amber-100 text-amber-700",
  hot:  "bg-red-100 text-red-700",
};

const STATUS_BADGE = {
  scheduled:   "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  kept:        "bg-emerald-100 text-emerald-700",
  missed:      "bg-red-100 text-red-600",
  cancelled:   "bg-slate-100 text-slate-500",
};

export default function Schedule() {
  const [appointments, setAppointments] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = new Date();
    start.setDate(start.getDate() + weekOffset * 7 - start.getDay() + 1); // Monday
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const [apptRes, profileRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, leads(first_name, last_name, phone, intent_score)")
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString())
        .order("scheduled_at"),
      supabase.from("profiles").select("id, name, full_name"),
    ]);

    setAppointments(apptRes.data || []);
    const pMap = {};
    (profileRes.data || []).forEach((p) => { pMap[p.id] = p.name || p.full_name; });
    setProfiles(pMap);
    setLoading(false);
  }, [weekOffset]);

  useEffect(() => {
    Promise.resolve().then(fetchData);
  }, [fetchData]);

  // Build week days (Mon–Sun)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() + weekOffset * 7 - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekLabel = `${days[0].toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  const apptsByDay = (day) =>
    appointments.filter((a) => new Date(a.scheduled_at).toDateString() === day.toDateString());

  const totalThisWeek = appointments.length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Schedule</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {weekLabel} · {totalThisWeek} appointment{totalThisWeek !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((day) => {
            const dayAppts = apptsByDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            const isPast = day < new Date() && !isToday;

            return (
              <div key={day.toISOString()} className={isPast ? "opacity-55" : ""}>
                {/* Day label */}
                <div className="flex items-center gap-3 mb-2.5">
                  <div className={`flex items-center gap-2 ${isToday ? "text-blue-600" : "text-slate-600"}`}>
                    <CalendarDays size={14} />
                    <span className="text-sm font-semibold">
                      {day.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {isToday && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">Today</span>
                  )}
                  {dayAppts.length === 0 && (
                    <span className="text-xs text-slate-300">Nothing scheduled</span>
                  )}
                  {dayAppts.length > 0 && (
                    <span className="text-xs text-slate-400">{dayAppts.length} appointment{dayAppts.length !== 1 ? "s" : ""}</span>
                  )}
                </div>

                {/* Appointment cards */}
                {dayAppts.length > 0 && (
                  <div className="space-y-2">
                    {dayAppts.map((appt) => {
                      const lead = appt.leads;
                      return (
                        <div
                          key={appt.id}
                          onClick={() => navigate(`/leads/${appt.lead_id}`)}
                          className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-blue-200 hover:bg-blue-50/20 transition-all group"
                        >
                          {/* Time */}
                          <div className="flex items-center gap-1.5 shrink-0 w-20">
                            <Clock size={13} className="text-slate-400" />
                            <span className="text-sm font-bold text-slate-700">
                              {new Date(appt.scheduled_at).toLocaleTimeString("en-CA", {
                                hour: "numeric", minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 shrink-0">
                            {lead?.intent_score && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${INTENT_BADGE[lead.intent_score] || "bg-slate-100 text-slate-600"}`}>
                                {lead.intent_score}
                              </span>
                            )}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[appt.status] || "bg-slate-100 text-slate-600"}`}>
                              {appt.status.replace("_", " ")}
                            </span>
                          </div>

                          {/* Lead info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {lead ? `${lead.first_name} ${lead.last_name || ""}`.trim() : "Unknown lead"}
                            </p>
                            {lead?.phone && <p className="text-xs text-slate-400 mt-0.5">{lead.phone}</p>}
                          </div>

                          {/* Vehicle */}
                          {appt.vehicle && (
                            <p className="text-sm text-slate-500 truncate max-w-48 shrink-0">{appt.vehicle}</p>
                          )}

                          {/* Notes */}
                          {appt.notes && (
                            <p className="text-xs text-slate-400 truncate max-w-32 shrink-0">{appt.notes}</p>
                          )}

                          {/* Assigned rep */}
                          {appt.assigned_to && (
                            <p className="text-xs text-slate-400 shrink-0">{profiles[appt.assigned_to] || ""}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
