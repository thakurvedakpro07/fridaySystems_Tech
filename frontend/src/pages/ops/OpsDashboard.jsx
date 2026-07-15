import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getOpsCommandCenterCore, getOpsCommandCenterLive } from "../../api/opsCommandCenter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/apiError";
import { buildOperationsBrief } from "../../utils/operationsBrief";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";
import DashboardSection from "../../components/dashboard/DashboardSection";
import KpiRow from "../../components/dashboard/KpiRow";
import SLABadge from "../../components/dashboard/SLABadge";
import SLACountdown from "../../components/dashboard/SLACountdown";
import OperationsHealthBanner from "../../components/dashboard/OperationsHealthBanner";
import AIDailyBriefCard from "../../components/dashboard/AIDailyBriefCard";
import ActivityTimeline from "../../components/dashboard/ActivityTimeline";
import EngineerCapacityBoard from "../../components/dashboard/EngineerCapacityBoard";
import ServiceHealthGrid from "../../components/dashboard/ServiceHealthGrid";
import Donut from "../../components/dashboard/charts/Donut";
import TableCard from "../../components/table/TableCard";

// "Ticket Flow" status funnel — same status→color palette already
// established in the former OpsDashboard.jsx / ExecutiveAnalytics.jsx
// STATUS_CHART_SEGMENTS, kept as a local copy (neither file exports its
// constants) so this chart never disagrees with Badge's "ticketStatus"
// domain pills used elsewhere on this page.
const STATUS_CHART_SEGMENTS = [
  { key: "open",             label: "Open (Unassigned)", color: "#3b82f6" },
  { key: "assigned",         label: "Ready to Start",    color: "#8b5cf6" },
  { key: "in_progress",      label: "Work Started",      color: "#4f46e5" },
  { key: "pending_payment",  label: "Pending Payment",   color: "#f59e0b" },
  { key: "resolved",         label: "Resolved",          color: "#10b981" },
  { key: "closed",           label: "Closed",            color: "#94a3b8" },
];

// Shared row shape for Live Incident Queue and Escalation Queue — both
// consume the same OpsTicketListSerializer shape from the two Command
// Center endpoints. Not TicketCard.jsx: that component expects
// `assigned_to.{first_name,last_name}` while this payload's `freelancer`
// field is shaped `{id,name,email}` (OpsTicketListSerializer.get_freelancer),
// a deliberate mismatch documented in the Phase 1 plan rather than
// something to paper over with a prop-mapping shim.
function IncidentRow({ ticket }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[11px] font-mono font-semibold text-slate-500">{ticket.ticket_number}</span>
          {ticket.severity && <Badge domain="severity" label={ticket.severity} />}
          <Badge domain="ticketStatus" label={ticket.status} />
          {ticket.sla_status && <SLABadge status={ticket.sla_status} />}
          {ticket.waiting_on_internal && <Badge tone="orange" label="Escalated" />}
        </div>
        <p className="text-sm font-semibold text-slate-900 truncate">{ticket.title}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <p className="text-[11px] text-slate-500">
            {ticket.freelancer ? (ticket.freelancer.name ?? ticket.freelancer.email) : "Unassigned"}
          </p>
          {ticket.due_at && <SLACountdown dueAt={ticket.due_at} />}
        </div>
      </div>
      <Link
        to={`/operations/tickets?highlight=${ticket.id}`}
        className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200
                   hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        View →
      </Link>
    </div>
  );
}

function TicketListSection({ title, description, viewAllTo, tickets, loading, emptyMessage, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <DashboardSection title={title} description={description} viewAllTo={viewAllTo}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-xl" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 -m-6">
            {tickets.map((t) => <IncidentRow key={t.id} ticket={t} />)}
          </div>
        )}
      </DashboardSection>
    </motion.div>
  );
}

