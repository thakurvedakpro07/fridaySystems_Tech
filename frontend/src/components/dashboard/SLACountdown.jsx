// Compact live countdown to an SLA deadline — reuses the same
// useCountdown hook and overdue/remaining color convention as
// TicketDetail.jsx's TicketStatusTracker, generalized to a plain
// `dueAt`/`kind` pair instead of the full ticket-lifecycle context.
import { useCountdown } from "../../hooks/useCountdown";

export default function SLACountdown({ dueAt, kind = "Resolution" }) {
  const { label, overdue } = useCountdown(dueAt);
  if (!label) return null;

  return (
    <span className={`text-xs font-medium ${overdue ? "text-rose-600" : "text-slate-500"}`}>
      {kind} · {label}
    </span>
  );
}
