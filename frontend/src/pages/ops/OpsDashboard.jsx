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

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

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
};

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

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [openTickets, setOpenTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [freelancers, setFreelancers] = useState([]);
  const [freelancersLoading, setFreelancersLoading] = useState(canSeeWorkload);

  const [financial, setFinancial] = useState(null);
  const [financialLoading, setFinancialLoading] = useState(canSeeFinancial);

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(isSuperAdmin);

  const load = useCallback(async () => {
    setStatsLoading(true);
    setTicketsLoading(true);
    setError(null);
    try {
      const [dashRes, ticketsRes] = await Promise.all([
        getOpsDashboard(),
        getOpsTickets({ status: "open", ordering: "-created_at" }),
      ]);
      setStats(dashRes.data);
      setOpenTickets(ticketsRes.data?.results ?? ticketsRes.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load dashboard.");
    } finally {
      setStatsLoading(false);
      setTicketsLoading(false);
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
    if (!canSeeFinancial) return;
    setFinancialLoading(true);
    getOpsAnalytics()
      .then(({ data }) => setFinancial(data?.financial ?? null))
      .catch(() => {})
      .finally(() => setFinancialLoading(false));
  }, [canSeeFinancial]);

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

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operations Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Ticket queue overview and freelancer assignment management.</p>
          </div>
          <Link to="/operations/tickets"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                       px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            Manage Tickets
          </Link>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-sm font-medium flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* KPI grid — base for all staff roles */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Open — Unassigned", value: stats?.open, color: "indigo", sub: "Awaiting engineer assignment", icon: IC.ticket, to: "/operations/tickets?status=open", delay: 0 },
            { label: "Ready to Start", value: stats?.assigned, color: "violet", sub: "Assigned, not yet started", icon: IC.assign, to: "/operations/tickets?status=assigned", delay: 0.04 },
            { label: "Work Started", value: stats?.in_progress, color: "amber", sub: "Actively being worked", icon: IC.clock, to: "/operations/tickets?status=in_progress", delay: 0.08 },
            { label: "SLA Due Soon", value: stats?.sla_due_soon, color: "orange", sub: "Deadline within 2 hours", icon: IC.alert, to: "/operations/tickets?status=in_progress", delay: 0.12 },
            { label: "Resolved / Closed", value: (stats?.resolved ?? 0) + (stats?.closed ?? 0), color: "emerald", sub: "Successfully completed", icon: IC.check, to: "/operations/tickets?status=resolved", delay: 0.16 },
          ].map(({ delay, ...kpi }) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
              <KpiCard {...kpi} loading={statsLoading} />
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
                        {t.severity && <Badge label={t.severity} colorClass="bg-slate-100 text-slate-600" />}
                        <Badge label={t.service_type?.replace(/_/g, " ") ?? "—"} colorClass="bg-slate-100 text-slate-600" />
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
                {financialLoading ? (
                  <div className="h-16 shimmer rounded-lg" />
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
                {financialLoading ? (
                  <div className="h-16 shimmer rounded-lg" />
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
                  { label: "Refunds", value: financial?.refund_count, sub: "total refunded payments", color: "rose", loading: financialLoading, to: "/operations/payments" },
                  { label: "Pending Payouts", value: financial ? fmtCurrency(financial.pending_payouts_total) : null, sub: "owed to engineers", color: "amber", loading: financialLoading, to: "/operations/payments" },
                ]}
              />
            </motion.div>
          </div>
        )}

        {/* Quick nav cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { to: "/operations/tickets", label: "Ticket Queue", desc: "Filter, search, and assign all tickets", color: "indigo" },
            { to: "/operations/freelancers", label: "Engineer Roster", desc: "Skills, availability, and active load", color: "violet" },
            { to: "/operations/assignments", label: "Assignment History", desc: "View all assignment and reassignment events", color: "emerald" },
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
