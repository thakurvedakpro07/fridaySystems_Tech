// Pure function over the Operations Command Center's Core + Live payloads
// (see api/opsCommandCenter.js) — no network call, no LLM, mirrors
// utils/dailyBrief.js's buildDailyBrief shape so AIDailyBriefCard can
// render either. Also covers "which tickets need escalation" (a required
// Command Center answer with no dedicated widget) via the 4th bullet
// below: overdue incident-queue tickets that haven't been escalated yet.

const ONE_HOUR_MS = 60 * 60 * 1000;

function isBreachingSoon(ticket) {
  if (!ticket.due_at) return false;
  return new Date(ticket.due_at).getTime() - Date.now() <= ONE_HOUR_MS;
}

function needsEscalation(ticket) {
  if (!ticket.due_at) return false;
  const overdue = new Date(ticket.due_at).getTime() < Date.now();
  return overdue && !ticket.waiting_on_internal;
}

export function buildOperationsBrief({ core, live }) {
  const slaBreachingSoon = (live?.sla_risk_board ?? []).filter(isBreachingSoon);
  const overCapacityEngineers = (core?.engineer_capacity ?? []).filter((e) => e.over_capacity);
  const escalated = core?.escalation_queue ?? [];
  const needsEscalationTickets = (live?.incident_queue ?? []).filter(needsEscalation);
  const criticalServices = (core?.service_health ?? []).filter((s) => s.status === "critical");

  const bullets = [
    { count: slaBreachingSoon.length, text: "SLAs breach in the next hour" },
    { count: overCapacityEngineers.length, text: "engineers are over capacity" },
    { count: escalated.length, text: "tickets are escalated and awaiting internal action" },
    { count: needsEscalationTickets.length, text: "critical tickets are overdue and not yet escalated" },
    { count: criticalServices.length, text: "services are in critical breach territory" },
  ].filter((b) => b.count > 0);

  const focusTicket = (live?.incident_queue ?? [])[0] ?? null;

  return { bullets, focusTicket };
}
