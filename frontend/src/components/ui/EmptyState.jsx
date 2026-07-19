// Generic empty state used across search results, list pages, and filtered
// views. `size="compact"` is the smaller icon/tighter-copy variant
// previously hand-rolled per-file across ops list pages and TicketQueueTable
// — same icon-circle/title/description shape, just smaller, no `action` use
// seen in practice at this size.
const SIZE_STYLES = {
  default: {
    wrapper: "py-20 px-6",
    iconBox: "w-16 h-16 mb-5",
    icon: "w-8 h-8",
    title: "text-base font-bold text-slate-900 mb-2",
    description: "text-sm text-slate-500 max-w-sm mb-6 leading-relaxed",
  },
  compact: {
    wrapper: "py-16 px-6",
    iconBox: "w-12 h-12 mb-3",
    icon: "w-6 h-6",
    title: "text-sm font-semibold text-slate-700",
    description: "text-xs text-slate-500 mt-1",
  },
};

// `iconBoxClassName` is an escape hatch for empty states that need a
// distinctive icon-box treatment (e.g. a colored "welcome" zero-state) —
// when provided it fully replaces the default size/bg/rounding, "flex
// items-center justify-center" is always applied on top. Omitting it keeps
// every existing caller's default slate box unchanged.
export default function EmptyState({ icon, title, description, action, size = "default", iconBoxClassName }) {
  const s = SIZE_STYLES[size] ?? SIZE_STYLES.default;

  return (
    <div className={`flex flex-col items-center justify-center ${s.wrapper} text-center`}>
      <div className={`${iconBoxClassName ?? `${s.iconBox} bg-slate-100 rounded-2xl`} flex items-center justify-center`}>
        {typeof icon === "string" ? (
          <span className="text-2xl" role="img" aria-hidden="true">{icon}</span>
        ) : (
          icon ?? (
            <svg className={`${s.icon} text-slate-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          )
        )}
      </div>
      <p className={s.title}>{title}</p>
      {description && <p className={s.description}>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
