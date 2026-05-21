/**
 * useNotifications — fetches the user's in-app notification inbox.
 *
 * Returns:
 *   notifications  — all notifications for the logged-in user
 *   unreadCount    — number of unread notifications (for the badge)
 *   loading        — true while fetching
 *   refetch        — call after marking notifications as read
 *
 * Polling pauses automatically when the browser tab is hidden (Page Visibility API)
 * so background tabs don't generate wasted network traffic.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { listNotifications } from "../api/notifications";

const POLL_INTERVAL_MS = 30_000; // refresh every 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshKey, setRefreshKey]       = useState(0);
  const intervalRef                       = useRef(null);
  const cancelledRef                      = useRef(false);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    cancelledRef.current = false;

    const doFetch = () => {
      // Skip the fetch if the tab is hidden — no point updating a badge the user can't see
      if (document.hidden) return;
      listNotifications()
        .then(({ data }) => {
          if (!cancelledRef.current) setNotifications(data.results ?? data);
        })
        .catch(() => {
          if (!cancelledRef.current) setNotifications([]);
        })
        .finally(() => {
          if (!cancelledRef.current) setLoading(false);
        });
    };

    const startInterval = () => {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(doFetch, POLL_INTERVAL_MS);
    };

    // Resume polling (and immediately fetch) when the tab becomes visible again
    const handleVisibility = () => {
      if (!document.hidden) {
        doFetch();
        startInterval();
      } else {
        clearInterval(intervalRef.current);
      }
    };

    doFetch();
    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelledRef.current = true;
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshKey]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, loading, refetch };
}
