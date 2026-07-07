import { Link } from "react-router-dom";

// Canonical KPI/stat card — single source of truth replacing the four
// near-identical local KpiCard functions that used to live in
// Dashboard.jsx, FreelancerDashboard.jsx, OpsDashboard.jsx and
// AdminDashboard.jsx (each had drifted slightly: different icon
// treatment, different shadow tokens).
const KPI_STYLES = {
  indigo:  { num: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100" },
  blue:    { num: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100" },
  amber:   { num: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
  emerald: { num: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  violet:  { num: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100" },
  sky:     { num: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-100" },
  rose:    { num: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100" },
  orange:  { num: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-100" },
  teal:    { num: "text-teal-600",    bg: "bg-teal-50",    border: "border-teal-100" },
};

export default function KpiCard({ label, value, sub, color = "indigo", icon, loading, to }) {
  const s = KPI_STYLES[color] ?? KPI_STYLES.indigo;

  const inner = (
    <div
      className={`bg-white border ${s.border} rounded-2xl px-6 py-5 flex items-start justify-between gap-3
                 hover:-translate-y-0.5 transition-all duration-200 h-full ${to ? "" : "cursor-default"}`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.07), 0 0 0 1px rgb(0 0 0 / 0.02)" }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        {loading ? (
          <div className="h-10 w-16 shimmer rounded-lg mb-1" />
        ) : (
          <p className={`text-4xl font-black ${s.num} leading-none`}>{value ?? "—"}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-slate-500 mt-2 font-medium truncate">{sub}</p>
        )}
      </div>
      {icon && (
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.num}`}>
          {icon}
        </span>
      )}
    </div>
  );

  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return inner;
}
