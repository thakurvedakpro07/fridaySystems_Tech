import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import MainLayout from "../../components/layouts/MainLayout";
import TicketCard from "../../components/tickets/TicketCard";
import { usePageTitle } from "../../hooks/usePageTitle";

const STATUS_OPTIONS = ["", "open", "assigned", "in_progress", "waiting_customer", "resolved", "closed", "pending_payment"];

export default function AdminDashboard() {
  usePageTitle("Admin Dashboard");
  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("");
  const [count, setCount]         = useState(0);
  const debounceRef               = useRef(null);

  // Debounce: only update the actual search param 400ms after the user stops typing.
  // Without this, every keystroke fires a new API call.
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

    apiClient.get("/admin/tickets/", { params })
      .then(({ data }) => {
        setTickets(data.results ?? data);
        setCount(data.count ?? (data.results ?? data).length);
      })
      .catch(() => setError("Could not load tickets. Please refresh the page."))
      .finally(() => setLoading(false));
  }, [search, status]);

  return (
    <MainLayout maxWidth="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          {!loading && (
            <p className="text-sm text-gray-400 mt-0.5">{count} ticket{count !== 1 ? "s" : ""}</p>
          )}
        </div>
        <Link
          to="/admin/freelancers"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Manage Freelancers →
        </Link>
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
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
          {tickets.length === 0 && (
            <p className="text-gray-400 text-center py-12">No tickets match the current filters.</p>
          )}
        </div>
      )}
    </MainLayout>
  );
}
