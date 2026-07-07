import SearchInput from "./SearchInput";
import SelectFilter from "./SelectFilter";

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  statusOptions,
  onClear,
}) {
  const hasActiveFilters = Boolean(status || search);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

      <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />

      <SelectFilter value={status} onChange={onStatusChange} options={statusOptions} />

      {hasActiveFilters && (
        <button onClick={onClear}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-2 py-1">
          Clear ×
        </button>
      )}
    </div>
  );
}
