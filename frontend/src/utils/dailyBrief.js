// Pure function over bucketAndSortTickets' output — no network call, no
// LLM. Everything it needs is already in the browser from the single
// fetch-all-active-tickets request, so recomputing this server-side would
// just duplicate the same aggregation over the same rows.
export function buildDailyBrief(buckets) {
  const bullets = [
    { count: buckets.requiresImmediateAttention.length, text: "need immediate attention today" },
    { count: buckets.waitingOnInternal.length, text: "are escalated to the internal team" },
    { count: buckets.waitingOnCustomer.length, text: "are waiting on the customer to respond" },
    { count: buckets.readyToResolve.length, text: "look ready to resolve" },
  ].filter((b) => b.count > 0);

  const focusTicket =
    buckets.requiresImmediateAttention[0] ?? buckets.waitingOnInternal[0] ?? buckets.todaysWork[0] ?? null;

  return { bullets, focusTicket };
}
