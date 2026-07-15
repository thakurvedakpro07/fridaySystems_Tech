import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getExecutiveAnalytics } from "../../api/executiveAnalytics";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/apiError";
import PageHeader from "../../components/ui/PageHeader";
import DashboardSection from "../../components/dashboard/DashboardSection";
import KpiRow from "../../components/dashboard/KpiRow";
import KpiCard from "../../components/dashboard/KpiCard";
import Donut from "../../components/dashboard/charts/Donut";
import BarRow from "../../components/dashboard/charts/BarRow";
import Sparkline from "../../components/dashboard/charts/Sparkline";
import ProgressBar from "../../components/dashboard/charts/ProgressBar";
import TableCard from "../../components/table/TableCard";
import Badge from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";

function fmtCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

// KpiCard's value text has no truncation handling, and a full Indian-format
// rupee string (e.g. "₹9,07,702") overflows a 1-of-6-column tile. Used only
// for the Executive Summary's Total Revenue tile, where space is tightest —
// fmtCurrency (full precision) is still used everywhere else on this page.
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

// "Ticket Status Distribution" donut — same status→color palette already
// established in OpsDashboard.jsx's STATUS_CHART_SEGMENTS, kept as a local
// copy (that file doesn't export its constants) so this chart never
// disagrees with the Badge "ticketStatus" domain pills used elsewhere.
const STATUS_CHART_SEGMENTS = [
  { key: "open",             label: "Open (Unassigned)", color: "#3b82f6" },
  { key: "assigned",         label: "Ready to Start",    color: "#8b5cf6" },
  { key: "in_progress",      label: "Work Started",      color: "#4f46e5" },
  { key: "pending_payment",  label: "Pending Payment",   color: "#f59e0b" },
  { key: "resolved",         label: "Resolved",          color: "#10b981" },
  { key: "closed",           label: "Closed",            color: "#94a3b8" },
];

// "Priority Distribution" donut — colors match Badge's "severity" domain
// (low=slate, medium=amber, high=orange, critical=rose).
const SEVERITY_CHART_SEGMENTS = [
  { key: "low",      label: "Low",      color: "#94a3b8" },
  { key: "medium",   label: "Medium",   color: "#f59e0b" },
  { key: "high",     label: "High",     color: "#f97316" },
  { key: "critical", label: "Critical", color: "#f43f5e" },
];

