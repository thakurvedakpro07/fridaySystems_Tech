/**
 * useNotifications — fetches the user's in-app notification inbox.
 *
 * Returns:
 *   notifications  — all notifications for the logged-in user
 *   unreadCount    — number of unread notifications (for the badge)
 *   loading        — true while fetching
 *   refetch        — call after marking notifications as read
 */
import { useCallback, useEffect, useState } from "react";
import { listNotifications } from "../api/notifications";

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshKey, setRefreshKey]       = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    listNotifications()
      .then(({ data }) => {
        if (!cancelled) setNotifications(data.results ?? data);
      })
      .catch(() => {
        // Silently fail — notifications are non-critical
        if (!cancelled) setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, loading, refetch };
}
