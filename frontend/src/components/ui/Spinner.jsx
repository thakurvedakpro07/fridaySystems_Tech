/**
 * Spinner — animated loading indicator.
 * Replaces plain "Loading…" text throughout the app.
 *
 * Usage:
 *   <Spinner />                     // medium, default colour
 *   <Spinner size="sm" />           // small inline spinner
 *   <Spinner size="lg" className="mx-auto" />
 */
export default function Spinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-[3px]",
  };

  return (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-gray-200 border-t-blue-600 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * PageSpinner — full-height centred spinner for page-level loading.
 */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" />
    </div>
  );
}

/**
 * SkeletonCard — animated placeholder for a ticket card while loading.
 */
export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-skeleton-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
          <div className="h-3 w-1/3 bg-gray-200 rounded" />
        </div>
        <div className="space-y-2 shrink-0">
          <div className="h-5 w-20 bg-gray-200 rounded" />
          <div className="h-5 w-16 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="h-3 w-28 bg-gray-200 rounded mt-3" />
    </div>
  );
}
