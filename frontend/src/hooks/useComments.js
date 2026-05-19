/**
 * useComments — fetches and manages the comment thread for a ticket.
 *
 * Returns:
 *   comments  — array of comment objects
 *   loading   — true while first fetch is in progress
 *   error     — error message string if fetch failed
 *   refetch   — call this after adding a comment to reload the list
 */
import { useCallback, useEffect, useState } from "react";
import { listComments } from "../api/tickets";

export function useComments(ticketId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // refetch: incrementing refreshKey triggers the useEffect below
  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!ticketId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    listComments(ticketId)
      .then(({ data }) => {
        if (!cancelled) setComments(data.results ?? data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? "Could not load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticketId, refreshKey]);

  return { comments, loading, error, refetch };
}
