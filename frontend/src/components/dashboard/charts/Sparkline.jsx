// Minimal trend line — used for "Revenue Trend" (monthly_revenue) and
// similar time-series KPIs. Same zero-dependency hand-rolled SVG approach
// as AnalyticsPage.jsx's BarChart/DonutChart, just a new shape (a line
// instead of bars) since none of the existing charts covered a trend line.
export default function Sparkline({ data, color = "#4f46e5", valueFormatter = (v) => v }) {
  if (!data?.length) return <p className="text-sm text-slate-500 text-center py-6">No data yet</p>;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 32;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : 0;
    const y = h - ((d.value - min) / range) * h;
    return `${x},${y}`;
  });

  const last = data[data.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-slate-500">{data[0]?.label}</span>
        <span className="text-sm font-semibold text-slate-900">{valueFormatter(last?.value)}</span>
        <span className="text-xs text-slate-500">{last?.label}</span>
      </div>
    </div>
  );
}
