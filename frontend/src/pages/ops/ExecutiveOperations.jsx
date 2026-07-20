import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getExecutiveAnalytics } from "../../api/executiveAnalytics";
import { getOpsCommandCenterLive } from "../../api/opsCommandCenter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/apiError";
import { downloadCsv } from "../../utils/exportCsv";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import DashboardSection from "../../components/dashboard/DashboardSection";
import KpiRow from "../../components/dashboard/KpiRow";
import Donut from "../../components/dashboard/charts/Donut";
import BarRow from "../../components/dashboard/charts/BarRow";
import Sparkline from "../../components/dashboard/charts/Sparkline";
import ActivityTimeline from "../../components/dashboard/ActivityTimeline";
import TableCard from "../../components/table/TableCard";
import Badge from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";
import FilterBar from "../../components/filters/FilterBar";

function fmtCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

// See ExecutiveAnalytics.jsx — same overflow problem on the same class of
// tile (a full-precision ₹ string blows past a 1-of-N-column KPI card).
function fmtCurrencyCompact(n) {
  const num = Number(n ?? 0);
  const abs = Math.abs(num);
  if (abs >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(num / 1_00_000).toFixed(2)}L`;
  return fmtCurrency(num);
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function fmtChange(pct) {
  if (pct === null || pct === undefined) return undefined;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prior period`;
}

function fmtBreachedBy(minutes) {
  if (minutes == null) return "—";
  const abs = Math.abs(minutes);
  return abs >= 60 ? `${Math.round(abs / 60)}h` : `${abs}m`;
}

// Same status/severity → color palettes as ExecutiveAnalytics.jsx and
// OpsDashboard.jsx, kept as a local copy per this codebase's established
// convention (neither of those files exports its constants) so these
// charts never disagree with Badge's "ticketStatus"/"severity" domains.
const STATUS_CHART_SEGMENTS = [
  { key: "open",             label: "Open (Unassigned)", color: "#3b82f6" },
  { key: "assigned",         label: "Ready to Start",    color: "#8b5cf6" },
  { key: "in_progress",      label: "Work Started",      color: "#4f46e5" },
  { key: "pending_payment",  label: "Pending Payment",   color: "#f59e0b" },
  { key: "resolved",         label: "Resolved",          color: "#10b981" },
  { key: "closed",           label: "Closed",            color: "#94a3b8" },
];

const SEVERITY_CHART_SEGMENTS = [
  { key: "low",      label: "Low",      color: "#94a3b8" },
  { key: "medium",   label: "Medium",   color: "#f59e0b" },
  { key: "high",     label: "High",     color: "#f97316" },
  { key: "critical", label: "Critical", color: "#f43f5e" },
];

