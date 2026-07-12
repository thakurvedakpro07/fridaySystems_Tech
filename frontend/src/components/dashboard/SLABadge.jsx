import LiveDot from "../ui/LiveDot";

// Inline badge for the `sla_status` enum computed server-side
// (OpsTicketListSerializer / FreelancerTicketListSerializer's
// get_sla_status: "overdue" | "due_soon" | "ok" | "no_deadline"), plus one
// client-only addition — "met" (used by useSlaClocks/TicketSLAPanel for a
// clock whose target was already hit, e.g. first response already given).
// Kept separate from ui/Badge.jsx since that component's color maps are
// keyed on ticket status/severity, not SLA health — overloading it would
// mean two unrelated enums fighting over the same color tokens.
const STYLES = {
  overdue:     { label: "Overdue",  classes: "bg-rose-50 text-rose-700 border-rose-200" },
  due_soon:    { label: "Due soon", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  ok:          { label: "On track", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  met:         { label: "Met",      classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  no_deadline: null, // nothing meaningful to show — render nothing
};

export default function SLABadge({ status }) {
  const style = STYLES[status];
  if (!style) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style.classes}`}>
      {status === "overdue" && <LiveDot tone="rose" size="xs" />}
      {style.label}
    </span>
  );
}
