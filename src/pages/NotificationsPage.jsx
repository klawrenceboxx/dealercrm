import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  formatNotificationTimestamp,
  getLeadDisplayName,
  getNotificationCopy,
  getNotificationTarget,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../lib/notifications";
import { useProfile } from "../lib/ProfileContext";
import { supabase } from "../lib/supabase";

const STAGE_STYLES = {
  new: { bg: "#f1f5f9", color: "#475569" },
  contacted: { bg: "#dbeafe", color: "#1d4ed8" },
  warm: { bg: "#fef3c7", color: "#b45309" },
  hot: { bg: "#fee2e2", color: "#b91c1c" },
  closed: { bg: "#dcfce7", color: "#15803d" },
  unsubscribed: { bg: "#f1f5f9", color: "#94a3b8" },
};

export default function NotificationsPage() {
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [actionBusy, setActionBusy] = useState(false);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      fetchNotifications({ limit: 100 }),
      fetchUnreadNotificationCount(),
    ]);

    if (!error) {
      setNotifications(data);
    } else {
      console.error("Error fetching notifications:", error);
    }

    if (!countError) {
      setUnreadCount(count);
    } else {
      console.error("Error fetching unread notification count:", countError);
    }

    if (!silent) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const [{ data, error }, { count, error: countError }] = await Promise.all([
        fetchNotifications({ limit: 100 }),
        fetchUnreadNotificationCount(),
      ]);

      if (cancelled) return;

      if (!error) {
        setNotifications(data);
      } else {
        console.error("Error fetching notifications:", error);
      }

      if (!countError) {
        setUnreadCount(count);
      } else {
        console.error("Error fetching unread notification count:", countError);
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile?.id) return undefined;

    const channel = subscribeToNotifications(profile.id, () => {
      loadNotifications({ silent: true });
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications, profile?.id]);

  const visibleNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notification) => !notification.is_read);
    }

    return notifications;
  }, [filter, notifications]);

  async function handleOpenNotification(notification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    navigate(getNotificationTarget(notification));
  }

  async function handleMarkAllRead() {
    setActionBusy(true);

    const { error } = await markAllNotificationsRead();

    if (error) {
      console.error("Error marking notifications as read:", error);
      setActionBusy(false);
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    setActionBusy(false);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Notifications</h1>
          <p className="mt-0.5 text-sm" style={{ color: "#64748b" }}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "All caught up"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border bg-white p-1" style={{ borderColor: "#e2e8f0" }}>
            {[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                style={filter === option.value
                  ? { backgroundColor: "#2563eb", color: "white" }
                  : { color: "#475569" }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={actionBusy || unreadCount === 0}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "#cbd5e1", backgroundColor: "white", color: "#2563eb" }}
          >
            Mark all read
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border bg-white p-5" style={{ borderColor: "#e2e8f0" }}>
              <div className="mb-3 h-4 w-40 rounded bg-slate-200" />
              <div className="mb-2 h-3 w-full rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "#e2e8f0" }}>
          <h2 className="text-base font-semibold" style={{ color: "#0f172a" }}>No notifications to show</h2>
          <p className="mt-2 text-sm" style={{ color: "#64748b" }}>
            Incoming messages, hot leads, and new assignments will land here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotifications.map((notification) => {
            const copy = getNotificationCopy(notification);
            const stageStyle = STAGE_STYLES[notification.lead?.stage] || STAGE_STYLES.new;

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleOpenNotification(notification)}
                className="w-full rounded-2xl border bg-white p-5 text-left transition-colors hover:bg-slate-50"
                style={{ borderColor: notification.is_read ? "#e2e8f0" : "#bfdbfe" }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: notification.is_read ? "#cbd5e1" : "#2563eb" }}
                      />
                      <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>{copy.title}</p>
                      {notification.lead?.stage && (
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-medium capitalize"
                          style={{ backgroundColor: stageStyle.bg, color: stageStyle.color }}
                        >
                          {notification.lead.stage}
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: "#475569" }}>{copy.body}</p>
                    {notification.lead && (
                      <p className="mt-2 text-xs font-medium" style={{ color: "#64748b" }}>
                        Lead: {getLeadDisplayName(notification.lead)}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-xs" style={{ color: "#94a3b8" }}>
                    {formatNotificationTimestamp(notification.created_at)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
