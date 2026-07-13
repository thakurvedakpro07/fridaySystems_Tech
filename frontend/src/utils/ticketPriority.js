// Client-side triage scoring/bucketing for the Engineer Workspace. All
// inputs come from one already-fetched "all active tickets" payload
// (freelancerListActiveTickets) — no server round-trip per section, per
// the confirmed fetch-all-once strategy.

const SLA_SCORE = { overdue: 100, due_soon: 50, ok: 10, no_deadline: 0 };
const SEVERITY_SCORE = { critical: 40, high: 25, medium: 10, low: 0 };
const AWAITING_REPLY_SCORE = 30;     // customer is waiting on the engineer
const WAITING_INTERNAL_SCORE = 15;   // escalated, needs internal follow-up
const WAITING_CUSTOMER_PENALTY = -20; // ball is in customer's court
const MAX_AGE_DAYS = 10;
const MAX_AGE_BONUS = 10;

// Tickets in these statuses are "active" for triage purposes — a resolved
// ticket is done from the engineer's perspective even if its last public
// comment happens to look customer-authored (e.g. a CSAT comment).
const TRIAGE_ACTIVE_STATUSES = new Set(["open", "assigned", "in_progress"]);
const READY_QUIET_HOURS = 24;

export function computeTicketScore(ticket, now = new Date()) {
  const ageDays = (now - new Date(ticket.created_at)) / 86_400_000;
  const ageBonus = Math.min(ageDays, MAX_AGE_DAYS) * (MAX_AGE_BONUS / MAX_AGE_DAYS);
  return (
    (SLA_SCORE[ticket.sla_status] ?? 0) +
    (SEVERITY_SCORE[ticket.severity] ?? 0) +
    (ticket.awaiting_engineer_reply ? AWAITING_REPLY_SCORE : 0) +
    (ticket.waiting_on_internal ? WAITING_INTERNAL_SCORE : 0) +
    (ticket.waiting_on_customer ? WAITING_CUSTOMER_PENALTY : 0) +
    ageBonus
  );
}

function sortByScore(tickets, now) {
  return [...tickets]
    .map((t) => ({ ...t, priorityScore: computeTicketScore(t, now) }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.created_at) - new Date(b.created_at);
    });
}

/**
 * Buckets tickets into mutually-exclusive triage sections (plus one
 * non-exclusive "recentlyUpdated" cross-section), each sorted by
 * computeTicketScore. Bucket precedence is evaluated top-to-bottom so a
 * ticket that qualifies for a more urgent bucket is never buried in a
 * calmer one.
 */
export function bucketAndSortTickets(tickets, now = new Date()) {
  const buckets = {
    requiresImmediateAttention: [],
    waitingOnInternal: [],
    readyToResolve: [],
    waitingOnCustomer: [],
    todaysWork: [],
  };

  for (const t of tickets) {
    const isTriageActive = TRIAGE_ACTIVE_STATUSES.has(t.status);
    const hoursSinceReply = t.last_public_comment_at
      ? (now - new Date(t.last_public_comment_at)) / 3_600_000
      : Infinity;

    // Resolved-but-not-yet-closed tickets need no engineer action, so they're
    // deliberately excluded from every primary bucket (they'd otherwise flood
    // "Today's Work" via awaiting_engineer_reply, which the backend computes
    // without a status gate — e.g. a customer's CSAT comment on an already-
    // resolved ticket). They still surface via the independent
    // "recentlyUpdated" cross-section below and via Recently Closed once
    // actually closed.
    if (!isTriageActive) continue;

    if (
      t.sla_status === "overdue" ||
      (t.sla_status === "due_soon" && ["high", "critical"].includes(t.severity)) ||
      (t.severity === "critical" && t.awaiting_engineer_reply)
    ) {
      buckets.requiresImmediateAttention.push(t);
    } else if (t.waiting_on_internal) {
      buckets.waitingOnInternal.push(t);
    } else if (
      t.status === "in_progress" &&
      t.waiting_on_customer &&
      hoursSinceReply >= READY_QUIET_HOURS &&
      t.sla_status !== "overdue"
    ) {
      buckets.readyToResolve.push(t);
    } else if (t.waiting_on_customer) {
      buckets.waitingOnCustomer.push(t);
    } else {
      buckets.todaysWork.push(t);
    }
  }

  for (const key of Object.keys(buckets)) buckets[key] = sortByScore(buckets[key], now);

  buckets.recentlyUpdated = [...tickets]
    .sort((a, b) => new Date(b.updated_at ?? b.created_at) - new Date(a.updated_at ?? a.created_at))
    .slice(0, 8);

  return buckets;
}

export const QUICK_VIEWS = [
  { key: "all", label: "All", predicate: () => true },
  { key: "overdue", label: "Overdue", predicate: (t) => t.sla_status === "overdue" },
  { key: "awaiting_reply", label: "Awaiting My Reply", predicate: (t) => t.awaiting_engineer_reply },
  { key: "escalated", label: "Escalated", predicate: (t) => t.waiting_on_internal },
  { key: "critical", label: "Critical", predicate: (t) => t.severity === "critical" },
];
