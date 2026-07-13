// Shared table-shell chrome (card wrapper + column-header row + loading
// skeleton) — extracted from identical blocks previously duplicated in
// OpsUsers.jsx and OpsRoles.jsx. Body rows and the empty state stay as
// props/children so each caller keeps its own exact row shape and
// empty-state content.
export default function TableCard({ columns, gridColsClassName, loading, isEmpty, emptyState, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className={`grid ${gridColsClassName} gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50`}>
        {columns.map((h) => (
          <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>
        ))}
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : isEmpty ? (
        emptyState
      ) : (
        <div className="divide-y divide-slate-50">{children}</div>
      )}
    </div>
  );
}
