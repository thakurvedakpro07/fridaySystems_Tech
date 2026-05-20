import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { adminGetTicket, freelancerGetTicket, getTicket } from "../api/tickets";
import { useAuthStore } from "../store/authStore";
import TicketDetail from "../components/tickets/TicketDetail";
import MainLayout from "../components/layouts/MainLayout";

// Choose the right fetch function and role label based on who's logged in.
function useRoleTicketFetcher(id) {
  const user = useAuthStore((s) => s.user);
  if (user?.is_staff) return { fetchFn: () => adminGetTicket(id), role: "admin" };
  if (user?.role === "freelancer") return { fetchFn: () => freelancerGetTicket(id), role: "freelancer" };
  return { fetchFn: () => getTicket(id), role: "customer" };
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchFn, role } = useRoleTicketFetcher(id);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTicket = useCallback(() => {
    setLoading(true);
    fetchFn()
      .then(({ data }) => setTicket(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("Ticket not found.");
        } else {
          setError("Could not load ticket. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  // fetchFn is derived from user object — stable for the lifetime of the page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  return (
    <MainLayout maxWidth="max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex items-center gap-1"
      >
        ← Back
      </button>

      {loading && <p className="text-gray-400">Loading ticket…</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && ticket && (
        <TicketDetail ticket={ticket} role={role} onUpdate={loadTicket} />
      )}
    </MainLayout>
  );
}
