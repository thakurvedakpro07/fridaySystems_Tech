import SearchInput from "./SearchInput";
import SelectFilter from "./SelectFilter";

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  statusOptions,
  // Additional select-filter dropdowns beyond status, e.g. service/priority/
  // engineer: [{ key, value, onChange, options, ariaLabel }]. Optional so
  // existing single-status callers are unaffected.
  extraFilters = [],
  onClear,
}) {
  const hasActiveFilters = Boolean(status || search || extraFilters.some((f) => f.value));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

      <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />

      <SelectFilter value={status} onChange={onStatusChange} options={statusOptions} />

      {extraFilters.map((f) => (
        <SelectFilter key={f.key} value={f.value} onChange={f.onChange} options={f.options} ariaLabel={f.ariaLabel} />
      ))}

      {hasActiveFilters && (
        <button onClick={onClear}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-2 py-1">
          Clear ×
        </button>
      )}
    </div>
  );
}
