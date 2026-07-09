// Minimal clickable column header with a ↑/↓ indicator for the active
// sort column. `ordering` is the raw DRF ordering string (e.g. "-created_at",
// "title", or "" for the default/no explicit sort).
export default function SortableColumnHeader({ label, field, ordering, onSort }) {
  const isAsc = ordering === field;
  const isDesc = ordering === `-${field}`;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider
                 hover:text-slate-700 transition-colors">
      {label}
      {(isAsc || isDesc) && <span className="text-slate-400 normal-case">{isAsc ? "↑" : "↓"}</span>}
    </button>
  );
}
