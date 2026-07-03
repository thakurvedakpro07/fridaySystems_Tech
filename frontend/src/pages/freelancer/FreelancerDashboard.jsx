import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { freelancerListTickets } from "../../api/tickets";
import { getAnalytics } from "../../api/analytics";
import AppShell from "../../components/layout/AppShell";
import TicketCard from "../../components/tickets/TicketCard";
import { SkeletonCard } from "../../components/ui/Spinner";
import { useAuthStore } from "../../store/authStore";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getDisplayName } from "../../utils/displayName";
import { CONTACT } from "../../config/contact";

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

// ── KPI card ─────────────────────────────────────────────────────
const KPI_STYLES = {
  indigo:  { num: "text-indigo-600",  border: "border-indigo-100" },
  emerald: { num: "text-emerald-600", border: "border-emerald-100" },
  amber:   { num: "text-amber-600",   border: "border-amber-100" },
  violet:  { num: "text-violet-600",  border: "border-violet-100" },
};

function KpiCard({ label, value, sub, color = "indigo", loading }) {
  const s = KPI_STYLES[color] ?? KPI_STYLES.indigo;
  return (
    <div
      className={`bg-white border ${s.border} rounded-2xl px-6 py-5
                 hover:-translate-y-0.5 transition-all duration-200 cursor-default`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.07), 0 0 0 1px rgb(0 0 0 / 0.02)" }}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      {loading ? (
        <div className="h-10 w-16 shimmer rounded-lg mb-1" />
      ) : (
        <p className={`text-4xl font-black ${s.num} leading-none`}>{value ?? "—"}</p>
      )}
      {sub && !loading && (
        <p className="text-xs text-slate-500 mt-2 font-medium">{sub}</p>
      )}
    </div>
  );
}

// ── Right info panel ──────────────────────────────────────────────
function FreelancerInfoPanel({ csatAvg, avgHours, csatLoading }) {
  return (
    <div className="space-y-4">
      {/* CSAT score */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Your CSAT Score
        </p>
        {csatLoading ? (
          <div className="h-8 w-24 shimmer rounded-lg" />
        ) : csatAvg != null ? (
          <>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-black text-amber-500 leading-none">
                {csatAvg}
              </span>
              <span className="text-sm text-slate-500 mb-1 font-medium">/ 5.0</span>
            </div>
            <div className="flex items-center gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg
                  key={i}
                  className={`w-4 h-4 ${i <= Math.round(csatAvg) ? "text-amber-400" : "text-slate-200"}`}
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-xs text-slate-500">Average customer rating</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No ratings yet</p>
        )}
      </div>

      {/* Avg resolution */}
      {avgHours != null && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5"
             style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Avg. Resolution Time
          </p>
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-black text-emerald-600 leading-none">{avgHours}</span>
            <span className="text-sm text-slate-500 mb-1">hrs</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Average hours to close a ticket</p>
        </div>
      )}

      {/* System status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Platform Status
        </p>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-slate-900">All systems operational</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Quick Actions
        </p>
        <div className="space-y-2">
          <Link
            to="/analytics"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700
                       text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            View Analytics
          </Link>
          <Link
            to="/notifications"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700
                       text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Notifications
          </Link>
        </div>
      </div>

      {/* Support contact */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-3">
          Support
        </p>
        <div className="space-y-2">
          <a
            href={CONTACT.supportMailto}
            className="flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            {CONTACT.supportEmail}
          </a>
          <p className="text-[11px] text-slate-500 pl-[1.375rem]">{CONTACT.businessHours}</p>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
function AssignmentsEmptyState({ hasFilters }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-slate-800 font-semibold text-base mb-2">No tickets match your filters</p>
        <p className="text-slate-500 text-sm max-w-xs">Try clearing your search or selecting a different status.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 bg-violet-50 rounded-3xl flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <p className="text-slate-900 font-bold text-lg mb-2">No assignments yet</p>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
        You&apos;ll see tickets here once an admin assigns one to you. Keep your profile updated to attract more assignments.
      </p>
    </div>
  );
}

// ── FreelancerDashboard ───────────────────────────────────────────
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
  const [newAssignmentBanner, setNewAssignmentBanner] = useState(false);
  const prevCountRef = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 400);
  };
  const clearSearch = () => { setSearchInput(""); setSearch(""); };

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

  const loadTickets = useCallback((params, silent = false) => {
    if (!silent) setLoading(true);
    return freelancerListTickets(params)
      .then(({ data }) => {
        const list = data.results ?? data;
        const currentCount = data.count ?? list.length;
        if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
          setNewAssignmentBanner(true);
        }
        prevCountRef.current = currentCount;
        setTickets(list);
        setCount(currentCount);
      })
      .catch(() => { if (!silent) setError("Could not load tickets. Please refresh."); })
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    loadTickets(params);
  }, [search, status, loadTickets]);

  // Poll every 30 s for new assignments
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    const id = setInterval(() => loadTickets(params, true), 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const name = getDisplayName(user);
  const hasFilters = !!(search || status);

  return (
    <AppShell>
      {/* ── New assignment banner ─────────────────────────────── */}
      {newAssignmentBanner && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-indigo-600 text-white text-sm font-medium
                        rounded-2xl px-5 py-3.5 shadow-md animate-fade-in">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            New ticket assigned to you!
          </div>
          <button
            onClick={() => setNewAssignmentBanner(false)}
            className="shrink-0 hover:opacity-75 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Greeting ─────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
          {salutation(name)}
        </h1>
        <p className="text-base text-slate-500 mt-1.5">
          {!loading
            ? `You have ${count} ticket${count !== 1 ? "s" : ""} assigned.`
            : "Loading your assignments…"}
        </p>
      </div>

      {/* ── KPI cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Assigned" value={stats.total}    sub="all time"            color="indigo"  loading={statsLoading} />
        <KpiCard label="In Progress"    value={stats.active}   sub="actively working"    color="violet"  loading={statsLoading} />
        <KpiCard label="Resolved"       value={stats.resolved} sub="successfully closed" color="emerald" loading={statsLoading} />
        <KpiCard
          label="Avg Resolution"
          value={stats.avgHours != null ? `${stats.avgHours}h` : null}
          sub="hours to close"
          color="amber"
          loading={statsLoading}
        />
      </div>

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8 items-start">

        {/* ── Left: ticket list ─────────────────────────────── */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">My Assignments</h2>
          </div>

          <div className="flex flex-wrap gap-2.5 mb-5">
            <div className="relative flex-1 min-w-[160px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
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

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          ) : tickets.length === 0 ? (
            <AssignmentsEmptyState hasFilters={hasFilters} />
          ) : (
            <div className="space-y-2.5">
              {tickets.map((ticket, i) => (
                <div key={ticket.id} className="animate-fade-in" style={{ animationDelay: `${i * 35}ms` }}>
                  <TicketCard ticket={ticket} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: info panel ─────────────────────────────── */}
        <div className="shrink-0">
          <FreelancerInfoPanel
            csatAvg={stats.csatAvg}
            avgHours={stats.avgHours}
            csatLoading={statsLoading}
          />
        </div>
      </div>
    </AppShell>
  );
}
