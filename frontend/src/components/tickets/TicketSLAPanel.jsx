/**
 * TicketSLAPanel — Response SLA and Resolution SLA shown side by side.
 * Content only (no card/section chrome of its own) — the caller wraps it
 * in a SidebarSection, same convention as TicketStatusTracker.
 */
import { useSlaClocks } from "../../hooks/useSlaClocks";
import { formatAbsoluteTime } from "../../utils/time";
import SLABadge from "../dashboard/SLABadge";

const BAR_TONE = {
  overdue:  "bg-rose-500",
  due_soon: "bg-amber-500",
  ok:       "bg-indigo-500",
  met:      "bg-emerald-500",
};

// Elapsed-vs-target visual — approximates how much of the SLA window has
// passed using the ticket's created_at as the clock's start. The backend
// doesn't expose a separate "clock started at" timestamp, so this is a
// client-side approximation good enough for an at-a-glance bar, not an
// authoritative figure.
function progressPct(clock, createdAt) {
  if (!clock.target || !createdAt || clock.status === "no_deadline") return null;
  if (clock.status === "met") return 100;
  const start = new Date(createdAt).getTime();
  const total = new Date(clock.target).getTime() - start;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, ((Date.now() - start) / total) * 100));
}

function SlaClockRow({ label, clock, createdAt }) {
  const pct = progressPct(clock, createdAt);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <SLABadge status={clock.status} />
      </div>
      {pct !== null && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-all duration-500 ${BAR_TONE[clock.status] ?? "bg-slate-300"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">
          {clock.target ? `Target: ${formatAbsoluteTime(clock.target)}` : "No target set"}
        </span>
        {clock.label && (
          <span className={`text-[11px] font-medium shrink-0 ${clock.overdue ? "text-rose-600" : "text-slate-500"}`}>
            {clock.label}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TicketSLAPanel({ ticket }) {
  const { response, resolution } = useSlaClocks(ticket);

  return (
    <div className="space-y-3">
      <SlaClockRow label="Response SLA" clock={response} createdAt={ticket?.created_at} />
      <SlaClockRow label="Resolution SLA" clock={resolution} createdAt={ticket?.created_at} />
    </div>
  );
}
