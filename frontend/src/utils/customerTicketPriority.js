// Client-side triage scoring/bucketing for the Customer Workspace. Mirrors
// utils/ticketPriority.js's approach (built for the Engineer Workspace) but
// from the customer's point of view. Input is one already-fetched "all
// active tickets" payload (?exclude_status=closed&page_size=100) — no
// server round-trip per section, same fetch-all-once strategy.

const TRIAGE_ACTIVE_STATUSES = new Set(["open", "assigned", "in_progress"]);
const SEVERITY_SCORE = { critical: 40, high: 25, medium: 10, low: 0 };
const MAX_AGE_DAYS = 10;
const MAX_AGE_BONUS = 10;

function ticketScore(ticket, now) {
  const ageDays = (now - new Date(ticket.created_at)) / 86_400_000;
  const ageBonus = Math.min(ageDays, MAX_AGE_DAYS) * (MAX_AGE_BONUS / MAX_AGE_DAYS);
  return (SEVERITY_SCORE[ticket.severity] ?? 0) + ageBonus;
}

function sortByScore(tickets, now) {
  return [...tickets]
    .map((t) => ({ ...t, priorityScore: ticketScore(t, now) }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.created_at) - new Date(b.created_at);
    });
}

/**
 * Buckets a customer's tickets into mutually-exclusive triage sections (plus
 * one non-exclusive "recentlyUpdated" cross-section). Precedence, evaluated
 * top-to-bottom so a ticket that qualifies for a more urgent bucket is never
 * buried in a calmer one:
 *   1. needsYourAction — pending_payment (pay to proceed) or resolved
 *      (confirm & rate). A blocking action only the customer can take,
 *      regardless of SLA/reply signals — those always read "no_deadline" /
 *      false for these two statuses (see backend SLAStatusMixin /
 *      ReplyOwnershipSignalsMixin), so checking them first is required, not
 *      just an ordering preference.
 *   2. overdue — SLA breached on an active ticket.
 *   3. waitingOnYou — the engineer replied last; the ball is in the
 *      customer's court.
 *   4. withEngineer — everything else active; the ball is with the
 *      engineer/support team.
 *   (closed tickets are excluded from every bucket — no triage action left)
 */
export function bucketCustomerTickets(tickets, now = new Date()) {
  const buckets = { needsYourAction: [], overdue: [], waitingOnYou: [], withEngineer: [] };

  for (const t of tickets) {
    if (t.status === "pending_payment" || t.status === "resolved") {
      buckets.needsYourAction.push(t);
    } else if (!TRIAGE_ACTIVE_STATUSES.has(t.status)) {
      continue;
    } else if (t.sla_status === "overdue") {
      buckets.overdue.push(t);
    } else if (t.waiting_on_customer) {
      buckets.waitingOnYou.push(t);
    } else {
      buckets.withEngineer.push(t);
    }
  }

  for (const key of Object.keys(buckets)) buckets[key] = sortByScore(buckets[key], now);

  buckets.recentlyUpdated = [...tickets]
    .sort((a, b) => new Date(b.updated_at ?? b.created_at) - new Date(a.updated_at ?? a.created_at))
    .slice(0, 6);

  return buckets;
}
