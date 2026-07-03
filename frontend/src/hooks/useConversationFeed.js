/**
 * useConversationFeed — merges comments, attachments, and activity-log
 * entries for a ticket into one chronologically-sorted feed.
 *
 * Each item is tagged with `_kind` ("comment" | "attachment" | "activity")
 * and a common `_at` timestamp so ConversationFeed can render one
 * interleaved thread instead of three separate tabs/lists.
 */
import { useCallback, useEffect, useState } from "react";
import { listActivityLog, listComments } from "../api/tickets";
import { listAttachments } from "../api/attachments";

export function useConversationFeed(ticketId) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([listComments(ticketId), listAttachments(ticketId), listActivityLog(ticketId)])
      .then(([commentsRes, attachmentsRes, activityRes]) => {
        if (cancelled) return;

        const comments = (commentsRes.data.results ?? commentsRes.data).map((c) => ({
          ...c, _kind: "comment", _at: c.created_at,
        }));
        const attachments = (attachmentsRes.data.results ?? attachmentsRes.data).map((a) => ({
          ...a, _kind: "attachment", _at: a.uploaded_at,
        }));
        const activity = (activityRes.data.results ?? activityRes.data).map((a) => ({
          ...a, _kind: "activity", _at: a.created_at,
        }));

        const merged = [...comments, ...attachments, ...activity]
          .sort((a, b) => new Date(a._at) - new Date(b._at));

        setItems(merged);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the conversation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticketId, refreshKey]);

  return { items, loading, error, refetch };
}
