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

function fmtCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function fmtChange(pct) {
  if (pct === null || pct === undefined) return undefined;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prior period`;
}

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

  const summaryItems = [
    { label: "Total Tickets", value: summary?.total_tickets, sub: fmtChange(summary?.total_tickets_change_pct), color: "indigo", loading },
    { label: "Open Tickets", value: summary?.open_tickets, color: "amber", loading },
    { label: "Closed Tickets", value: summary?.closed_tickets, color: "emerald", loading },
    { label: "Total Revenue", value: summary ? fmtCurrency(summary.total_revenue) : undefined, sub: fmtChange(summary?.total_revenue_change_pct), color: "teal", loading },
    { label: "SLA Compliance", value: summary?.sla_compliance_pct != null ? `${summary.sla_compliance_pct}%` : undefined, color: "blue", loading },
    { label: "CSAT Avg", value: summary?.csat_avg != null ? `${summary.csat_avg}/5` : undefined, color: "violet", loading },
  ];

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
      </div>
    </AppShell>
  );
}
