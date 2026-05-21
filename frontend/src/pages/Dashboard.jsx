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

const STAT_COLORS = {
  indigo:  { text: "text-indigo-600", bg: "bg-indigo-50" },
  blue:    { text: "text-blue-600",   bg: "bg-blue-50" },
  amber:   { text: "text-amber-600",  bg: "bg-amber-50" },
  emerald: { text: "text-emerald-600",bg: "bg-emerald-50" },
  slate:   { text: "text-slate-600",  bg: "bg-slate-100" },
};

function StatCard({ label, value, color = "indigo", loading }) {
  const { text, bg } = STAT_COLORS[color] ?? STAT_COLORS.indigo;
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl px-5 py-4
                 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 cursor-default"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-10 shimmer rounded-md" />
      ) : (
        <p className={`text-2xl font-bold animate-fade-in ${text}`}>{value}</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (user?.is_staff) return <Navigate to="/admin" replace />;
  if (user?.role === "freelancer") return <Navigate to="/freelancer" replace />;
  return <CustomerDashboard />;
}

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

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const filters = {};
  if (search) filters.search = search;
  if (status) filters.status = status;

  const { tickets, loading, error } = useTickets(filters);
  const allTickets = useTickets({});

  const stats = {
    total:      allTickets.tickets.length,
    open:       allTickets.tickets.filter((t) => t.status === "open").length,
    inProgress: allTickets.tickets.filter((t) => ["assigned", "in_progress", "waiting_customer"].includes(t.status)).length,
    resolved:   allTickets.tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length,
  };

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Tickets</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage your support requests</p>
        </div>
        <Link
          to="/tickets/new"
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium
                     px-4 py-2 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Ticket
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"       value={stats.total}      color="indigo"  loading={allTickets.loading} />
        <StatCard label="Open"        value={stats.open}       color="blue"    loading={allTickets.loading} />
        <StatCard label="In Progress" value={stats.inProgress} color="amber"   loading={allTickets.loading} />
        <StatCard label="Resolved"    value={stats.resolved}   color="emerald" loading={allTickets.loading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 mb-5">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search tickets…"
            value={searchInput}
            onChange={handleSearchChange}
            className={`input-base pl-9 ${searchInput ? "pr-8" : ""}`}
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                         hover:text-slate-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input-base w-auto"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s ? s.replaceAll("_", " ") : "All statuses"}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Failed to load tickets. Please refresh.
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <EmptyState
          icon={search || status ? "🔍" : "🎫"}
          title={search || status ? "No tickets match your filters" : "No tickets yet"}
          description={search || status
            ? "Try adjusting your search or selecting a different status."
            : "Describe your issue and a vetted engineer will be assigned within the SLA window."}
          action={!search && !status && (
            <Link
              to="/tickets/new"
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium
                         px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Open your first ticket
            </Link>
          )}
        />
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="space-y-2.5">
          {tickets.map((ticket, i) => (
            <div
              key={ticket.id}
              className="animate-fade-in animate-stagger"
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <TicketCard ticket={ticket} />
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