export default function ExecutiveAnalytics() {
  usePageTitle("Executive Analytics — ResolveHQ");
  const showToast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExecutiveAnalytics()
      .then((res) => setData(res.data))
      .catch((err) => showToast(extractErrorMessage(err, "Failed to load executive analytics."), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const summary = data?.summary;
  const sla = data?.sla;
  const period = data?.period;

  const ticketBacklogTotal = data?.ticket_aging
    ? Object.values(data.ticket_aging).reduce((a, b) => a + b, 0)
    : undefined;

  const summaryItems = [
    { label: "Total Revenue", value: summary ? fmtCurrencyCompact(summary.total_revenue) : undefined, sub: fmtChange(summary?.total_revenue_change_pct), color: "teal", loading },
    { label: "Active Customers", value: summary?.active_customers, sub: fmtChange(summary?.active_customers_change_pct), color: "sky", loading },
    { label: "SLA Compliance", value: summary?.sla_compliance_pct != null ? `${summary.sla_compliance_pct}%` : undefined, color: "blue", loading },
    { label: "Active Engineers", value: data?.engineer_utilization?.length, color: "violet", loading },
    { label: "Ticket Backlog", value: ticketBacklogTotal, color: "amber", loading },
    { label: "CSAT", value: summary?.csat_avg != null ? `${summary.csat_avg}/5` : undefined, color: "emerald", loading },
  ];

  const statusByKey = Object.fromEntries((data?.ticket_status_distribution ?? []).map((r) => [r.status, r.count]));
  const statusSegments = STATUS_CHART_SEGMENTS.map((s) => ({ label: s.label, value: statusByKey[s.key] ?? 0, color: s.color }));

  const priorityByKey = Object.fromEntries((data?.priority_distribution ?? []).map((r) => [r.severity, r.count]));
  const prioritySegments = SEVERITY_CHART_SEGMENTS.map((s) => ({ label: s.label, value: priorityByKey[s.key] ?? 0, color: s.color }));

  const slaTrendData = (data?.sla_trend ?? []).map((r) => ({ label: r.bucket, value: r.compliance_pct }));
  const createdTrendData = (data?.operational_health?.trend ?? []).map((r) => ({ label: r.bucket, value: r.created }));
  const resolvedTrendData = (data?.operational_health?.trend ?? []).map((r) => ({ label: r.bucket, value: r.resolved }));

  const revenueTrendData = (data?.revenue?.trend ?? []).map((r) => ({ label: r.bucket, value: r.total }));
  // Full distribution (not top-5) — deliberately differs from Operations'
  // "Top Service Categories" table later in the page.
  const serviceCategoryBarData = (data?.service_category_distribution ?? []).map((c) => ({ label: c.label, value: c.count }));
  const topCustomers = data?.most_active_customers ?? [];

  function fmtGrowth(pct) {
    if (pct === null || pct === undefined) return undefined;
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }

  const growthItems = [
    { label: "Revenue Growth", value: fmtGrowth(summary?.total_revenue_change_pct), color: "teal", loading },
    { label: "Ticket Growth", value: fmtGrowth(summary?.total_tickets_change_pct), color: "indigo", loading },
    { label: "Customer Growth", value: fmtGrowth(summary?.active_customers_change_pct), color: "sky", loading },
  ];

  // engineer_utilization has no server-side limit (44 rows on the seeded
  // demo dataset) — capped client-side to keep this an executive-glance
  // widget, consistent with the other list widgets on this page (Recently
  // Breached Tickets/Top Customers are both server-capped at 10).
  const mostActiveEngineers = (data?.engineer_utilization ?? []).slice(0, 8);

  // utilization_pct is a rough capacity heuristic that can read well over
  // 100% on this dataset (a known, documented calibration gap — see
  // executive_analytics_service.py). Ranked/filtered separately from Most
  // Active Engineers (which sorts by active ticket count, not utilization).
  const highestWorkload = (data?.engineer_utilization ?? [])
    .filter((e) => e.utilization_pct != null)
    .slice()
    .sort((a, b) => b.utilization_pct - a.utilization_pct)
    .slice(0, 8);

  function utilizationTone(pct) {
    if (pct == null) return { bar: "bg-slate-300", text: "text-slate-500" };
    if (pct > 100) return { bar: "bg-rose-500", text: "text-rose-600" };
    if (pct > 80) return { bar: "bg-amber-500", text: "text-amber-600" };
    return { bar: "bg-indigo-500", text: "text-slate-700" };
  }

  const recentlyBreached = data?.recently_breached_tickets ?? [];

  function fmtBreachedBy(minutes) {
    if (minutes == null) return "—";
    const abs = Math.abs(minutes);
    return abs >= 60 ? `${Math.round(abs / 60)}h` : `${abs}m`;
  }

  const topServiceCategories = data?.top_problem_categories ?? [];

  const operationalItems = [
    { label: "Avg Resolution Time", value: sla?.avg_resolution_hours != null ? `${sla.avg_resolution_hours}h` : undefined, color: "sky", loading },
    { label: "Avg First Response", value: sla?.avg_first_response_hours != null ? `${sla.avg_first_response_hours}h` : undefined, color: "sky", loading },
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
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <PageHeader
          title="Executive Analytics"
          description="Unified operational and financial overview for Super Admin, Operations Manager, and Finance Manager."
        />

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <DashboardSection
            title="Executive Summary"
            description={period ? `${fmtDate(period.start)} – ${fmtDate(period.end)}` : "Last 30 days"}
          >
            <KpiRow items={summaryItems} columns={6} />
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <DashboardSection
            title="Operational Health"
            description="SLA compliance and resolution speed for the selected period."
          >
            <KpiRow items={operationalItems} columns={4} />
          </DashboardSection>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <DashboardSection title="Ticket Status Distribution" description="Current pipeline breakdown for the selected period">
              {loading ? <Skeleton className="h-24 rounded-lg" /> : <Donut segments={statusSegments} />}
            </DashboardSection>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <DashboardSection title="Priority Distribution" description="Tickets by technical severity">
              {loading ? <Skeleton className="h-24 rounded-lg" /> : <Donut segments={prioritySegments} />}
            </DashboardSection>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <DashboardSection title="SLA Trend" description="Resolution SLA compliance % over time">
              {loading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : (
                <Sparkline data={slaTrendData} color="#2563eb" valueFormatter={(v) => (v != null ? `${v}%` : "—")} />
              )}
            </DashboardSection>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <DashboardSection title="Weekly Ticket Volume" description="Created vs. resolved for the selected period">
              {loading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : (
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
              )}
            </DashboardSection>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <DashboardSection title="Business Metrics" description="Revenue, category mix, and growth for the selected period">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Revenue Trend</p>
                {loading ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : (
                  <Sparkline data={revenueTrendData} color="#0d9488" valueFormatter={fmtCurrency} />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Tickets by Service Category</p>
                {loading ? (
                  <div className="space-y-3">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-6 rounded-lg" />)}</div>
                ) : serviceCategoryBarData.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No data yet</p>
                ) : (
                  <BarRow data={serviceCategoryBarData} color="#4f46e5" valueFormatter={(v) => `${v} ticket${v !== 1 ? "s" : ""}`} />
                )}
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Growth Metrics</p>
            {/* KpiRow's mobile default is always 2 columns (its `columns` prop
                only changes the lg: breakpoint), which is too narrow for a
                signed decimal percentage at KpiCard's text-4xl — confirmed by
                measuring real overflow (166px content in an 80px tile) during
                manual review. Single column until lg: gives each tile the
                full-width room a value like "+258.3%" needs. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {growthItems.map((item) => <KpiCard key={item.label} {...item} />)}
            </div>
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <div className="mb-3">
            <h2 className="text-section-title">Top Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5">Highest ticket volume and revenue for the selected period</p>
          </div>
          <TableCard
            columns={["Name", "Tickets", "Revenue"]}
            gridColsClassName="grid-cols-[1.5fr_0.7fr_1fr]"
            loading={loading}
            isEmpty={!loading && topCustomers.length === 0}
            emptyState={
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">No customer activity yet</p>
                <p className="text-xs text-slate-500 mt-1">Top customers will appear here once tickets are created.</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="mb-3">
              <h2 className="text-section-title">Most Active Engineers</h2>
              <p className="text-xs text-slate-500 mt-0.5">Highest active ticket load, busiest first</p>
            </div>
            <TableCard
              columns={["Engineer", "Active", "Resolved", "Avg Res.", "Util."]}
              gridColsClassName="grid-cols-[1.3fr_0.6fr_0.7fr_0.7fr_0.7fr]"
              loading={loading}
              isEmpty={!loading && mostActiveEngineers.length === 0}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">No engineer activity yet</p>
                  <p className="text-xs text-slate-500 mt-1">Engineer stats will appear here once tickets are assigned.</p>
                </div>
              }
            >
              {mostActiveEngineers.map((e) => {
                const tone = utilizationTone(e.utilization_pct);
                return (
                  <div key={e.id} className="grid grid-cols-[1.3fr_0.6fr_0.7fr_0.7fr_0.7fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.name}</p>
                    <p className="text-sm text-slate-700">{e.active_ticket_count}</p>
                    <p className="text-sm text-slate-700">{e.resolved_count}</p>
                    <p className="text-sm text-slate-700">{e.avg_resolution_hours != null ? `${e.avg_resolution_hours}h` : "—"}</p>
                    <p className={`text-sm font-semibold ${tone.text}`}>{e.utilization_pct != null ? `${e.utilization_pct}%` : "—"}</p>
                  </div>
                );
              })}
            </TableCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            <DashboardSection title="Highest Workload" description="Utilization %, busiest first">
              {loading ? (
                <div className="space-y-4">{[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-8 rounded-lg" />)}</div>
              ) : highestWorkload.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No utilization data yet</p>
              ) : (
                <div className="space-y-4">
                  {highestWorkload.map((e) => {
                    const tone = utilizationTone(e.utilization_pct);
                    return (
                      <div key={e.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700 font-medium truncate">{e.name}</span>
                          <span className={`text-sm font-semibold shrink-0 ml-2 ${tone.text}`}>{e.utilization_pct}%</span>
                        </div>
                        <ProgressBar pct={e.utilization_pct} color={tone.bar} />
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardSection>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <div className="mb-3">
            <h2 className="text-section-title">Recently Breached Tickets</h2>
            <p className="text-xs text-slate-500 mt-0.5">Most recent SLA breaches requiring attention</p>
          </div>
          <TableCard
            columns={["Ticket", "Title", "Severity", "Status", "Customer", "Engineer", "Breached By"]}
            gridColsClassName="grid-cols-[0.9fr_1.6fr_0.8fr_0.9fr_1.1fr_1.1fr_0.9fr]"
            loading={loading}
            isEmpty={!loading && recentlyBreached.length === 0}
            emptyState={
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">No SLA breaches</p>
                <p className="text-xs text-slate-500 mt-1">Breached tickets will appear here if any occur.</p>
              </div>
            }
          >
            {recentlyBreached.map((t) => (
              <div key={t.id} className="grid grid-cols-[0.9fr_1.6fr_0.8fr_0.9fr_1.1fr_1.1fr_0.9fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                <p className="text-xs font-mono font-semibold text-slate-500 truncate">{t.ticket_number}</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                <Badge domain="severity" label={t.severity} />
                <Badge domain="ticketStatus" label={t.status} />
                <p className="text-sm text-slate-700 truncate">{t.customer}</p>
                <p className="text-sm text-slate-700 truncate">{t.engineer ?? "Unassigned"}</p>
                <p className="text-sm font-semibold text-rose-600">{fmtBreachedBy(t.breached_by_minutes)}</p>
              </div>
            ))}
          </TableCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <div className="mb-3">
            <h2 className="text-section-title">Top Service Categories</h2>
            <p className="text-xs text-slate-500 mt-0.5">Highest ticket volume by category, with average resolution time</p>
          </div>
          <TableCard
            columns={["Category", "Tickets", "Avg Resolution"]}
            gridColsClassName="grid-cols-[1.5fr_0.7fr_1fr]"
            loading={loading}
            isEmpty={!loading && topServiceCategories.length === 0}
            emptyState={
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">No category data yet</p>
              </div>
            }
          >
            {topServiceCategories.map((c) => (
              <div key={c.service_type} className="grid grid-cols-[1.5fr_0.7fr_1fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                <p className="text-sm font-semibold text-slate-900 truncate">{c.label}</p>
                <p className="text-sm text-slate-700">{c.count}</p>
                <p className="text-sm text-slate-700">{c.avg_resolution_hours != null ? `${c.avg_resolution_hours}h` : "—"}</p>
              </div>
            ))}
          </TableCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <DashboardSection title="Executive Insights" description="AI-style summary generated from this period's metrics">
            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-4 rounded-lg" />)}
              </div>
            ) : data?.insights?.length ? (
              <ul className="space-y-2.5">
                {data.insights.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 text-center py-6">No insights available for this period.</p>
            )}
          </DashboardSection>
        </motion.div>
      </div>
    </AppShell>
  );
}
