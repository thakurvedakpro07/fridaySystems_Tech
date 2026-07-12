import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TicketDetail from "../components/tickets/TicketDetail";
import MainLayout from "../components/layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import { usePageTitle } from "../hooks/usePageTitle";
import { useRoleTicketFetcher } from "../hooks/useRoleTicketFetcher";

export default function TicketDetailPage() {
  const { id } = useParams();
  const { fetchFn, role } = useRoleTicketFetcher(id);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  usePageTitle(ticket ? ticket.ticket_number : "Ticket");

  const loadTicket = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetchFn()
      .then(({ data }) => setTicket(data))
      .catch((err) => {
        if (!silent) {
          if (err.response?.status === 404) {
            setError("Ticket not found.");
          } else {
            setError("Could not load ticket. Please try again.");
          }
        }
      })
      .finally(() => { if (!silent) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Accept pre-fetched ticket data (e.g. from a POST response) to update state
  // immediately without a round-trip GET; fall back to full re-fetch if not provided.
  const handleTicketUpdate = useCallback((freshTicket) => {
    if (freshTicket?.id) {
      setTicket(freshTicket);
    } else {
      loadTicket();
    }
  }, [loadTicket]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  // Silently poll every 30 s while the customer is waiting for engineer assignment
  useEffect(() => {
    if (!ticket || ticket.status !== "open" || role !== "customer") return;
    const timer = setInterval(() => loadTicket(true), 30_000);
    return () => clearInterval(timer);
  }, [ticket?.status, role, loadTicket]);

  return (
    <MainLayout maxWidth="max-w-7xl" noPad>
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8">
      {loading && (
        <div className="animate-fade-in space-y-4">
          {/* Back button + hero header placeholder — keeps the loaded state from jumping */}
          <div className="space-y-2">
            <div className="h-4 w-28 shimmer rounded-full" />
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
              <div className="h-3 w-24 shimmer rounded-full mb-1.5" />
              <div className="h-9 w-2/3 shimmer rounded-full mb-2" />
              <div className="h-3 w-4/5 shimmer rounded-full mb-3" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 shimmer rounded-md" />
                <div className="h-5 w-16 shimmer rounded-md" />
                <div className="h-5 w-16 shimmer rounded-md" />
              </div>
            </div>
          </div>

          <div className="ticket-detail-grid">
            <div className="ticket-grid-conversation bg-white border border-slate-200 rounded-2xl p-6">
              <div className="h-4 w-32 shimmer rounded-full mb-4" />
              <div className="space-y-2.5">
                <div className="h-3 shimmer rounded-full" />
                <div className="h-3 w-4/5 shimmer rounded-full" />
                <div className="h-3 w-3/5 shimmer rounded-full" />
              </div>
            </div>
            <div className="ticket-grid-sidebar bg-white border border-slate-200 rounded-2xl p-5">
              <div className="h-3 w-28 shimmer rounded-full mb-4" />
              <div className="space-y-2.5">
                <div className="h-3 shimmer rounded-full" />
                <div className="h-3 w-4/5 shimmer rounded-full" />
                <div className="h-3 w-3/5 shimmer rounded-full" />
              </div>
            </div>
          </div>
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
        <div className="animate-fade-in">
          <TicketDetail ticket={ticket} role={role} onUpdate={handleTicketUpdate} />
        </div>
      )}
    </div>
    </MainLayout>
  );
}
