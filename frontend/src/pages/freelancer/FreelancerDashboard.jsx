import { useEffect, useRef, useState } from "react";
import { freelancerListTickets } from "../../api/tickets";
import MainLayout from "../../components/layouts/MainLayout";
import TicketCard from "../../components/tickets/TicketCard";
import { SkeletonCard } from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { usePageTitle } from "../../hooks/usePageTitle";

const STATUS_OPTIONS = ["", "assigned", "in_progress", "waiting_customer", "resolved", "closed"];

function StatCard({ label, value, color = "indigo", loading }) {
  const textColors = { indigo: "text-indigo-600", emerald: "text-emerald-600", amber: "text-amber-600", violet: "text-violet-600" };
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-10 bg-slate-100 rounded-md animate-skeleton-pulse" />
      ) : (
        <p className={`text-2xl font-bold ${textColors[color] ?? "text-slate-900"}`}>{value}</p>
      )}
    </div>
  );
}

export default function FreelancerDashboard() {
  usePageTitle("My Assigned Tickets");
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [count, setCount]           = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]         = useState("");
  const [status, setStatus]         = useState("");
  const debounceRef                 = useRef(null);
  const [allTickets, setAllTickets] = useState([]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 400);
  };

  useEffect(() => {
    freelancerListTickets({})
      .then(({ data }) => setAllTickets(data.results ?? data))
      .catch(() => {});
  }, []);

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
      .catch(() => setError("Could not load tickets. Please refresh."))
      .finally(() => setLoading(false));
  }, [search, status]);

  const stats = {
    total:      allTickets.length,
    active:     allTickets.filter((t) => t.status === "in_progress").length,
    waiting:    allTickets.filter((t) => t.status === "waiting_customer").length,
    resolved:   allTickets.filter((t) => ["resolved", "closed"].includes(t.status)).length,
  };

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">My Assigned Tickets</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {!loading ? `${count} ticket${count !== 1 ? "s" : ""} assigned to you` : "Loading…"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Assigned" value={stats.total}    color="indigo"  loading={allTickets.length === 0 && loading} />
        <StatCard label="In Progress"    value={stats.active}   color="violet"  loading={allTickets.length === 0 && loading} />
        <StatCard label="Waiting"        value={stats.waiting}  color="amber"   loading={allTickets.length === 0 && loading} />
        <StatCard label="Resolved"       value={stats.resolved} color="emerald" loading={allTickets.length === 0 && loading} />
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
            className="input-base pl-9"
          />
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
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={search || status ? "🔍" : "📋"}
          title={search || status ? "No tickets match your filters" : "No tickets assigned yet"}
          description={search || status
            ? "Try clearing your search or selecting a different status."
            : "You'll see tickets here once an admin assigns one to you."}
        />
      ) : (
        <div className="space-y-2.5">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
