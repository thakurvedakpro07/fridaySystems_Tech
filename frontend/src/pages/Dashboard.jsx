import { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import MainLayout from "../components/layouts/MainLayout";
import TicketCard from "../components/tickets/TicketCard";
import { SkeletonCard } from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import { useAuthStore } from "../store/authStore";
import { useTickets } from "../hooks/useTickets";
import { usePageTitle } from "../hooks/usePageTitle";

const STATUS_OPTIONS = ["", "open", "assigned", "in_progress", "waiting_customer", "resolved", "closed"];

/**
 * Dashboard — the post-login landing page.
 *
 * This component acts as a role router:
 *   - Admin    → redirect to /admin (they have no customer profile)
 *   - Freelancer → redirect to /freelancer (FreelancerDashboard)
 *   - Customer  → renders CustomerDashboard with the ticket list
 *
 * WHY the split into two components?
 * React's Rules of Hooks say you cannot call a hook after a conditional
 * return statement. useTickets() calls GET /api/tickets/ which requires
 * IsCustomer permission — calling it for admins/freelancers would generate
 * 403 errors. Moving it into <CustomerDashboard> (only rendered for real
 * customers) keeps the hook call safe and avoids unnecessary HTTP requests.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  if (user?.is_staff) {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === "freelancer") {
    return <Navigate to="/freelancer" replace />;
  }

  return <CustomerDashboard />;
}

/**
 * CustomerDashboard — the ticket list view for customers.
 * Only rendered after Dashboard confirms the user is a customer,
 * so useTickets() (which calls the IsCustomer-protected endpoint) is safe here.
 */
function CustomerDashboard() {
  usePageTitle("My Tickets");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [status, setStatus]           = useState("");
  const debounceRef                   = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 400);
  };

  const filters = {};
  if (search) filters.search = search;
  if (status) filters.status = status;

  const { tickets, loading, error } = useTickets(filters);

  return (
    <MainLayout maxWidth="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
        <Link
          to="/tickets/new"
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Ticket
        </Link>
      </div>

      {/* Search and filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search tickets…"
          value={searchInput}
          onChange={handleSearchChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s ? s.replaceAll("_", " ") : "All statuses"}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          Failed to load tickets: {error}
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <EmptyState
          icon={search || status ? "🔍" : "🎫"}
          title={search || status ? "No tickets match your filters" : "No tickets yet"}
          description={search || status ? "Try adjusting your search or filter." : "Open a ticket and our team will get back to you."}
          action={!search && !status && (
            <Link
              to="/tickets/new"
              className="inline-flex items-center bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700"
            >
              Open your first ticket
            </Link>
          )}
        />
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
