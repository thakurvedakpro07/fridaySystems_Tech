import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getOpsDashboard, getOpsTickets, getOpsFreelancers, getOpsAnalytics } from "../../api/ops";
import { getAnalytics } from "../../api/analytics";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRoles } from "../../hooks/useRoles";
import KpiCard from "../../components/dashboard/KpiCard";
import KpiRow from "../../components/dashboard/KpiRow";
import DashboardSection from "../../components/dashboard/DashboardSection";
import SLABadge from "../../components/dashboard/SLABadge";
import EngineerWorkloadBars from "../../components/dashboard/EngineerWorkloadBars";
import Sparkline from "../../components/dashboard/charts/Sparkline";
import Donut from "../../components/dashboard/charts/Donut";
import BarRow from "../../components/dashboard/charts/BarRow";
import Badge from "../../components/ui/Badge";
import Alert from "../../components/ui/Alert";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";

// ── Shared tokens ─────────────────────────────────────────────────
const KPI_STYLES = {
  indigo:  { num: "text-indigo-600",  border: "border-indigo-100" },
  emerald: { num: "text-emerald-600", border: "border-emerald-100" },
  amber:   { num: "text-amber-600",   border: "border-amber-100" },
  violet:  { num: "text-violet-600",  border: "border-violet-100" },
  sky:     { num: "text-sky-600",     border: "border-sky-100" },
  rose:    { num: "text-rose-600",    border: "border-rose-100" },
  orange:  { num: "text-orange-600",  border: "border-orange-100" },
};


const PAYMENT_TYPE_LABEL = {
  consulting_fee: "Consulting Fee",
  resolution_fee: "Resolution Fee",
  subscription:   "Subscription",
  refund:         "Refund",
};

const PAYMENT_TYPE_COLOR = {
  consulting_fee: "#4f46e5",
  resolution_fee: "#0ea5e9",
  subscription:   "#7c3aed",
  refund:         "#ef4444",
};

// "Tickets by Status" donut — reuses the exact counts already returned by
// GET /api/ops/dashboard/ (no extra request), colored to match this app's
// existing status badge palette (Badge's "ticketStatus" domain: open=blue,
// assigned=violet, in_progress=indigo, pending_payment=amber, resolved=emerald,
// closed=slate) so this chart never disagrees with the Badge pills rendered
// for the same statuses elsewhere on this page.
const STATUS_CHART_SEGMENTS = [
  { key: "open",             label: "Open (Unassigned)", color: "#3b82f6" },
  { key: "assigned",         label: "Ready to Start",    color: "#8b5cf6" },
  { key: "in_progress",      label: "Work Started",      color: "#4f46e5" },
  { key: "pending_payment",  label: "Pending Payment",   color: "#f59e0b" },
  { key: "resolved",         label: "Resolved",          color: "#10b981" },
  { key: "closed",           label: "Closed",            color: "#94a3b8" },
];

// ── Icons ─────────────────────────────────────────────────────────
const IC = {
  ticket: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  assign: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  eng: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  payment: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-9-9.75h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z" />
    </svg>
  ),
};