const PERIOD_OPTIONS = [
  { value: "7d",  label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function ExecutiveOperations() {
  usePageTitle("Executive Operations Dashboard — ResolveHQ");
  const showToast = useToast();

  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getExecutiveAnalytics({ period })
      .then((res) => setData(res.data))
      .catch((err) => showToast(extractErrorMessage(err, "Failed to load executive analytics."), "error"))
      .finally(() => setLoading(false));
  }, [period, showToast]);

  // Recent Platform Activity reuses the Operations Command Center's live
  // feed rather than a new endpoint — a single fetch here (not the 45s
  // poll OpsDashboard.jsx uses), since this page is a period-selectable
  // executive summary, not a real-time ops board.
  useEffect(() => {
    getOpsCommandCenterLive()
      .then((res) => setActivity(res.data?.activity_timeline ?? []))
      .catch((err) => showToast(extractErrorMessage(err, "Failed to load recent activity."), "error"))
      .finally(() => setActivityLoading(false));
  }, [showToast]);

  const summary = data?.summary;
  const sla = data?.sla;
  const revenue = data?.revenue;
  const csat = data?.csat;
  const periodRange = data?.period;

  const platformStatsItems = [
    { label: "Total Tickets", value: summary?.total_tickets, sub: fmtChange(summary?.total_tickets_change_pct), color: "indigo", loading },
    { label: "Open Tickets", value: summary?.open_tickets, color: "blue", loading },
    { label: "Closed Tickets", value: summary?.closed_tickets, color: "sky", loading },
    { label: "Active Customers", value: summary?.active_customers, sub: fmtChange(summary?.active_customers_change_pct), color: "teal", loading },
    { label: "Active Freelancers", value: data?.engineer_utilization?.length, color: "violet", loading },
  ];

  const slaItems = [
    {
      label: "Resolution SLA Met",
      value: sla?.resolution_compliance_pct != null ? `${sla.resolution_compliance_pct}%` : undefined,
      sub: sla ? `${sla.resolution_met} met / ${sla.resolution_missed} missed` : undefined,
      color: "emerald",
      loading,
    },
    {
      label: "First-Response SLA Met",
      value: sla?.first_response_compliance_pct != null ? `${sla.first_response_compliance_pct}%` : undefined,
      sub: sla ? `${sla.first_response_met} met / ${sla.first_response_missed} missed` : undefined,
      color: "emerald",
      loading,
    },
    { label: "Avg Resolution Time", value: sla?.avg_resolution_hours != null ? `${sla.avg_resolution_hours}h` : undefined, color: "sky", loading },
    { label: "Avg First Response", value: sla?.avg_first_response_hours != null ? `${sla.avg_first_response_hours}h` : undefined, color: "sky", loading },
  ];

  const slaTrendData = (data?.sla_trend ?? []).map((r) => ({ label: r.bucket, value: r.compliance_pct }));

  const revenueItems = [
    { label: "Total Revenue", value: summary ? fmtCurrencyCompact(summary.total_revenue) : undefined, sub: fmtChange(summary?.total_revenue_change_pct), color: "teal", loading },
    { label: "Pending Payouts", value: revenue ? fmtCurrencyCompact(revenue.pending_payouts_total) : undefined, color: "amber", loading },
  ];
  const revenueTrendData = (revenue?.trend ?? []).map((r) => ({ label: r.bucket, value: r.total }));
  const revenueByTypeData = (revenue?.revenue_by_type ?? []).map((r) => ({
    label: (r.payment_type ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: r.total,
  }));

  const statusByKey = Object.fromEntries((data?.ticket_status_distribution ?? []).map((r) => [r.status, r.count]));
  const statusSegments = STATUS_CHART_SEGMENTS.map((s) => ({ label: s.label, value: statusByKey[s.key] ?? 0, color: s.color }));

  const priorityByKey = Object.fromEntries((data?.priority_distribution ?? []).map((r) => [r.severity, r.count]));
  const prioritySegments = SEVERITY_CHART_SEGMENTS.map((s) => ({ label: s.label, value: priorityByKey[s.key] ?? 0, color: s.color }));

  const createdTrendData = (data?.operational_health?.trend ?? []).map((r) => ({ label: r.bucket, value: r.created }));
  const resolvedTrendData = (data?.operational_health?.trend ?? []).map((r) => ({ label: r.bucket, value: r.resolved }));
  const resolutionByCategoryData = (data?.top_problem_categories ?? []).map((c) => ({ label: c.label, value: c.avg_resolution_hours ?? 0 }));

  const csatTrendData = (csat?.trend ?? []).map((r) => ({ label: r.bucket, value: r.avg_score }));
  const csatItems = [
    { label: "CSAT Average", value: summary?.csat_avg != null ? `${summary.csat_avg}/5` : undefined, color: "emerald", loading },
    { label: "Responses", value: csat?.response_count, color: "indigo", loading },
  ];

  // Client-side text filter — search hits the on-page tables/activity feed
  // (customer/ticket/company name, ticket number, activity note), not the
  // backend, since every dataset here is already fully loaded and small
  // (server-capped at 10 for customers/breaches, activity capped at 30).
  const q = search.trim().toLowerCase();
  const topCustomers = useMemo(() => {
    const rows = data?.most_active_customers ?? [];
    return q ? rows.filter((c) => c.name?.toLowerCase().includes(q)) : rows;
  }, [data, q]);

  const recentlyBreached = useMemo(() => {
    const rows = data?.recently_breached_tickets ?? [];
    return q
      ? rows.filter((t) =>
          [t.ticket_number, t.title, t.customer, t.engineer].some((v) => v?.toLowerCase().includes(q))
        )
      : rows;
  }, [data, q]);

  const filteredActivity = useMemo(() => {
    const rows = activity ?? [];
    return q
      ? rows.filter((a) =>
          [a.ticket_number, a.ticket_title, a.action, a.note, a.actor_email].some((v) => v?.toLowerCase().includes(q))
        )
      : rows;
  }, [activity, q]);

  function exportPlatformSummary() {
    downloadCsv(
      `executive-operations-summary-${period}.csv`,
      ["Metric", "Value"],
      [
        ["Total Tickets", summary?.total_tickets],
        ["Open Tickets", summary?.open_tickets],
        ["Closed Tickets", summary?.closed_tickets],
        ["Active Customers", summary?.active_customers],
        ["Active Freelancers", data?.engineer_utilization?.length],
        ["Resolution SLA Met %", sla?.resolution_compliance_pct],
        ["First-Response SLA Met %", sla?.first_response_compliance_pct],
        ["Total Revenue", summary?.total_revenue],
        ["CSAT Average", summary?.csat_avg],
      ]
    );
  }

  function exportTopCustomers() {
    downloadCsv(
      `top-customers-${period}.csv`,
      ["Name", "Tickets", "Revenue"],
      topCustomers.map((c) => [c.name, c.ticket_count, c.revenue])
    );
  }

  function exportBreachedTickets() {
    downloadCsv(
      `breached-tickets-${period}.csv`,
      ["Ticket", "Title", "Severity", "Status", "Customer", "Engineer", "Breached By (min)"],
      recentlyBreached.map((t) => [t.ticket_number, t.title, t.severity, t.status, t.customer, t.engineer ?? "Unassigned", t.breached_by_minutes])
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <PageHeader
          title="Executive Operations Dashboard"
          description="Consolidated platform, SLA, revenue, and satisfaction overview for Super Admin, Operations Manager, and Finance Manager."
          actions={
            <Button variant="secondary" size="sm" onClick={exportPlatformSummary}>
              Export Summary CSV
            </Button>
          }
        />

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search customers, tickets, activity…"
            status={period}
            onStatusChange={setPeriod}
            statusOptions={PERIOD_OPTIONS}
            onClear={() => { setSearch(""); setPeriod("30d"); }}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <DashboardSection
            title="Platform Statistics"
            description={periodRange ? `${fmtDate(periodRange.start)} – ${fmtDate(periodRange.end)}` : "Last 30 days"}
          >
            <KpiRow items={platformStatsItems} columns={5} />
          </DashboardSection>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <DashboardSection title="SLA Health" description="Compliance and resolution speed for the selected period">
              <KpiRow items={slaItems} columns={4} className="mb-6" />
              {loading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : (
                <Sparkline data={slaTrendData} color="#2563eb" valueFormatter={(v) => (v != null ? `${v}%` : "—")} />
              )}
            </DashboardSection>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <DashboardSection
              title="Revenue Overview"
              description="Placeholder view built from current payment data — full financial reporting lives in Executive Analytics."
            >
              <KpiRow items={revenueItems} columns={3} className="mb-6" />
              {loading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : (
                <div className="space-y-6">
                  <Sparkline data={revenueTrendData} color="#0d9488" valueFormatter={fmtCurrency} />
                  {revenueByTypeData.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Revenue by Type</p>
                      <BarRow data={revenueByTypeData} color="#0d9488" valueFormatter={fmtCurrency} />
                    </div>
                  )}
                </div>
              )}
            </DashboardSection>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <DashboardSection title="Ticket Status" description="Current pipeline breakdown for the selected period">
              {loading ? <Skeleton className="h-24 rounded-lg" /> : <Donut segments={statusSegments} />}
            </DashboardSection>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <DashboardSection title="Priority Distribution" description="Tickets by technical severity">
              {loading ? <Skeleton className="h-24 rounded-lg" /> : <Donut segments={prioritySegments} />}
            </DashboardSection>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <DashboardSection title="Resolution Performance" description="Ticket flow and average resolution time by category">
            {loading ? (
              <Skeleton className="h-16 rounded-lg" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Created vs. Resolved</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Created</p>
                      <Sparkline data={createdTrendData} color="#4f46e5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Resolved</p>
                      <Sparkline data={resolvedTrendData} color="#10b981" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Avg Resolution by Category</p>
                  {resolutionByCategoryData.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No data yet</p>
                  ) : (
                    <BarRow data={resolutionByCategoryData} color="#f59e0b" valueFormatter={(v) => `${v}h`} />
                  )}
                </div>
              </div>
            )}
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <DashboardSection title="Customer Satisfaction" description="CSAT average and trend for the selected period">
            <KpiRow items={csatItems} columns={3} className="mb-6" />
            {loading ? (
              <Skeleton className="h-16 rounded-lg" />
            ) : csatTrendData.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No CSAT responses yet for this period.</p>
            ) : (
              <Sparkline data={csatTrendData} color="#059669" valueFormatter={(v) => (v != null ? `${v}/5` : "—")} />
            )}
          </DashboardSection>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-section-title">Top Customers</h2>
                <p className="text-xs text-slate-500 mt-0.5">Highest ticket volume and revenue for the selected period</p>
              </div>
              <Button variant="secondary" size="sm" onClick={exportTopCustomers}>Export CSV</Button>
            </div>
            <TableCard
              columns={["Name", "Tickets", "Revenue"]}
              gridColsClassName="grid-cols-[1.5fr_0.7fr_1fr]"
              loading={loading}
              isEmpty={!loading && topCustomers.length === 0}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">No matching customers</p>
                  <p className="text-xs text-slate-500 mt-1">Try a different search term or period.</p>
                </div>
              }
            >
              {topCustomers.map((c) => (
                <div key={c.id} className="grid grid-cols-[1.5fr_0.7fr_1fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-sm text-slate-700">{c.ticket_count}</p>
                  <p className="text-sm font-semibold text-slate-900">{fmtCurrency(c.revenue)}</p>
                </div>
              ))}
            </TableCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-section-title">Recently Breached Tickets</h2>
                <p className="text-xs text-slate-500 mt-0.5">Most recent SLA breaches requiring attention</p>
              </div>
              <Button variant="secondary" size="sm" onClick={exportBreachedTickets}>Export CSV</Button>
            </div>
            <TableCard
              columns={["Ticket", "Severity", "Status", "Breached By"]}
              gridColsClassName="grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr]"
              loading={loading}
              isEmpty={!loading && recentlyBreached.length === 0}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">No matching breaches</p>
                  <p className="text-xs text-slate-500 mt-1">Try a different search term or period.</p>
                </div>
              }
            >
              {recentlyBreached.map((t) => (
                <div key={t.id} className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{t.ticket_number}</p>
                  </div>
                  <Badge domain="severity" label={t.severity} />
                  <Badge domain="ticketStatus" label={t.status} />
                  <p className="text-sm font-semibold text-rose-600">{fmtBreachedBy(t.breached_by_minutes)}</p>
                </div>
              ))}
            </TableCard>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <DashboardSection title="Recent Platform Activity" description="What happened across all tickets recently" viewAllTo="/operations">
            <ActivityTimeline entries={filteredActivity} loading={activityLoading} showTicketRef />
          </DashboardSection>
        </motion.div>
      </div>
    </AppShell>
  );
}
