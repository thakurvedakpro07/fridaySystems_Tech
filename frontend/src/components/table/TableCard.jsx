// Shared table-shell chrome (card wrapper + column-header row + loading
// skeleton) — extracted from identical blocks previously duplicated in
// OpsUsers.jsx and OpsRoles.jsx. Body rows and the empty state stay as
// props/children so each caller keeps its own exact row shape and
// empty-state content.
export default function TableCard({ columns, gridColsClassName, loading, isEmpty, emptyState, children }) {
  const header = (
    <div className={`grid ${gridColsClassName} gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50`}>
      {columns.map((h) => (
        <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {header}
        <div className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {header}
        {emptyState}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* min-w-max + overflow-x-auto: the fixed-track column grids callers pass
          via gridColsClassName don't reflow on narrow viewports, so this lets
          the table scroll horizontally instead of clipping/overlapping (only
          needed here — the loading skeleton and empty state above don't use
          the fixed grid template, so they stay full-width). */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {header}
          <div className="divide-y divide-slate-50">{children}</div>
        </div>
      </div>
    </div>
  );
}
