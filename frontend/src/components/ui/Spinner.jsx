export default function Spinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
    lg: "w-8 h-8 border-[3px]",
  };

  return (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-slate-200 border-t-indigo-600 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-slate-400">Loading…</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 animate-skeleton-pulse"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-20 bg-slate-100 rounded-full" />
          <div className="h-4 w-3/4 bg-slate-100 rounded-full" />
          <div className="h-3 w-1/3 bg-slate-100 rounded-full" />
        </div>
        <div className="space-y-2 shrink-0">
          <div className="h-5 w-20 bg-slate-100 rounded-md" />
          <div className="h-5 w-16 bg-slate-100 rounded-md" />
        </div>
      </div>
      <div className="h-3 w-28 bg-slate-100 rounded-full mt-3" />
    </div>
  );
}
