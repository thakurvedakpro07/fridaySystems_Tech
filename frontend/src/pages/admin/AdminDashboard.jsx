import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import { getAnalytics } from "../../api/analytics";
import { listAdminPayments } from "../../api/payments";
import MainLayout from "../../components/layouts/MainLayout";
import TicketCard from "../../components/tickets/TicketCard";
import { SkeletonCard } from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { usePageTitle } from "../../hooks/usePageTitle";

const STATUS_OPTIONS = [
  { value: "",                 label: "All statuses" },
  { value: "open",             label: "Open" },
  { value: "assigned",         label: "Assigned" },
  { value: "in_progress",      label: "In Progress" },
  { value: "waiting_customer", label: "Waiting on Customer" },
  { value: "resolved",         label: "Resolved" },
  { value: "closed",           label: "Closed" },
  { value: "pending_payment",  label: "Pending Payment" },
];

const STAT_META = {
  indigo:  { text: "text-indigo-600",  bg: "bg-indigo-50" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-50" },
  amber:   { text: "text-amber-600",   bg: "bg-amber-50" },
  rose:    { text: "text-rose-600",    bg: "bg-rose-50" },
  violet:  { text: "text-violet-600",  bg: "bg-violet-50" },
  teal:    { text: "text-teal-600",    bg: "bg-teal-50" },
  sky:     { text: "text-sky-600",     bg: "bg-sky-50" },
};

function StatCard({ label, value, sub, color = "indigo", icon, loading }) {
  const { text, bg } = STAT_META[color] ?? STAT_META.indigo;
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-start justify-between gap-3
                 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 cursor-default"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-12 shimmer rounded-md" />
        ) : (
          <p className={`text-2xl font-bold ${text}`}>{value ?? "—"}</p>
        )}
        {sub && !loading && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
      {icon && (
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${bg} ${text}`}>
          {icon}
        </span>
      )}
    </div>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  usePageTitle("Admin Dashboard");
  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [status, setStatus]           = useState("");
  const [count, setCount]             = useState(0);
  const debounceRef                   = useRef(null);

  const [stats, setStats]               = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, csatAvg: null, activeCustomers: null, activeFreelancers: null });
  const [statsLoading, setStatsLoading] = useState(true);
  const [revenue, setRevenue]           = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

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
        total:            data.total,
        open:             data.open,
        inProgress:       data.in_progress,
        resolved:         data.resolved,
        csatAvg:          data.csat_avg,
        activeCustomers:  data.active_customers,
        activeFreelancers: data.active_freelancers,
        totalRevenue:     data.total_revenue,
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

  const isRevenueLoading = revenueLoading && stats.totalRevenue == null;

  return (
    <MainLayout maxWidth="max-w-5xl">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operations</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-slate-500">
              {!loading ? `${count} total ticket${count !== 1 ? "s" : ""}` : "Loading…"}
            </p>
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              All systems operational
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/payments"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600
                       border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3.5 py-2
                       rounded-lg transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            Payments
          </Link>
          <Link
            to="/admin/freelancers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600
                       border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3.5 py-2
                       rounded-lg transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Engineers
          </Link>
        </div>
      </div>

      {/* KPI row 1 — ticket health */}
      <div className="mb-3">
        <SectionHeader title="Ticket health" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Tickets" value={stats.total}      sub="all time"         color="indigo"  icon="🎫" loading={statsLoading} />
          <StatCard label="Open"          value={stats.open}       sub="awaiting assignment" color="amber" icon="📬" loading={statsLoading} />
          <StatCard label="In Progress"   value={stats.inProgress} sub="being worked on"  color="violet"  icon="⚡" loading={statsLoading} />
          <StatCard label="Resolved"      value={stats.resolved}   sub="successfully closed" color="emerald" icon="✅" loading={statsLoading} />
        </div>
      </div>

      {/* KPI row 2 — business overview */}
      <div className="mb-6">
        <SectionHeader title="Business overview">
          <Link to="/admin/analytics" className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors">
            Full analytics →
          </Link>
        </SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Revenue"
            value={revenue != null ? `₹${revenue.toLocaleString("en-IN")}` : (stats.totalRevenue != null ? `₹${Number(stats.totalRevenue).toLocaleString("en-IN")}` : null)}
            sub="completed payments"
            color="teal"
            icon="💰"
            loading={isRevenueLoading && stats.totalRevenue == null}
          />
          <StatCard
            label="Active Customers"
            value={stats.activeCustomers}
            sub="registered accounts"
            color="sky"
            icon="🏢"
            loading={statsLoading}
          />
          <StatCard
            label="Active Engineers"
            value={stats.activeFreelancers}
            sub="registered freelancers"
            color="violet"
            icon="👨‍💻"
            loading={statsLoading}
          />
          <StatCard
            label="CSAT Score"
            value={stats.csatAvg != null ? `${stats.csatAvg}/5` : null}
            sub="customer satisfaction"
            color="emerald"
            icon="⭐"
            loading={statsLoading}
          />
        </div>
      </div>

      {/* Ticket list section */}
      <SectionHeader title="All tickets">
        <Link to="/admin/analytics" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
          View analytics
        </Link>
      </SectionHeader>

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
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
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
          icon="🔍"
          title="No tickets match the current filters"
          description="Try clearing your search or selecting a different status."
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
