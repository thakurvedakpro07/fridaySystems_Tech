/**
 * FreelancerDashboard — shows all tickets assigned to the logged-in freelancer.
 * Uses the /api/freelancer/tickets/ endpoint which filters by the caller's profile.
 */
import { useEffect, useRef, useState } from "react";
import { freelancerListTickets } from "../../api/tickets";
import MainLayout from "../../components/layouts/MainLayout";
import TicketCard from "../../components/tickets/TicketCard";

const STATUS_OPTIONS = ["", "assigned", "in_progress", "waiting_customer", "resolved", "closed"];

export default function FreelancerDashboard() {
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [count, setCount]           = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]         = useState("");
  const [status, setStatus]         = useState("");
  const debounceRef                 = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 400);
  };

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;

    freelancerListTickets(params)
      .then(({ data }) => {
        setTickets(data.results ?? data);
        setCount(data.count ?? (data.results ?? data).length);
      })
      .catch(() => setError("Could not load tickets. Please refresh the page."))
      .finally(() => setLoading(false));
  }, [search, status]);

  return (
    <MainLayout maxWidth="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
        {!loading && (
          <p className="text-sm text-gray-400 mt-0.5">{count} ticket{count !== 1 ? "s" : ""} assigned to you</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search tickets…"
          value={searchInput}
          onChange={handleSearchChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
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

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading…</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            {search || status ? "No tickets match your filters." : "No tickets assigned to you yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
