import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import TicketCard from "../components/tickets/TicketCard";
import { useTickets } from "../hooks/useTickets";

export default function Dashboard() {
  const { tickets, loading, error } = useTickets();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          <Link
            to="/tickets/new"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + New Ticket
          </Link>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-400">Loading tickets…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            Failed to load tickets: {error}
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No tickets yet.</p>
            <Link
              to="/tickets/new"
              className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700"
            >
              Open your first ticket
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
