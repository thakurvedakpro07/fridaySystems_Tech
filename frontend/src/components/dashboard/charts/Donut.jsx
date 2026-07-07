// Raw-SVG donut chart — ported directly from AnalyticsPage.jsx's
// DonutChart so the visual language (stroke width, rotation, legend
// layout) stays identical between the analytics page and the new
// dashboards instead of drifting into a second chart style.
export default function Donut({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className="text-sm text-slate-500 text-center py-6">No data yet</p>;

  let offset = 0;
  const r = 40;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
        {segments.map((seg, i) => {
          const pct    = seg.value / total;
          const dash   = pct * circ;
          const gap    = circ - dash;
          const stroke = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-stroke}
            />
          );
        })}
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-600">{seg.label}</span>
            <span className="font-semibold text-slate-900 ml-auto pl-4">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