export default function OpsDashboard() {
  usePageTitle("Operations Command Center — ResolveHQ");
  const showToast = useToast();

  const [core, setCore] = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);

  // Single fetch on mount for both — polling every 30-60s for the `live`
  // payload is deliberately deferred to the next phase so this phase's
  // data plumbing and every new component can be reviewed as one
  // self-contained, non-timer-dependent chunk.
  useEffect(() => {
    getOpsCommandCenterCore()
      .then((res) => setCore(res.data))
      .catch((err) => showToast(extractErrorMessage(err, "Failed to load operations data."), "error"))
      .finally(() => setCoreLoading(false));
  }, [showToast]);

  useEffect(() => {
    getOpsCommandCenterLive()
      .then((res) => setLive(res.data))
      .catch((err) => showToast(extractErrorMessage(err, "Failed to load live operations data."), "error"))
      .finally(() => setLiveLoading(false));
  }, [showToast]);

  // ── Operations Health Banner + AI Operations Summary ────────────
  // Both are client-derived from the already-fetched Core + Live payloads
  // — no dedicated backend call for either (see utils/operationsBrief.js).
  const incidentCount = live?.incident_queue?.length ?? 0;
  const slaBreachingCount = live?.sla_risk_board?.length ?? 0;
  const escalatedCount = core?.escalation_queue?.length ?? 0;
  const overCapacityCount = (core?.engineer_capacity ?? []).filter((e) => e.over_capacity).length;

  let healthTone = "ok";
  if (incidentCount > 0 || slaBreachingCount > 0) healthTone = "critical";
  else if (escalatedCount > 0 || overCapacityCount > 0) healthTone = "warning";

  const brief = buildOperationsBrief({ core, live });

  // ── Ticket Flow ────────────────────────────────────────────────
  const ticketFlow = core?.ticket_flow;
  const flowSegments = STATUS_CHART_SEGMENTS.map((s) => ({
    label: s.label, value: ticketFlow?.by_status?.[s.key] ?? 0, color: s.color,
  }));

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <PageHeader
            title="Operations Command Center"
            description="Live view of what needs attention across tickets, SLAs, engineers, and services."
          />
          <Link
            to="/operations/tickets"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                       px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Manage Tickets
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <OperationsHealthBanner
            incidentCount={incidentCount}
            slaBreachingCount={slaBreachingCount}
            escalatedCount={escalatedCount}
            overCapacityCount={overCapacityCount}
            tone={healthTone}
            loading={coreLoading || liveLoading}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <AIDailyBriefCard brief={brief} renderBullet={(b) => b.text} />
        </motion.div>

        <TicketListSection
          title="Live Incident Queue"
          description="Open tickets at critical or high severity"
          viewAllTo="/operations/tickets?priority=critical"
          tickets={live?.incident_queue ?? []}
          loading={liveLoading}
          emptyMessage="No active incidents"
          delay={0.08}
        />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <DashboardSection title="SLA Risk Board" description="Open tickets overdue or due within the next 4 hours" viewAllTo="/operations/tickets">
            <TableCard
              columns={["Ticket", "Severity", "Assigned", "SLA"]}
              gridColsClassName="grid-cols-[1fr_100px_160px_200px]"
              loading={liveLoading}
              isEmpty={!liveLoading && (live?.sla_risk_board ?? []).length === 0}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">No tickets at SLA risk</p>
                  <p className="text-xs text-slate-500 mt-1">Nothing overdue or due within the next 4 hours.</p>
                </div>
              }
            >
              {(live?.sla_risk_board ?? []).map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_100px_160px_200px] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{t.ticket_number}</p>
                  </div>
                  <div>{t.severity && <Badge domain="severity" label={t.severity} />}</div>
                  <p className="text-xs text-slate-600 truncate">
                    {t.freelancer ? (t.freelancer.name ?? t.freelancer.email) : "Unassigned"}
                  </p>
                  <div className="flex flex-col gap-1">
                    {t.sla_status && <SLABadge status={t.sla_status} />}
                    {t.due_at && <SLACountdown dueAt={t.due_at} />}
                  </div>
                </div>
              ))}
            </TableCard>
          </DashboardSection>
        </motion.div>

        <TicketListSection
          title="Escalation Queue"
          description="Tickets awaiting action after being escalated"
          viewAllTo="/operations/tickets"
          tickets={core?.escalation_queue ?? []}
          loading={coreLoading}
          emptyMessage="No open escalations"
          delay={0.16}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <DashboardSection title="Engineer Capacity" description="Active ticket load and utilization, busiest first" viewAllTo="/operations/freelancers">
              <EngineerCapacityBoard engineers={core?.engineer_capacity} loading={coreLoading} />
            </DashboardSection>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <DashboardSection title="Service Health" description="Open load and SLA breach rate per service, last 7 days">
              <ServiceHealthGrid services={core?.service_health} loading={coreLoading} />
            </DashboardSection>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <DashboardSection title="Ticket Flow" description={`Created vs. resolved in the last ${ticketFlow?.window_hours ?? 24} hours`}>
            {coreLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <div className="space-y-6">
                <KpiRow
                  columns={3}
                  items={[
                    { label: "Created", value: ticketFlow?.created_count, color: "blue" },
                    { label: "Resolved", value: ticketFlow?.resolved_count, color: "emerald" },
                    { label: "Net Change", value: ticketFlow?.net_change, color: (ticketFlow?.net_change ?? 0) > 0 ? "rose" : "emerald" },
                  ]}
                />
                <Donut segments={flowSegments} />
              </div>
            )}
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <DashboardSection title="Critical Customers" description="Customers with an open critical/high-severity or overdue ticket">
            <TableCard
              columns={["Customer", "Plan", "Affected", "Critical", "Breaching"]}
              gridColsClassName="grid-cols-[1fr_120px_100px_100px_100px]"
              loading={coreLoading}
              isEmpty={!coreLoading && (core?.critical_customers ?? []).length === 0}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">No customers currently affected</p>
                  <p className="text-xs text-slate-500 mt-1">Nobody has an open critical, high-severity, or overdue ticket right now.</p>
                </div>
              }
            >
              {(core?.critical_customers ?? []).map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_120px_100px_100px_100px] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <Badge label={c.plan} capitalize />
                  <p className="text-sm text-slate-700">{c.affected_ticket_count}</p>
                  <p className="text-sm text-rose-600 font-semibold">{c.critical_ticket_count}</p>
                  <p className="text-sm text-amber-600 font-semibold">{c.breaching_ticket_count}</p>
                </div>
              ))}
            </TableCard>
          </DashboardSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <DashboardSection title="Activity Timeline" description="What happened across all tickets in the last few hours">
            <ActivityTimeline entries={live?.activity_timeline} loading={liveLoading} showTicketRef />
          </DashboardSection>
        </motion.div>

      </div>
    </AppShell>
  );
}
