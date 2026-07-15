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
import Donut from "../../components/dashboard/charts/Donut";
import Sparkline from "../../components/dashboard/charts/Sparkline";
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
