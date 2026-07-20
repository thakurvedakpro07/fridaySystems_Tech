// Horizontal row of preset filter shortcuts ("Saved Views"). Generic —
// takes a list of { key, label, filters } presets and reports which one
// (if any) is selected; the caller owns applying/matching filter state.
// `onRemove` is optional (existing static-preset callers — OpsTicketQueue,
// EngineerWorkspace — don't pass it, so their pills render unchanged);
// when provided (Dashboard's user-defined saved filters) each pill gets an
// inline "×" to delete that view.
export default function QuickViews({ views, activeKey, onSelect, onRemove }) {
  return (
    <div className="flex flex-wrap gap-2">
      {views.map((v) => {
        const active = activeKey === v.key;
        const toneClasses = active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "border-slate-200 text-slate-600 hover:bg-slate-100";

        if (!onRemove) {
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => onSelect(v)}
              aria-pressed={active}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${toneClasses}`}
            >
              {v.label}
            </button>
          );
        }

        // Two sibling buttons rather than nesting the "×" inside the pill
        // button — a clickable element nested inside a <button> is invalid
        // HTML/inaccessible, and the "×" needs to be independently
        // clickable without also triggering onSelect.
        return (
          <span
            key={v.key}
            className={`inline-flex items-center rounded-full border text-xs font-semibold transition-colors ${toneClasses}`}
          >
            <button type="button" onClick={() => onSelect(v)} aria-pressed={active} className="pl-3 pr-1 py-1.5">
              {v.label}
            </button>
            <button
              type="button"
              onClick={() => onRemove(v)}
              aria-label={`Remove ${v.label}`}
              className={`pr-2.5 pl-0.5 py-1.5 hover:opacity-70 ${active ? "text-white/80" : "text-slate-400"}`}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
