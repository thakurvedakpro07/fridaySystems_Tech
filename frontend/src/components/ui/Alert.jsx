const SEVERITY_STYLES = {
  error:   "bg-rose-50 border-rose-200 text-rose-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  info:    "bg-blue-50 border-blue-200 text-blue-700",
  success: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

const DEFAULT_ICONS = {
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Shared alert/banner — replaces the 5+ independently hand-rolled
// "rose error card" / amber warning blocks previously duplicated across
// TicketDetailPage, Dashboard, FreelancerDashboard, OpsDashboard,
// OpsTicketQueue with drifting radius/padding (rounded-xl vs rounded-2xl,
// px-4 py-3 vs px-5 py-4). Standardizes on rounded-xl px-4 py-3.
export default function Alert({ severity = "error", title, children, icon, onDismiss, className = "" }) {
  const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.error;
  const iconNode = icon ?? DEFAULT_ICONS[severity] ?? DEFAULT_ICONS.error;

  return (
    <div
      role="alert"
      data-ds="alert"
      className={`flex items-start gap-3 border rounded-xl px-4 py-3 text-sm ${styles} ${className}`}
    >
      {iconNode}
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
