// Horizontal row of preset filter shortcuts ("Saved Views"). Generic —
// takes a list of { key, label, filters } presets and reports which one
// (if any) is selected; the caller owns applying/matching filter state.
export default function QuickViews({ views, activeKey, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onSelect(v)}
          aria-pressed={activeKey === v.key}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors
            ${activeKey === v.key
              ? "bg-indigo-600 border-indigo-600 text-white"
              : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
          {v.label}
        </button>
      ))}
    </div>
  );
}
