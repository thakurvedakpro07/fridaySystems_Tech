/**
 * useSlaClocks — derives Response SLA and Resolution SLA status/countdown
 * for a ticket from timestamps already present on it (first_response_due_at/
 * first_response_at, due_at/resolved_at). No backend field is required —
 * every value used here already comes back on TicketDetailSerializer.
 *
 * Mirrors the status thresholds of the backend's SLAStatusMixin
 * (overdue / due_soon within 2h / ok / no_deadline for resolved-closed-or-
 * unset tickets), plus one additional status this hook needs that the
 * backend enum doesn't have: "met" — the clock's target was already hit
 * (first response given, or ticket resolved) before any breach occurred.
 * This is an intentional client-side mirror, not a shared source of truth;
 * if the backend's threshold ever changes, this must be updated to match.
 */
import { useCountdown } from "./useCountdown";

const DUE_SOON_MS = 2 * 60 * 60 * 1000; // 2h — matches SLAStatusMixin

function clockStatus({ target, hasActual, isTerminal, overdue }) {
  // No target was ever set for this clock — nothing to have met or missed,
  // regardless of whether the ticket went on to get resolved anyway.
  if (!target) return "no_deadline";
  if (hasActual) return "met";
  if (isTerminal) return "no_deadline";
  if (overdue) return "overdue";
  const remainingMs = new Date(target).getTime() - Date.now();
  return remainingMs <= DUE_SOON_MS ? "due_soon" : "ok";
}

export function useSlaClocks(ticket) {
  const isTerminal = ticket?.status === "resolved" || ticket?.status === "closed";

  const hasFirstResponse = !!ticket?.first_response_at;
  const hasResolution    = !!ticket?.resolved_at;

  // Only pass a live target to useCountdown while the clock is actually
  // still running — once met or terminal, there's nothing left to tick.
  const responseTarget   = !hasFirstResponse && !isTerminal ? (ticket?.first_response_due_at ?? null) : null;
  const resolutionTarget = !hasResolution    && !isTerminal ? (ticket?.due_at ?? null)                : null;

  const response   = useCountdown(responseTarget);
  const resolution = useCountdown(resolutionTarget);

  return {
    response: {
      target: ticket?.first_response_due_at ?? null,
      status: clockStatus({
        target: ticket?.first_response_due_at,
        hasActual: hasFirstResponse,
        isTerminal,
        overdue: response.overdue,
      }),
      label: response.label,
      overdue: response.overdue,
    },
    resolution: {
      target: ticket?.due_at ?? null,
      status: clockStatus({
        target: ticket?.due_at,
        hasActual: hasResolution,
        isTerminal,
        overdue: resolution.overdue,
      }),
      label: resolution.label,
      overdue: resolution.overdue,
    },
  };
}
