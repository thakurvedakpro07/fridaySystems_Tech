/**
 * Shared resolution-summary encoding + status transition helpers.
 *
 * No backend field or endpoint exists for structured resolution data
 * anywhere in this codebase (models.py/serializers.py/views.py/services/*
 * have no root_cause/steps_taken/prevention/time_spent/resolution_notes).
 * Ticket only has a generic `notes` admin-annotation field, and
 * AdminStatusSerializer/FreelancerStatusSerializer only accept `new_status`
 * + a freeform `note`.
 *
 * So this persists the 5 structured fields through the EXISTING internal-note
 * channel — addComment(ticketId, body, true) — encoded as a recognizable,
 * labeled text block that can be reliably parsed back out for structured
 * display. Used by both ResolutionPanel (capture/update, non-resolving) and
 * ResolveTicketPage (the dedicated resolve workflow) so the encoding format
 * only lives in one place.
 *
 * ── REQUIRED BACKEND WORK (still not done) ──────────────────────────────
 * To make this genuinely structured, persisted data instead of a specially
 * formatted comment:
 *   1. Add 5 nullable fields to Ticket (resolution_notes, root_cause,
 *      steps_taken, prevention_recommendations, time_spent_minutes) + one
 *      migration.
 *   2. Add the same 5 fields (optional) to AdminStatusSerializer and
 *      FreelancerStatusSerializer.
 *   3. Extend ticket_service.update_status() to persist them when
 *      new_status == "resolved" (single function already shared by both
 *      ops_status_update and freelancer_update_status).
 *   4. Expose the 5 fields (read-only) on TicketDetailSerializer.
 * Once that lands, callers should read/write those fields directly instead
 * of parsing them out of a comment body, and the compose/parse helpers
 * below can be deleted entirely.
 */
import { freelancerUpdateStatus } from "../api/tickets";
import { opsStatusUpdate } from "../api/ops";

export const RESOLUTION_MARKER = "📋 Resolution Summary";

export const FIELDS = [
  { key: "rootCause",       label: "Root Cause",             type: "textarea" },
  { key: "stepsTaken",      label: "Steps Taken",            type: "textarea" },
  { key: "resolutionNotes", label: "Resolution Notes",       type: "textarea" },
  { key: "prevention",      label: "Prevention / Follow-up", type: "textarea" },
  { key: "timeSpent",       label: "Time Spent",             type: "number" },
];

// Required when actually resolving a ticket (ResolveTicketPage). The
// standalone capture/update flow (ResolutionPanel, not resolving anything)
// keeps its own "at least one field" rule instead.
export const REQUIRED_TO_RESOLVE = new Set(["rootCause", "stepsTaken", "resolutionNotes"]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function composeBody(values) {
  const lines = [RESOLUTION_MARKER, ""];
  for (const { key, label, type } of FIELDS) {
    const raw = (values[key] ?? "").toString().trim();
    if (!raw) continue;
    lines.push(`${label}: ${type === "number" ? `${raw} minutes` : raw}`);
  }
  return lines.join("\n");
}

// Textareas allow multi-line values (a "Steps Taken" list very plausibly
// spans several lines), so each field's capture must span newlines and stop
// only at the next known "Label:" line or the true end of the string — NOT
// at the first line break, which is why this deliberately avoids the regex
// `m` flag (it would make `$` match end-of-line too, truncating any
// multi-line value after its first line).
const LABEL_ALTERNATION = FIELDS.map((f) => escapeRegex(f.label)).join("|");

export function parseBody(body) {
  const parsed = {};
  for (const { key, label } of FIELDS) {
    const re = new RegExp(
      `(?:^|\\n)${escapeRegex(label)}:\\s*([\\s\\S]*?)(?=\\n(?:${LABEL_ALTERNATION}):|$)`
    );
    const match = body.match(re);
    parsed[key] = match ? match[1].trim() : "";
  }
  return parsed;
}

// `feedItems` (from useConversationFeed) is chronologically ascending, so
// the last matching internal comment is the most recent resolution summary.
export function findLatestResolution(feedItems) {
  const matches = (feedItems ?? []).filter(
    (i) => i._kind === "comment" && i.is_internal && i.body?.startsWith(RESOLUTION_MARKER)
  );
  if (matches.length === 0) return null;
  const latest = matches[matches.length - 1];
  return { ...parseBody(latest.body), capturedAt: latest.created_at, capturedBy: latest.author_email };
}

// The one function that actually transitions a ticket to "resolved" — reuses
// the exact existing endpoint each role already used before (ops for staff,
// freelancer for engineers). Callers save the resolution summary first, then
// call this, so this stays a pure status transition with no knowledge of the
// resolution-summary encoding above.
export const resolveTicketByRole = (role, ticketId, note) =>
  (role === "freelancer" ? freelancerUpdateStatus : opsStatusUpdate)(ticketId, "resolved", note)
    .then(({ data }) => data);
