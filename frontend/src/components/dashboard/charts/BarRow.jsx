// Horizontal bar row — one label + value per row, bar width proportional
// to the row's share of the max value in the set. Used for "Engineer
// Workload" (active ticket count per engineer) and similar ranked lists.
// Visual language matches AnalyticsPage.jsx's existing chart primitives
// (same stroke/track colors) so old and new dashboards don't drift apart.
export default function BarRow({ data, color = "#4f46e5", valueFormatter = (v) => v }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-700 font-medium truncate">{d.label}</span>
            <span className="text-sm font-semibold text-slate-900 shrink-0 ml-2">{valueFormatter(d.value)}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max((d.value / max) * 100, d.value ? 3 : 0)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
