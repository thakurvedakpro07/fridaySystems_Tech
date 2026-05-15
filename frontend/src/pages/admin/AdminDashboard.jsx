/**
 * Admin Dashboard — summary stats and all tickets.
 * Only accessible to staff users (is_staff=true in Django).
 */
import { useEffect, useState } from "react";
import apiClient from "../../api/client";
import Header from "../../components/layout/Header";
import TicketCard from "../../components/tickets/TicketCard";

export default function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/admin/tickets/")
      .then(({ data }) => setTickets(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
            {tickets.length === 0 && (
              <p className="text-gray-400 text-center py-12">No tickets yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
