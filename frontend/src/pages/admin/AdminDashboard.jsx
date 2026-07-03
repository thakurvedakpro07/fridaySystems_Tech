import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import { getAnalytics } from "../../api/analytics";
import { listAdminPayments } from "../../api/payments";
import AppShell from "../../components/layout/AppShell";
import TicketCard from "../../components/tickets/TicketCard";
import { SkeletonCard } from "../../components/ui/Spinner";
import { usePageTitle } from "../../hooks/usePageTitle";

const STATUS_OPTIONS = [
  { value: "",                 label: "All statuses" },
  { value: "open",             label: "Open" },
  { value: "assigned",         label: "Ready to Start" },
  { value: "in_progress",      label: "Work Started" },
  { value: "resolved",         label: "Resolved" },
  { value: "closed",           label: "Closed" },
  { value: "pending_payment",  label: "Pending Payment" },
];

// ── KPI card ─────────────────────────────────────────────────────
const KPI_STYLES = {
  indigo:  { num: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100" },
  emerald: { num: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  amber:   { num: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
  violet:  { num: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100" },
  teal:    { num: "text-teal-600",    bg: "bg-teal-50",    border: "border-teal-100" },
  sky:     { num: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-100" },
  rose:    { num: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100" },
};

function KpiCard({ label, value, sub, color = "indigo", icon, loading }) {
  const s = KPI_STYLES[color] ?? KPI_STYLES.indigo;
  return (
    <div
      className={`bg-white border ${s.border} rounded-2xl px-6 py-5 flex items-start justify-between gap-3
                 hover:-translate-y-0.5 transition-all duration-200 cursor-default`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.07), 0 0 0 1px rgb(0 0 0 / 0.02)" }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        {loading ? (
          <div className="h-10 w-16 shimmer rounded-lg mb-1" />
        ) : (
          <p className={`text-4xl font-black ${s.num} leading-none`}>{value ?? "—"}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-slate-500 mt-2 font-medium truncate">{sub}</p>
        )}
      </div>
      {icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${s.bg} ${s.num}`}>
          {icon}
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────
function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

// ── Admin info panel ──────────────────────────────────────────────
function AdminInfoPanel({ stats, statsLoading, revenue, revenueLoading }) {
  return (
    <div className="space-y-4">
      {/* Revenue highlight */}
      <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl p-5 text-white"
           style={{ boxShadow: "0 4px 20px -4px rgb(13 148 136 / 0.4)" }}>
        <p className="text-[10px] font-semibold text-teal-200 uppercase tracking-widest mb-2">
          Total Revenue
        </p>
        {revenueLoading ? (
          <div className="h-10 w-28 bg-white/20 shimmer rounded-lg" />
        ) : (
          <p className="text-3xl font-black leading-none">
            {revenue != null
              ? `₹${revenue.toLocaleString("en-IN")}`
              : stats.totalRevenue != null
              ? `₹${Number(stats.totalRevenue).toLocaleString("en-IN")}`
              : "₹0"}
          </p>
        )}
        <p className="text-xs text-teal-200 mt-2">From completed payments</p>
      </div>

      {/* Platform health */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Platform Health
        </p>
        <div className="space-y-3">
          {[
            { label: "Active Customers",  value: stats.activeCustomers,  color: "text-sky-600" },
            { label: "Active Engineers",  value: stats.activeFreelancers, color: "text-violet-600" },
            { label: "CSAT Score",        value: stats.csatAvg != null ? `${stats.csatAvg}/5` : null, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-sm font-bold ${color}`}>
                {statsLoading ? "—" : (value ?? "—")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* System status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          System Status
        </p>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-slate-900">All systems operational</span>
        </div>
        <div className="space-y-2">
          {[
            ["Ticket routing",  "operational"],
            ["Payments",        "operational"],
            ["Notifications",   "operational"],
          ].map(([label, status]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs font-semibold text-emerald-600">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Quick Links
        </p>
        <div className="space-y-2">
          {[
            { to: "/admin/analytics",   label: "Full Analytics" },
            { to: "/admin/freelancers", label: "Manage Engineers" },
            { to: "/admin/payments",    label: "Payment Records" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50
                         hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
            >
              {label}
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Admin empty state ─────────────────────────────────────────────
function AdminEmptyState({ hasFilters }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-slate-800 font-semibold text-base mb-2">No tickets match the current filters</p>
        <p className="text-slate-500 text-sm max-w-xs">Try clearing your search or selecting a different status.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
        </svg>
      </div>
      <p className="text-slate-900 font-bold text-lg mb-2">No tickets in the system</p>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
        New tickets appear here as customers create support requests.
      </p>
    </div>
  );
}

// ── AdminDashboard ────────────────────────────────────────────────
export default function AdminDashboard() {
  usePageTitle("Operations");

  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [status, setStatus]           = useState("");
  const [count, setCount]             = useState(0);
  const debounceRef                   = useRef(null);

  const [stats, setStats]               = useState({
    total: 0, open: 0, inProgress: 0, resolved: 0,
    csatAvg: null, activeCustomers: null, activeFreelancers: null, totalRevenue: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [revenue, setRevenue]           = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

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
        total:             data.total,
        open:              data.open,
        inProgress:        data.in_progress,
        resolved:          data.resolved,
        csatAvg:           data.csat_avg,
        activeCustomers:   data.active_customers,
        activeFreelancers: data.active_freelancers,
        totalRevenue:      data.total_revenue,
      }))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    listAdminPayments({ status: "completed" })
      .then(({ data }) => {
        const payments = data.results ?? data;
        const total = payments.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
        setRevenue(total);
      })
      .catch(() => {})
      .finally(() => setRevenueLoading(false));
  }, []);

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
      .catch(() => setError("Could not load tickets. Please refresh."))
      .finally(() => setLoading(false));
  }, [search, status]);

  const hasFilters = !!(search || status);
  const isRevenueLoading = revenueLoading && stats.totalRevenue == null;

  return (
    <AppShell>
      {/* ── Page header ────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
          Operations
        </h1>
        <p className="text-base text-slate-500 mt-1.5">
          {!loading ? `${count} total ticket${count !== 1 ? "s" : ""} across all customers.` : "Loading…"}
        </p>
      </div>

      {/* ── KPI rows ───────────────────────────────────────────── */}
      <div className="mb-8 space-y-6">
        {/* Ticket health */}
        <div>
          <SectionHeader title="Ticket Health" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Tickets" value={stats.total}      sub="all time"            color="indigo"  icon="🎫" loading={statsLoading} />
            <KpiCard label="Open"          value={stats.open}       sub="awaiting assignment" color="amber"   icon="📬" loading={statsLoading} />
            <KpiCard label="Work Started"  value={stats.inProgress} sub="being worked on"     color="violet"  icon="⚡" loading={statsLoading} />
            <KpiCard label="Resolved"      value={stats.resolved}   sub="successfully closed" color="emerald" icon="✅" loading={statsLoading} />
          </div>
        </div>

        {/* Business overview — right panel handles revenue; show customer/engineer counts inline */}
        <div>
          <SectionHeader title="Business Overview">
            <Link to="/admin/analytics" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Full analytics →
            </Link>
          </SectionHeader>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Revenue"
              value={revenue != null
                ? `₹${revenue.toLocaleString("en-IN")}`
                : stats.totalRevenue != null
                ? `₹${Number(stats.totalRevenue).toLocaleString("en-IN")}`
                : null}
              sub="completed payments"
              color="teal"
              icon="💰"
              loading={isRevenueLoading && stats.totalRevenue == null}
            />
            <KpiCard label="Customers"  value={stats.activeCustomers}   sub="registered accounts"    color="sky"    icon="🏢" loading={statsLoading} />
            <KpiCard label="Engineers"  value={stats.activeFreelancers} sub="registered freelancers" color="violet" icon="👨‍💻" loading={statsLoading} />
            <KpiCard
              label="CSAT Score"
              value={stats.csatAvg != null ? `${stats.csatAvg}/5` : null}
              sub="customer satisfaction"
              color="emerald"
              icon="⭐"
              loading={statsLoading}
            />
          </div>
        </div>
      </div>

      {/* ── Two-column: ticket list + right panel ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8 items-start">

        {/* ── Left: all tickets ─────────────────────────────── */}
        <div className="min-w-0">
          <SectionHeader title="All Tickets">
            <Link to="/admin/analytics" className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
              View analytics
            </Link>
          </SectionHeader>

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
              {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
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
            <AdminEmptyState hasFilters={hasFilters} />
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

        {/* ── Right: admin info panel ───────────────────────── */}
        <div className="shrink-0">
          <AdminInfoPanel
            stats={stats}
            statsLoading={statsLoading}
            revenue={revenue}
            revenueLoading={revenueLoading}
          />
        </div>
      </div>
    </AppShell>
  );
}
