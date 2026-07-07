import { Link } from "react-router-dom";

// Reusable "white card + title + optional view-all link" wrapper —
// consolidates the pattern that used to be hand-rolled inline in
// OpsDashboard.jsx's "Unassigned Open Tickets" card and duplicated as
// AdminDashboard.jsx's local SectionHeader.
export default function DashboardSection({ title, description, viewAllTo, viewAllLabel = "View all", children, className = "" }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0">
            {viewAllLabel} →
          </Link>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
