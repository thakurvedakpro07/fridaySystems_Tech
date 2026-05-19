/**
 * NotificationBell — the bell icon in the Header with unread count badge.
 *
 * Clicking it opens a dropdown showing recent notifications.
 * Each notification can be marked as read individually.
 * "Mark all as read" clears the badge.
 */
import { useEffect, useRef, useState } from "react";
import { markAllNotificationsRead, markNotificationRead } from "../../api/notifications";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../hooks/useNotifications";

const CATEGORY_ICONS = {
  ticket_assigned:   "📋",
  ticket_resolved:   "✅",
  comment_added:     "💬",
  status_changed:    "🔄",
  sla_breach:        "⚠️",
  payment_confirmed: "💳",
};

export default function NotificationBell() {
  const { notifications, unreadCount, loading, refetch } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const toast = useToast();

  // Close dropdown when clicking anywhere outside it
  useEffect(() => {
    function handleOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleMarkOne = async (e, id) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      refetch();
    } catch {
      toast("Could not mark notification as read", "error");
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      refetch();
      toast("All notifications marked as read", "success");
    } catch {
      toast("Could not update notifications", "error");
    }
  };

  const recent = notifications.slice(0, 8);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold
                           rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5
                           leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200
                        shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
            )}

            {!loading && recent.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">No notifications</p>
            )}

            {recent.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors
                            ${n.is_read ? "opacity-60" : "bg-blue-50/30"}`}
              >
                <span className="text-lg mt-0.5 shrink-0">
                  {CATEGORY_ICONS[n.category] ?? "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${n.is_read ? "text-gray-600" : "text-gray-900 font-medium"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(n.created_at).toLocaleString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={(e) => handleMarkOne(e, n.id)}
                    className="shrink-0 text-[10px] text-blue-600 hover:text-blue-800 mt-0.5"
                    title="Mark as read"
                  >
                    ✓
                  </button>
                )}
              </div>
            ))}
          </div>

          {notifications.length > 8 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-400">
                Showing 8 of {notifications.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
