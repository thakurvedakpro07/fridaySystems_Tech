// Top-of-page title block — distinct from DashboardSection/Card's in-card
// header. Standardizes the page-title typography that was drifting between
// font-black and font-bold across near-identical page headers.
export default function PageHeader({ title, description, actions, breadcrumb, className = "" }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1">{breadcrumb}</div>}
        <h1 className="text-page-title" data-ds="page-header">{title}</h1>
        {description && <p className="text-page-subtitle">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
