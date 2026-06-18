import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getAnalytics } from "../api/analytics";
import MainLayout from "../components/layouts/MainLayout";
import TicketCard from "../components/tickets/TicketCard";
import { SkeletonCard } from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import { useAuthStore } from "../store/authStore";
import { useTickets } from "../hooks/useTickets";
import { usePageTitle } from "../hooks/usePageTitle";
import { getDisplayName } from "../utils/displayName";

const STATUS_OPTIONS = [
  { value: "",                 label: "All statuses" },
  { value: "open",             label: "Open" },
  { value: "assigned",         label: "Assigned" },
  { value: "in_progress",      label: "In Progress" },
  { value: "waiting_customer", label: "Waiting on You" },
  { value: "resolved",         label: "Resolved" },
  { value: "closed",           label: "Closed" },
];

function salutation(name) {
  const h = new Date().getHours();
  const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : base;
}

const STAT_META = {
  indigo:  { text: "text-indigo-600" },
  blue:    { text: "text-blue-600" },
  amber:   { text: "text-amber-600" },
  emerald: { text: "text-emerald-600" },
};

function StatCard({ label, value, sub, color = "indigo", loading }) {
  const { text } = STAT_META[color] ?? STAT_META.indigo;
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
        <p className={`text-2xl font-bold ${text}`}>{value}</p>
      )}
      {sub && !loading && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function GettingStarted() {
  return (
    <div
      className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-2xl p-6 mb-6"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1.5">
            Quick start
          </p>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Ready to resolve your first IT issue?
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md">
            Describe your problem and a vetted engineer is assigned within 2 hours.
            Pay ₹299 consulting fee upfront — refunded if unaccepted.
            Resolution fee only charged after the issue is fully fixed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            to="/tickets/new"
            className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold
                       px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Ticket
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600
                       border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
          >
            Analytics
          </Link>
          <Link
            to="/billing"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600
                       border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
          >
            Billing
          </Link>
        </div>
      </div>
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
  usePageTitle("Dashboard");
  const user = useAuthStore((s) => s.user);

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

  const [stats, setStats]               = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(({ data }) => setStats({
        total:      data.total,
        open:       data.open,
        inProgress: data.in_progress,
        resolved:   data.resolved,
      }))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const name = getDisplayName(user);

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Personalized greeting */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{salutation(name)}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">Track and manage your support requests</p>
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              All systems operational
            </span>
          </div>
        </div>
        <Link
          to="/tickets/new"
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium
                     px-4 py-2 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Ticket
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"       value={stats.total}      sub="all time"           color="indigo"  loading={statsLoading} />
        <StatCard label="Open"        value={stats.open}       sub="awaiting engineer"  color="blue"    loading={statsLoading} />
        <StatCard label="In Progress" value={stats.inProgress} sub="being worked on"    color="amber"   loading={statsLoading} />
        <StatCard label="Resolved"    value={stats.resolved}   sub="successfully fixed" color="emerald" loading={statsLoading} />
      </div>

      {/* Getting started — only shown on zero-ticket accounts */}
      {!statsLoading && stats.total === 0 && <GettingStarted />}

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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
            <option key={s.value} value={s.value}>{s.label}</option>
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
