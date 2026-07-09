// Phase 1 of server-side pagination: minimal Previous/Next controls wired
// to the DRF PageNumberPagination envelope (count/next/previous), which the
// backend already returns but the frontend previously discarded. Page
// numbers and page-size selection are a later phase — this only adds what's
// needed to fetch/verify page navigation, filter preservation, and browser
// Back/Forward.
export default function Pagination({ page, count, hasPrevious, hasNext, loading, onPageChange }) {
  if (loading || count === 0) return null;

  const buttonClass = "text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 " +
    "text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={loading || !hasPrevious}
        className={buttonClass}>
        Previous
      </button>

      <p className="text-xs text-slate-500 text-center">{count} ticket{count !== 1 ? "s" : ""} total</p>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={loading || !hasNext}
        className={buttonClass}>
        Next
      </button>
    </div>
  );
}
