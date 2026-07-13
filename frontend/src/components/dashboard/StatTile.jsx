// Flat, no-shadow stat tile used by ops analytics/payments summary rows —
// extracted from identical `StatCard`/`SummaryCard` locals previously
// duplicated in OpsAnalytics.jsx and OpsPayments.jsx. Distinct from
// KpiCard.jsx's bordered/shadowed/`text-4xl` family — this one is
// `rounded-xl`, no shadow, `text-2xl`.
export default function StatTile({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
