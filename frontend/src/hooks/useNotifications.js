/**
 * useNotifications — split-polling notification hook.
 *
 * Badge polling strategy (30s interval):
 *   - Hits GET /notifications/unread-count/ — a single SQL COUNT, not a full list.
 *   - Tab-visibility aware: pauses when tab is hidden.
 *
 * List loading strategy:
 *   - Full list is fetched lazily (call fetchList()) — not on every poll tick.
 *   - Avoids shipping 100+ notification rows when the badge number is all we need.
 *
 * Optimistic updates:
 *   - markOne / markAll update local state immediately before the server round-trip.
 *   - Badge count decrements instantly with no refetch wait.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notifications";

const POLL_INTERVAL_MS = 30_000;

export function useNotifications() {
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [listLoading,   setListLoading]   = useState(false);
  const [listFetched,   setListFetched]   = useState(false);
  const [listError,     setListError]     = useState(false);

  const intervalRef   = useRef(null);
  const cancelledRef  = useRef(false);

  // ── Count poller ────────────────────────────────────────────────
  const pollCount = useCallback(() => {
    if (document.hidden) return;
    getUnreadCount()
      .then(({ data }) => {
        if (!cancelledRef.current) setUnreadCount(data.count ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    const startInterval = () => {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(pollCount, POLL_INTERVAL_MS);
    };

    const handleVisibility = () => {
      if (!document.hidden) { pollCount(); startInterval(); }
      else                  { clearInterval(intervalRef.current); }
    };

    pollCount();
    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelledRef.current = true;
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pollCount]);

  // ── Lazy list fetch (called when dropdown opens) ─────────────────
  // `listFetched` means "an attempt completed" (success OR failure) —
  // `listError` is the orthogonal flag that lets callers tell a genuinely
  // empty inbox apart from a failed fetch, which previously both rendered
  // as either nothing or a misleading "You're all caught up!" empty state.
  const fetchList = useCallback(() => {
    setListLoading(true);
    setListError(false);
    listNotifications()
      .then(({ data }) => {
        if (!cancelledRef.current) {
          setNotifications(data.results ?? data);
          setListFetched(true);
        }
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setNotifications([]);
          setListFetched(true);
          setListError(true);
        }
      })
      .finally(() => {
        if (!cancelledRef.current) setListLoading(false);
      });
  }, []);

  // ── Optimistic mark-one-read ─────────────────────────────────────
  const markOne = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch {
      // revert on failure by re-fetching
      fetchList();
      pollCount();
    }
  }, [fetchList, pollCount]);

  // ── Optimistic mark-all-read ─────────────────────────────────────
  const markAll = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      fetchList();
      pollCount();
    }
  }, [fetchList, pollCount]);

  return {
    unreadCount,
    notifications,
    listLoading,
    listFetched,
    listError,
    fetchList,
    markOne,
    markAll,
  };
}
