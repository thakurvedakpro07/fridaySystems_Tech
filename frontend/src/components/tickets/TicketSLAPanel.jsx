/**
 * TicketSLAPanel — Response SLA and Resolution SLA shown side by side.
 * Content only (no card/section chrome of its own) — the caller wraps it
 * in a SidebarSection, same convention as TicketStatusTracker.
 */
import { useSlaClocks } from "../../hooks/useSlaClocks";
import { formatAbsoluteTime } from "../../utils/time";
import SLABadge from "../dashboard/SLABadge";

function SlaClockRow({ label, clock }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <SLABadge status={clock.status} />
      </div>
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
      <SlaClockRow label="Response SLA" clock={response} />
      <SlaClockRow label="Resolution SLA" clock={resolution} />
    </div>
  );
}
