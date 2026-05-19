/**
 * useNotifications — fetches the user's in-app notification inbox.
 *
 * Returns:
 *   notifications  — all notifications for the logged-in user
 *   unreadCount    — number of unread notifications (for the badge)
 *   loading        — true while fetching
 *   refetch        — call after marking notifications as read
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { listNotifications } from "../api/notifications";

const POLL_INTERVAL_MS = 30_000; // refresh every 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshKey, setRefreshKey]       = useState(0);
  const intervalRef                       = useRef(null);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetch = () => {
      listNotifications()
        .then(({ data }) => {
          if (!cancelled) setNotifications(data.results ?? data);
        })
        .catch(() => {
          if (!cancelled) setNotifications([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    fetch();

    // Poll every 30 seconds so the unread badge stays up-to-date
    // without requiring a full page refresh.
    intervalRef.current = setInterval(fetch, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, [refreshKey]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, loading, refetch };
}
