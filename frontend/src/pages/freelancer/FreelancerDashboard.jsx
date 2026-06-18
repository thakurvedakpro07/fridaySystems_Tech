import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { freelancerListTickets } from "../../api/tickets";
import { getAnalytics } from "../../api/analytics";
import MainLayout from "../../components/layouts/MainLayout";
import TicketCard from "../../components/tickets/TicketCard";
import { SkeletonCard } from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { useAuthStore } from "../../store/authStore";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getDisplayName } from "../../utils/displayName";

const STATUS_OPTIONS = [
  { value: "",                 label: "All statuses" },
  { value: "assigned",         label: "Assigned" },
  { value: "in_progress",      label: "In Progress" },
  { value: "waiting_customer", label: "Waiting on Customer" },
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
  emerald: { text: "text-emerald-600" },
  amber:   { text: "text-amber-600" },
  violet:  { text: "text-violet-600" },
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
        <p className={`text-2xl font-bold ${text}`}>{value ?? "—"}</p>
      )}
      {sub && !loading && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function FreelancerDashboard() {
  usePageTitle("My Assignments");
  const user = useAuthStore((s) => s.user);

  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [count, setCount]             = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [status, setStatus]           = useState("");
  const debounceRef                   = useRef(null);

  const [stats, setStats]               = useState({ total: 0, active: 0, resolved: 0, csatAvg: null, avgHours: null });
  const [statsLoading, setStatsLoading] = useState(true);

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

  useEffect(() => {
    getAnalytics()
      .then(({ data }) => setStats({
        total:    data.total,
        active:   data.in_progress,
        resolved: data.resolved,
        csatAvg:  data.csat_avg,
        avgHours: data.avg_resolution_hours,
      }))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
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

  const name = getDisplayName(user);

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Personalized greeting */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{salutation(name)}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">
              {!loading ? `${count} ticket${count !== 1 ? "s" : ""} assigned to you` : "Loading assignments…"}
            </p>
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              All systems operational
            </span>
          </div>
        </div>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600
                     border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3.5 py-2
                     rounded-lg transition-all shadow-sm shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          Analytics
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Assigned" value={stats.total}    sub="all time"          color="indigo"  loading={statsLoading} />
        <StatCard label="In Progress"    value={stats.active}   sub="actively working"  color="violet"  loading={statsLoading} />
        <StatCard label="Resolved"       value={stats.resolved} sub="successfully closed" color="emerald" loading={statsLoading} />
        <StatCard
          label="Avg Resolution"
          value={stats.avgHours != null ? `${stats.avgHours}h` : null}
          sub="hours to close"
          color="amber"
          loading={statsLoading}
        />
      </div>

      {/* CSAT panel — shown when rating data exists */}
      {!statsLoading && stats.csatAvg != null && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4"
             style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-0.5">Customer satisfaction</p>
            <p className="text-sm font-semibold text-slate-900">
              {stats.csatAvg}/5.0
              <span className="text-xs text-slate-400 font-normal ml-1.5">average rating</span>
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg key={i} className={`w-4 h-4 ${i <= Math.round(stats.csatAvg) ? "text-amber-400" : "text-slate-200"}`}
                   fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
      )}

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
