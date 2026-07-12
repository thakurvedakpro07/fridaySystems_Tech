/**
 * ResolutionSummary — read-only enterprise summary of how a ticket was
 * resolved, shown on the ticket detail page immediately below the header
 * once status === "resolved". Pure display: no form, no edit affordance —
 * ResolutionPanel already owns capture/update, this is the final read-only
 * record of what was submitted through the Resolve Ticket workspace.
 *
 * Data sources — all pre-existing, no backend changes:
 *   - ticket.resolved_at              (already on TicketDetailSerializer)
 *   - the "resolved" activity-log entry's actor_email, for "Resolved by" —
 *     TicketActivityLog has no is_internal concept, so it's visible to every
 *     role including the customer (unlike comments).
 *   - findLatestResolution(feedItems) (utils/resolution.js) for Root Cause /
 *     Steps Taken / Resolution Notes / Prevention / Time Spent. These are
 *     smuggled through an internal comment (see resolution.js's header
 *     comment for why), which the backend filters out of the customer's
 *     feed entirely (TicketCommentListCreateView.get_queryset). So this is
 *     structurally always null for role === "customer" — not a bug, and not
 *     something to paper over with "not provided" copy (that data DOES
 *     exist, it's just staff/engineer-only). The detailed sections therefore
 *     only render for non-customer roles; every role still gets the
 *     Resolved by / Resolved at confirmation.
 */
import { formatAbsoluteTime } from "../../utils/time";
import { getDisplayName } from "../../utils/displayName";
import { findLatestResolution } from "../../utils/resolution";

function fileBadge(mime, fileName) {
  const ext = (fileName?.split(".").pop() || "").toUpperCase();
  if (mime?.includes("pdf")) return { label: "PDF", classes: "bg-red-50 text-red-600 ring-red-100" };
  if (mime?.includes("zip")) return { label: "ZIP", classes: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (mime?.startsWith("image/")) return { label: ext || "IMG", classes: "bg-violet-50 text-violet-600 ring-violet-100" };
  return { label: ext || "FILE", classes: "bg-indigo-50 text-indigo-600 ring-indigo-100" };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Stored value is already like "45 minutes" or "90 minutes" (composeBody
// always appends the literal " minutes" regardless of magnitude) — this
// reformats the underlying number into "1 hour 30 minutes" / "3 hours".
function formatTimeSpent(raw) {
  const match = (raw ?? "").toString().match(/\d+/);
  if (!match) return null;
  const totalMinutes = parseInt(match[0], 10);
  if (!totalMinutes) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  return parts.join(" ");
}

function MetaField({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">{children}</p>
    </div>
  );
}

function ContentBlock({ title, value, emptyText }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-2">{title}</h3>
      {value ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">{emptyText}</p>
      )}
    </div>
  );
}

export default function ResolutionSummary({ ticket, feedItems, role }) {
  if (ticket?.status !== "resolved") return null;

  const items = feedItems ?? [];
  const resolvedEvent = items.find((i) => i._kind === "activity" && i.action === "resolved");
  const resolvedByEmail = resolvedEvent?.actor_email;
  const resolvedByName =
    resolvedByEmail && ticket.assigned_to?.email === resolvedByEmail
      ? (getDisplayName(ticket.assigned_to, "full") || resolvedByEmail)
      : resolvedByEmail;
  const resolvedAt = ticket.resolved_at ?? resolvedEvent?.created_at;

  const resolution = findLatestResolution(items);
  const timeSpent = formatTimeSpent(resolution?.timeSpent);
  const attachments = items.filter((i) => i._kind === "attachment");
  const showDetails = role !== "customer";

  return (
    <div
      className="max-w-[1100px] mx-auto w-full bg-white border border-slate-200 rounded-2xl p-5 sm:p-6"
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Resolution Summary</h2>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-4 pb-5 mb-5 border-b border-slate-100">
        <MetaField label="Resolved by">{resolvedByName ?? "—"}</MetaField>
        <MetaField label="Resolved at">{resolvedAt ? formatAbsoluteTime(resolvedAt) : "—"}</MetaField>
        {timeSpent && <MetaField label="Time Spent">{timeSpent}</MetaField>}
      </div>

      {showDetails && (
        resolution ? (
          <div className="space-y-5">
            <ContentBlock title="Root Cause" value={resolution.rootCause} emptyText="No root cause was provided." />
            <ContentBlock title="Steps Taken" value={resolution.stepsTaken} emptyText="No steps were recorded." />
            <ContentBlock title="Resolution Notes" value={resolution.resolutionNotes} emptyText="No resolution notes were provided." />
            <ContentBlock title="Prevention / Follow-up" value={resolution.prevention} emptyText="No prevention steps were provided." />

            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Attachments</h3>
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((a) => {
                    const badge = fileBadge(a.mime_type, a.file_name);
                    return (
                      <a
                        key={a.id}
                        href={a.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <span className={`w-8 h-8 rounded-md ring-1 flex items-center justify-center text-[9px] font-bold shrink-0 ${badge.classes}`}>
                          {badge.label}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">{a.file_name}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatBytes(a.file_size)}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No supporting files attached.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No structured resolution summary was recorded for this ticket.</p>
        )
      )}
    </div>
  );
}
