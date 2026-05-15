/**
 * useTickets — fetch and manage ticket list state.
 */
import { useEffect, useState } from "react";
import { listTickets } from "../api/tickets";

export function useTickets(filters = {}) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await listTickets(filters);
        if (!cancelled) setTickets(data.results ?? data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();

    // Cleanup: if the component unmounts before the request finishes,
    // don't update state (avoids React memory leak warnings)
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return { tickets, loading, error };
}
