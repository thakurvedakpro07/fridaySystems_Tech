import LiveDot from "../ui/LiveDot";

// Horizontal "what requires attention now" status strip — client-derived
// from the already-fetched Core + Live Command Center payloads (see
// utils/operationsBrief.js), no dedicated backend call. Composed entirely
// from existing primitives (LiveDot + the same tone/shimmer language every
// other dashboard widget already uses) rather than a new visual language.
const TONE_STYLES = {
  ok:       { bg: "bg-emerald-50 border-emerald-200", dot: "emerald", text: "text-emerald-700", message: "All systems nominal" },
  warning:  { bg: "bg-amber-50 border-amber-200",     dot: "amber",   text: "text-amber-700",   message: "Attention needed" },
  critical: { bg: "bg-rose-50 border-rose-200",        dot: "rose",    text: "text-rose-700",    message: "Critical — immediate action needed" },
};

const STATS = [
  { key: "incidentCount",      label: "Active Incidents" },
  { key: "slaBreachingCount",  label: "SLA Risk" },
  { key: "escalatedCount",     label: "Escalated" },
  { key: "overCapacityCount",  label: "Engineers Over Capacity" },
];

export default function OperationsHealthBanner({
  incidentCount, slaBreachingCount, escalatedCount, overCapacityCount, tone = "ok", loading,
}) {
  const s = TONE_STYLES[tone] ?? TONE_STYLES.ok;
  const values = { incidentCount, slaBreachingCount, escalatedCount, overCapacityCount };

  return (
    <div className={`flex flex-wrap items-center gap-6 rounded-2xl border px-6 py-4 ${s.bg}`}>
      <div className="flex items-center gap-2 shrink-0">
        <LiveDot tone={s.dot} size="sm" />
        <span className={`text-sm font-bold ${s.text}`}>{s.message}</span>
      </div>
      <div className="flex flex-wrap items-center gap-6 sm:ml-auto">
        {STATS.map(({ key, label }) => (
          <div key={key} className="text-center">
            {loading ? (
              <div className="h-7 w-8 shimmer rounded-lg mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-black text-slate-900 leading-none">{values[key] ?? 0}</p>
            )}
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1 whitespace-nowrap">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
