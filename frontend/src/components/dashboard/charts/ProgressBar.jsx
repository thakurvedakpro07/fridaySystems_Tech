// Generalizes the `h-1.5 bg-slate-100 rounded-full` inline pattern that
// was hand-rolled three times (Dashboard.jsx's InfoPanel response-time
// bars, ProfileCompletion's completion bar) with slightly different
// heights/colors each time.
export default function ProgressBar({ pct, color = "bg-indigo-500", height = "h-1.5" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`${height} bg-slate-100 rounded-full overflow-hidden`}>
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
