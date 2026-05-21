import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminGetTicket, freelancerGetTicket, getTicket } from "../api/tickets";
import { useAuthStore } from "../store/authStore";
import TicketDetail from "../components/tickets/TicketDetail";
import MainLayout from "../components/layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import { usePageTitle } from "../hooks/usePageTitle";

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
  usePageTitle(ticket ? ticket.ticket_number : "Ticket");

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  return (
    <MainLayout maxWidth="max-w-3xl">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900
                   mb-5 transition-colors group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </button>

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {!loading && !error && ticket && (
        <TicketDetail ticket={ticket} role={role} onUpdate={loadTicket} />
      )}
    </MainLayout>
  );
}
