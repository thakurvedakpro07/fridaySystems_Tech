import SelectFilter from "../filters/SelectFilter";

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

// Windowed page-number list so large datasets don't render hundreds of
// buttons: always show first/last, a small window around the current page,
// and "…" for any gap. E.g. total=20, current=8 → [1, "…", 6,7,8,9,10, "…", 20].
function getPageWindow(current, total, delta = 2) {
  if (total <= 1) return [1];

  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  const pages = [1];

  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);

  return pages;
}

export default function Pagination({ page, pageSize, count, hasPrevious, hasNext, loading, onPageChange, onPageSizeChange, itemLabel = "ticket" }) {
  if (loading || count === 0) return null;

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, count);
  const pageWindow = getPageWindow(page, totalPages);

  const navButtonClass = "text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 " +
    "text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={loading || !hasPrevious}
          className={navButtonClass}>
          ‹ Previous
        </button>

        {pageWindow.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="text-xs text-slate-500 px-1.5 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              disabled={loading}
              aria-current={p === page ? "page" : undefined}
              className={`text-xs font-semibold w-7 h-7 rounded-lg border transition-colors disabled:cursor-not-allowed
                ${p === page
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={loading || !hasNext}
          className={navButtonClass}>
          Next ›
        </button>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-xs text-slate-500">
          Showing {startItem}–{endItem} of {count} {itemLabel}{count !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Rows per page</span>
          <SelectFilter
            value={String(pageSize)}
            onChange={onPageSizeChange}
            options={PAGE_SIZE_OPTIONS}
            ariaLabel="Rows per page"
          />
        </div>
      </div>
    </div>
  );
}
