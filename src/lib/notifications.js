import { supabase } from "./supabase";

const NOTIFICATION_SELECT = `
  id,
  lead_id,
  type,
  is_read,
  created_at,
  lead:leads!notifications_lead_id_fkey (
    id,
    first_name,
    last_name,
    stage
  )
`;

function normalizeLead(lead) {
  if (Array.isArray(lead)) {
    return lead[0] || null;
  }

  return lead || null;
}

export function getLeadDisplayName(lead) {
  const fullName = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim();
  return fullName || "this lead";
}

export function getNotificationCopy(notification) {
  const leadName = getLeadDisplayName(notification.lead);

  if (notification.type === "new_message") {
    return {
      title: "New inbound message",
      body: `${leadName} sent a new message.`,
    };
  }

  if (notification.type === "new_lead_assigned") {
    return {
      title: "New lead assigned",
      body: `${leadName} was assigned to you.`,
    };
  }

  if (notification.type === "reassignment") {
    return {
      title: "Lead reassigned",
      body: `${leadName} was reassigned to you.`,
    };
  }

  if (notification.type === "hot_lead") {
    return {
      title: "Lead turned hot",
      body: `${leadName} is now marked hot.`,
    };
  }

  return {
    title: "Notification",
    body: `There is an update for ${leadName}.`,
  };
}

export function formatNotificationTimestamp(createdAt) {
  const createdAtDate = new Date(createdAt);
  const ageMs = Date.now() - createdAtDate.getTime();

  if (ageMs < 60_000) return "Just now";
  if (ageMs < 3_600_000) {
    const minutes = Math.max(1, Math.floor(ageMs / 60_000));
    return `${minutes}m ago`;
  }
  if (ageMs < 86_400_000) {
    const hours = Math.max(1, Math.floor(ageMs / 3_600_000));
    return `${hours}h ago`;
  }

  return createdAtDate.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeNotification(notification) {
  return {
    ...notification,
    lead: normalizeLead(notification.lead),
  };
}

export async function fetchNotifications({ limit = 25, unreadOnly = false } = {}) {
  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  return {
    data: (data || []).map(normalizeNotification),
    error,
  };
}

export async function fetchUnreadNotificationCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  return {
    count: count || 0,
    error,
  };
}

export async function markNotificationRead(notificationId) {
  return supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("is_read", false);
}

export async function markAllNotificationsRead() {
  return supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
}

export function subscribeToNotifications(userId, onChange) {
  if (!userId) return null;

  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();
}

export function getNotificationTarget(notification) {
  if (notification.lead_id) {
    return `/leads/${notification.lead_id}`;
  }

  return "/notifications";
}
