import { Link } from "react-router-dom";

// Shared card chrome — one consistent bg/border/radius/shadow/padding
// definition instead of each card hand-rolling its own (previously
// duplicated with slightly different values across TicketHeroHeader,
// ResolutionSummary, PostPaymentCard, DashboardSection, etc).
//
// Two header shapes are supported:
//   - `title` — small uppercase-tracking-widest label (sidebar-card style)
//   - `header`/`description`/`viewAllTo` — larger title + optional subtitle
//     + optional "View all →" link, with a bottom border separating it from
//     `children` (DashboardSection's shape) — pass `header` as the title text.
export default function Card({
  title,
  header,
  description,
  viewAllTo,
  viewAllLabel = "View all",
  padded = true,
  className = "",
  children,
}) {
  const hasSectionHeader = Boolean(header);

  return (
    <div
      data-ds="card"
      className={`bg-white border border-slate-200 rounded-2xl shadow-card-sm overflow-hidden ${className}`}
    >
      {title && (
        <p className={`text-card-label ${padded ? "px-5 pt-5" : "px-5 pt-5"} mb-3`}>{title}</p>
      )}

      {hasSectionHeader && (
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-section-title">{header}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {viewAllTo && (
            <Link to={viewAllTo} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0">
              {viewAllLabel} →
            </Link>
          )}
        </div>
      )}

      <div className={padded ? (hasSectionHeader ? "p-6" : title ? "px-5 pb-5" : "p-5") : ""}>
        {children}
      </div>
    </div>
  );
}