// "Tickets by Service Type" — same eight values/order as the Ticket Queue's
// own service filter (OpsTicketQueue.jsx's SERVICE_OPTIONS), kept as a
// separate local copy since that file doesn't export its constants and
// each dashboard/page in this app already defines its own small constants
// rather than sharing them cross-file.
const SERVICE_TYPES = [
  { value: "laptop_desktop",  label: "Laptop / Desktop" },
  { value: "server_admin",    label: "Server Administration" },
  { value: "aws",              label: "AWS" },
  { value: "azure",            label: "Azure" },
  { value: "kubernetes",       label: "Kubernetes" },
  { value: "database",         label: "Database" },
  { value: "devops_cicd",      label: "DevOps CI/CD" },
  { value: "infra_automation", label: "Infrastructure Automation" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function fmtCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

export default function OpsDashboard() {
  usePageTitle("Operations Dashboard — ResolveHQ");
  const { isSuperAdmin, isOpsManager, isFinanceManager } = useRoles();
  const canSeeWorkload  = isOpsManager || isSuperAdmin;
  const canSeeFinancial = isFinanceManager || isSuperAdmin;
  // Mirrors the exact role sets the router already enforces for these two
  // destinations (App.jsx's OpsManagerRoute / PaymentRoute) — a Quick
  // Action shouldn't link somewhere the viewer's own role would immediately
  // 403 out of.
  const canOpenAssignments = isOpsManager || isSuperAdmin;
  const canOpenPayments = isOpsManager || isFinanceManager || isSuperAdmin;

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [openTickets, setOpenTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [error, setError] = useState(null);

  const [freelancers, setFreelancers] = useState([]);
  const [freelancersLoading, setFreelancersLoading] = useState(canSeeWorkload);

  // `analytics` holds the full GET /api/ops/analytics/ response — its
  // `.operational` slice feeds the "Resolved (Last 30 Days)" KPI card
  // (base, all roles) and its `.financial` slice feeds the existing
  // Finance-only sections further down. Previously this was only fetched
  // for canSeeFinancial roles and narrowed immediately to `.financial`;
  // now fetched unconditionally since every staff role gets at least one
  // of the two slices (backend: operational for ops_manager/support_agent/
  // super_admin, financial for finance_manager/super_admin).
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Derived, client-side-only counts that have no direct field in any
  // existing API response: "High Priority Tickets" (severity=high +
  // severity=critical) and the "Tickets by Service Type" chart (one count
  // per service type). Each is a lightweight page_size=1 request against
  // the existing GET /api/ops/tickets/ endpoint — DRF's paginated `count`
  // reflects the full filtered total regardless of page size, so this gets
  // an exact count per bucket without downloading the matching rows.
  const [highPriorityCount, setHighPriorityCount] = useState(null);
  const [serviceTypeCounts, setServiceTypeCounts] = useState(null);
  const [derivedLoading, setDerivedLoading] = useState(true);

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(isSuperAdmin);

  const load = useCallback(async () => {
    setStatsLoading(true);
    setTicketsLoading(true);
    setRecentLoading(true);
    setError(null);
    try {
      const [dashRes, ticketsRes, recentRes] = await Promise.all([
        getOpsDashboard(),
        getOpsTickets({ status: "open", ordering: "-created_at" }),
        getOpsTickets({ ordering: "-created_at", page_size: 10 }),
      ]);
      setStats(dashRes.data);
      setOpenTickets(ticketsRes.data?.results ?? ticketsRes.data ?? []);
      setRecentTickets(recentRes.data?.results ?? recentRes.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load dashboard.");
    } finally {
      setStatsLoading(false);
      setTicketsLoading(false);
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canSeeWorkload) return;
    setFreelancersLoading(true);
    getOpsFreelancers()
      .then(({ data }) => setFreelancers(data ?? []))
      .catch(() => {})
      .finally(() => setFreelancersLoading(false));
  }, [canSeeWorkload]);

  useEffect(() => {
    setAnalyticsLoading(true);
    getOpsAnalytics()
      .then(({ data }) => setAnalytics(data ?? null))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDerivedLoading(true);
    Promise.all([
      getOpsTickets({ priority: "high", page_size: 1 }),
      getOpsTickets({ priority: "critical", page_size: 1 }),
      ...SERVICE_TYPES.map((s) => getOpsTickets({ service_type: s.value, page_size: 1 })),
    ])
      .then(([highRes, criticalRes, ...serviceResults]) => {
        if (cancelled) return;
        setHighPriorityCount((highRes.data?.count ?? 0) + (criticalRes.data?.count ?? 0));
        setServiceTypeCounts(
          SERVICE_TYPES.reduce((acc, s, i) => {
            acc[s.value] = serviceResults[i].data?.count ?? 0;
            return acc;
          }, {})
        );
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDerivedLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setOverviewLoading(true);
    getAnalytics()
      .then(({ data }) => setOverview({
        activeCustomers:   data.active_customers,
        activeFreelancers: data.active_freelancers,
        csatAvg:           data.csat_avg,
        totalRevenue:      data.total_revenue,
      }))
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, [isSuperAdmin]);

  // `revenue` is entirely absent from the response for Support Agents
  // (backend-enforced — see ops_dashboard's is_support_agent check), not
  // zero. Check key presence, not truthiness, so we don't render "₹0"
  // for a role that isn't authorized to see revenue at all.
  const hasRevenue = !statsLoading && stats && Object.prototype.hasOwnProperty.call(stats, "revenue");

  // `.operational` is likewise absent for Finance Manager (backend gates it
  // to ops_manager/support_agent/super_admin — see ops_analytics). "Resolved
  // (Last 30 Days)" approximates true "resolved today" (no resolution-date
  // field is exposed by any current API — see Phase 1 note below) using
  // by_status among tickets *created* in the last 30 days, which is real,
  // already-computed backend data rather than a fabricated number.
  const hasOperational = !analyticsLoading && Boolean(analytics?.operational);
  const opByStatus = analytics?.operational?.by_status;
  const resolvedLast30 = hasOperational ? (opByStatus?.resolved ?? 0) + (opByStatus?.closed ?? 0) : null;

  // Busiest-first, matching EngineerWorkloadBars' own sort convention for
  // the same BarRow component.
  const serviceTypeChartData = serviceTypeCounts
    ? [...SERVICE_TYPES]
        .map((s) => ({ label: s.label, value: serviceTypeCounts[s.value] ?? 0 }))
        .sort((a, b) => b.value - a.value)
    : [];

  const financial = analytics?.financial ?? null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader title="Operations Dashboard" description="Ticket queue overview and freelancer assignment management." />
          <Link to="/operations/tickets"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                       px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            Manage Tickets
          </Link>
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        {/* KPI grid — base for all staff roles (Phase 1 dashboard cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: "Total Open Tickets", value: stats?.total_active, color: "indigo", sub: "Open, assigned & in progress", icon: IC.ticket, to: "/operations/tickets", loading: statsLoading, delay: 0 },
            { label: "Unassigned Tickets", value: stats?.unassigned, color: "violet", sub: "Awaiting engineer assignment", icon: IC.assign, to: "/operations/tickets?status=open", loading: statsLoading, delay: 0.04 },
            { label: "Work Started", value: stats?.in_progress, color: "amber", sub: "Actively being worked", icon: IC.clock, to: "/operations/tickets?status=in_progress", loading: statsLoading, delay: 0.08 },
            { label: "Pending Payment", value: stats?.pending_payment, color: "rose", sub: "Awaiting customer payment", icon: IC.payment, to: "/operations/tickets?status=pending_payment", loading: statsLoading, delay: 0.12 },
            {
              label: "Resolved (Last 30 Days)", value: resolvedLast30, color: "emerald",
              sub: hasOperational ? "Resolved/closed, created in last 30 days" : "Not available for this role",
              icon: IC.check, to: "/operations/tickets?status=resolved", loading: statsLoading || analyticsLoading, delay: 0.16,
            },
            {
              label: "High Priority Tickets", value: highPriorityCount, color: "orange",
              sub: "High & critical severity", icon: IC.alert, to: "/operations/tickets?priority=high",
              loading: derivedLoading, delay: 0.2,
            },
          ].map(({ delay, ...kpi }) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
              <KpiCard {...kpi} />
            </motion.div>
          ))}
        </div>

        {/* Secondary row — Ops Manager + Super Admin only (engineer load context) */}
        {canSeeWorkload && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
              <KpiCard label="Active Engineers" value={stats?.active_freelancers} color="violet"
                sub="Approved & available" icon={IC.eng} loading={statsLoading} to="/operations/freelancers" />
            </motion.div>
          </div>
        )}

        {/* Revenue tile — Finance Manager + Super Admin only */}
        {canSeeFinancial && hasRevenue && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
            <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl px-6 py-5 text-white flex items-center justify-between"
                 style={{ boxShadow: "0 4px 20px -4px rgb(13 148 136 / 0.35)" }}>
              <div>
                <p className="text-[10px] font-bold text-teal-200 uppercase tracking-widest mb-2">
                  Platform Revenue
                </p>
                <p className="text-4xl font-black leading-none">{fmtCurrency(stats.revenue)}</p>
                <p className="text-xs text-teal-200 mt-2">From completed payments</p>
              </div>
              <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </motion.div>
        )}

        {/* Tickets by Status / Tickets by Service Type — base for all staff */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <DashboardSection title="Tickets by Status" description="Current distribution across the pipeline">
              {statsLoading ? (
                <Skeleton className="h-24 rounded-lg" />
              ) : (
                <Donut segments={STATUS_CHART_SEGMENTS.map((s) => ({ label: s.label, value: stats?.[s.key] ?? 0, color: s.color }))} />
              )}
            </DashboardSection>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
            <DashboardSection title="Tickets by Service Type" description="Ticket volume per service, busiest first">
              {derivedLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => <Skeleton key={n} className="h-6 rounded-lg" />)}
                </div>
              ) : serviceTypeChartData.every((d) => d.value === 0) ? (
                <p className="text-sm text-slate-500 text-center py-6">No data yet</p>
              ) : (
                <BarRow data={serviceTypeChartData} color="#4f46e5" valueFormatter={(v) => `${v} ticket${v !== 1 ? "s" : ""}`} />
              )}
            </DashboardSection>
          </motion.div>
        </div>

        {/* Engineer Workload — Ops Manager + Super Admin only */}
        {canSeeWorkload && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <DashboardSection title="Engineer Workload" description="Active tickets per engineer, busiest first" viewAllTo="/operations/freelancers">
              <EngineerWorkloadBars freelancers={freelancers} loading={freelancersLoading} />
            </DashboardSection>
          </motion.div>
        )}

        {/* Open tickets needing assignment — base for all staff */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <DashboardSection
            title="Unassigned Open Tickets"
            description="Tickets paid and waiting for an engineer"
            viewAllTo="/operations/tickets?status=open"
          >
            {ticketsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : openTickets.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">All open tickets are assigned</p>
                <p className="text-xs text-slate-500 mt-1">No unassigned tickets at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 -m-6">
                {openTickets.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-semibold text-slate-500">{t.ticket_number}</span>
                        {t.severity && <Badge domain="severity" label={t.severity} />}
                        <Badge label={t.service_type?.replace(/_/g, " ") ?? "—"} />
                        {t.sla_status && <SLABadge status={t.sla_status} />}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(t.created_at)}</p>
                    </div>
                    <Link to={`/operations/tickets?highlight=${t.id}`}
                      className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200
                                 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors">
                      Assign →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        </motion.div>

        {/* Recent Activity — base for all staff. No cross-ticket "activity
            log" endpoint exists (getOpsTicketHistory is per-ticket only),
            so this uses the 10 most recently *created* tickets — each row
            still shows the ticket's current status — as the closest
            available proxy for "recent updates" using only existing data. */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.31 }}>
          <DashboardSection
            title="Recent Activity"
            description="10 most recently created tickets"
            viewAllTo="/operations/tickets"
          >
            {recentLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : recentTickets.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No tickets yet.</p>
            ) : (
              <div className="divide-y divide-slate-50 -m-6">
                {recentTickets.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-semibold text-slate-500">{t.ticket_number}</span>
                        <Badge domain="ticketStatus" label={t.status} />
                        <Badge label={t.service_type?.replace(/_/g, " ") ?? "—"} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(t.created_at)}</p>
                    </div>
                    <Link to={`/operations/tickets?highlight=${t.id}`}
                      className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200
                                 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors">
                      View →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        </motion.div>

        {/* Business Overview — Super Admin only */}
        {isSuperAdmin && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            <DashboardSection title="Business Overview" description="Platform-wide health at a glance">
              <KpiRow
                columns={4}
                items={[
                  { label: "Total Revenue", value: overview ? fmtCurrency(overview.totalRevenue) : null, sub: "completed payments", color: "teal", loading: overviewLoading },
                  { label: "Customers",     value: overview?.activeCustomers,   sub: "registered accounts",    color: "sky",     loading: overviewLoading },
                  { label: "Engineers",     value: overview?.activeFreelancers, sub: "registered freelancers", color: "violet",  loading: overviewLoading },
                  { label: "CSAT Score",    value: overview?.csatAvg != null ? `${overview.csatAvg}/5` : null, sub: "customer satisfaction", color: "emerald", loading: overviewLoading },
                ]}
              />
            </DashboardSection>
          </motion.div>
        )}

        {/* Revenue Trend + Payment Split — Finance Manager + Super Admin only */}
        {canSeeFinancial && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
              <DashboardSection title="Revenue Trend" description="Completed payments by month">
                {analyticsLoading ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : (
                  <Sparkline
                    data={(financial?.monthly_revenue ?? []).map((m) => ({ label: m.month, value: m.total }))}
                    color="#0d9488"
                    valueFormatter={fmtCurrency}
                  />
                )}
              </DashboardSection>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
              <DashboardSection title="Payment Type Split" description="Revenue by payment type">
                {analyticsLoading ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : (
                  <Donut
                    segments={(financial?.revenue_by_type ?? []).map((r) => ({
                      label: PAYMENT_TYPE_LABEL[r.payment_type] ?? r.payment_type,
                      value: r.total,
                      color: PAYMENT_TYPE_COLOR[r.payment_type] ?? "#94a3b8",
                    }))}
                  />
                )}
              </DashboardSection>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
              className="lg:col-span-2">
              <KpiRow
                columns={3}
                items={[
                  { label: "Refunds", value: financial?.refund_count, sub: "total refunded payments", color: "rose", loading: analyticsLoading, to: "/operations/payments" },
                  { label: "Pending Payouts", value: financial ? fmtCurrency(financial.pending_payouts_total) : null, sub: "owed to engineers", color: "amber", loading: analyticsLoading, to: "/operations/payments" },
                ]}
              />
            </motion.div>
          </div>
        )}

        {/* Quick Actions — Open Ticket Queue / Open Assignments / Open
            Payments, per the Phase 1 spec. Assignments and Payments are
            gated to the same role sets their routes already enforce
            (App.jsx's OpsManagerRoute / PaymentRoute) so a Support Agent,
            say, never sees a shortcut that immediately 403s. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { to: "/operations/tickets", label: "Ticket Queue", desc: "Filter, search, and assign all tickets", color: "indigo" },
            ...(canOpenAssignments ? [
              { to: "/operations/assignments", label: "Assignments", desc: "View all assignment and reassignment events", color: "emerald" },
            ] : []),
            ...(canOpenPayments ? [
              { to: "/operations/payments", label: "Payments", desc: "Review and confirm ticket payments", color: "violet" },
            ] : []),
            ...(isSuperAdmin ? [
              { to: "/operations/users", label: "Users", desc: "Manage accounts across every role", color: "sky" },
              { to: "/operations/roles", label: "Roles", desc: "Change roles and review the audit log", color: "amber" },
            ] : []),
          ].map((card) => {
            const s = KPI_STYLES[card.color];
            return (
              <Link key={card.to} to={card.to}
                className={`bg-white border ${s.border} rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group`}
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <p className={`text-sm font-bold ${s.num} mb-1`}>{card.label}</p>
                <p className="text-xs text-slate-500">{card.desc}</p>
                <p className={`text-xs font-semibold ${s.num} mt-3 group-hover:translate-x-1 transition-transform duration-150`}>
                  Open →
                </p>
              </Link>
            );
          })}
        </div>

      </div>
    </AppShell>
  );
}
