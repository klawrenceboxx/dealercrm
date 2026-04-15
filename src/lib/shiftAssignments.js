const DEFAULT_SHIFT_TIMEZONE = "America/Toronto";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function parseTimeInputToMinutes(value) {
  if (!value || !value.includes(":")) return null;

  const [hourRaw, minuteRaw] = value.split(":");
  const hours = Number.parseInt(hourRaw, 10);
  const minutes = Number.parseInt(minuteRaw, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function formatMinutesAsTimeInput(value) {
  if (!Number.isFinite(value)) return "";

  const normalized = ((value % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${pad(hours)}:${pad(minutes)}`;
}

export function formatShiftWindow(startMinutes, endMinutes) {
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return "No shift set";
  }

  const start = formatMinutesAsTimeInput(startMinutes);
  const end = formatMinutesAsTimeInput(endMinutes);

  return `${start} - ${end}`;
}

export function getMinutesInTimeZone(date = new Date(), timeZone = DEFAULT_SHIFT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const hours = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minutes = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);

  return hours * 60 + minutes;
}

export function isRepWorking(rep, date = new Date()) {
  if (!rep?.active) return false;

  const startMinutes = rep.shift_start_minutes;
  const endMinutes = rep.shift_end_minutes;
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return true;

  if (startMinutes === endMinutes) return true;

  const nowMinutes = getMinutesInTimeZone(date, rep.shift_timezone || DEFAULT_SHIFT_TIMEZONE);

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function sortRoundRobinReps(reps = []) {
  return [...reps].sort((a, b) => {
    const orderDiff = (a.rr_order ?? 0) - (b.rr_order ?? 0);
    if (orderDiff !== 0) return orderDiff;

    const nameA = (a.name || a.full_name || "").toLowerCase();
    const nameB = (b.name || b.full_name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export function pickRoundRobinRep(reps = [], options = {}) {
  const {
    rrIndex = 0,
    now = new Date(),
    excludeRepId = null,
  } = options;

  const available = sortRoundRobinReps(reps)
    .filter((rep) => isRepWorking(rep, now))
    .filter((rep) => rep.id !== excludeRepId || reps.length === 1);

  if (available.length === 0) {
    return {
      assignedRep: null,
      nextIndex: 0,
      available,
    };
  }

  const safeIndex = ((rrIndex % available.length) + available.length) % available.length;
  return {
    assignedRep: available[safeIndex],
    nextIndex: (safeIndex + 1) % available.length,
    available,
  };
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hasLeadRepliedSinceAssignment(lead) {
  const assignedAt = toDate(lead?.assigned_at);
  const lastReplyAt = toDate(lead?.last_reply_at);

  if (!assignedAt || !lastReplyAt) return false;
  return lastReplyAt.getTime() >= assignedAt.getTime();
}

export function shouldAutoEngageLead(lead, now = new Date()) {
  if (!lead?.assigned_at || lead?.rep_response_at || lead?.autopilot_active) return false;

  const assignedAt = toDate(lead.assigned_at);
  if (!assignedAt) return false;

  return now.getTime() - assignedAt.getTime() >= FOUR_HOURS_MS;
}

export function shouldReassignLead(lead, now = new Date()) {
  if (!lead?.assigned_at || lead?.rep_response_at) return false;
  if (hasLeadRepliedSinceAssignment(lead)) return false;

  const assignedAt = toDate(lead.assigned_at);
  if (!assignedAt) return false;

  return now.getTime() - assignedAt.getTime() >= THREE_DAYS_MS;
}

export {
  DEFAULT_SHIFT_TIMEZONE,
  FOUR_HOURS_MS,
  THREE_DAYS_MS,
};
