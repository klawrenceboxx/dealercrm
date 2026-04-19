import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  formatNotificationTimestamp,
  getNotificationCopy,
  getNotificationTarget,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../lib/notifications";
import { supabase } from "../lib/supabase";

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const visibleNotifications = useMemo(
    () => notifications.slice(0, 6),
    [notifications],
  );

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return;
    if (!silent) {
      setLoading(true);
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      fetchNotifications({ limit: 12 }),
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
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);

      const [{ data, error }, { count, error: countError }] = await Promise.all([
        fetchNotifications({ limit: 12 }),
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
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = subscribeToNotifications(userId, () => {
      loadNotifications({ silent: true });
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications, userId]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  async function handleOpenNotification(notification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    setOpen(false);
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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
        style={{ borderColor: "#cbd5e1", backgroundColor: "white", color: "#0f172a" }}
        aria-label="Open notifications"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 min-w-5 rounded-full px-1 py-0.5 text-center text-[11px] font-semibold text-white"
            style={{ backgroundColor: "#2563eb" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-30 w-96 overflow-hidden rounded-2xl border bg-white shadow-xl"
          style={{ borderColor: "#e2e8f0" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#f1f5f9" }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>Notifications</h2>
              <p className="text-xs" style={{ color: "#64748b" }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={actionBusy || unreadCount === 0}
              className="text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: "#2563eb" }}
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-xl border p-3" style={{ borderColor: "#f1f5f9" }}>
                    <div className="mb-2 h-3 w-32 rounded bg-slate-200" />
                    <div className="mb-2 h-3 w-full rounded bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium" style={{ color: "#0f172a" }}>No notifications yet</p>
                <p className="mt-1 text-xs" style={{ color: "#64748b" }}>New lead assignments and inbound messages will show up here.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                {visibleNotifications.map((notification) => {
                  const copy = getNotificationCopy(notification);

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleOpenNotification(notification)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: notification.is_read ? "#cbd5e1" : "#2563eb" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>{copy.title}</p>
                          <span className="shrink-0 text-[11px]" style={{ color: "#94a3b8" }}>
                            {formatNotificationTimestamp(notification.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm" style={{ color: "#475569" }}>{copy.body}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3 text-right" style={{ borderColor: "#f1f5f9" }}>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium"
              style={{ color: "#2563eb" }}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
