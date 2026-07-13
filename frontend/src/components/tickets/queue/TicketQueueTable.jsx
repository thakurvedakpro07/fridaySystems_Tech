import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import SortableColumnHeader from "../../table/SortableColumnHeader";
import Badge from "../../ui/Badge";
import EmptyState from "../../ui/EmptyState";

// Plain checkbox that also supports the (non-JSX-expressible) indeterminate
// state, needed for the header's "select all visible" control.
function RowCheckbox({ checked, indeterminate = false, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
    />
  );
}

// Column key → backend `ordering` field name. Only these four header cells
// are sortable per the current requirement.
const SORTABLE_HEADERS = [
  { key: "title", label: "Ticket" },
  { key: "status", label: "Status" },
  { key: "service_type", label: "Service" },
  { key: "created_at", label: "Created" },
];

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function TicketQueueTable({
  tickets, loading, highlight, ordering, onSort, onView, onAssign,
  selectedIds, onToggleOne, onToggleAll,
}) {
  const hasSelection = Boolean(selectedIds && onToggleOne && onToggleAll);
  const visibleIds = tickets.map((t) => t.id);
  const allVisibleSelected = hasSelection && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = hasSelection && visibleIds.some((id) => selectedIds.has(id));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[28px_auto_1fr_120px_130px_100px_80px_120px] gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50 items-center">
        <div>
          {hasSelection && (
            <RowCheckbox
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected && !allVisibleSelected}
              onChange={() => onToggleAll(visibleIds)}
              ariaLabel="Select all tickets on this page"
            />
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">#</span>
        {SORTABLE_HEADERS.map((col) => (
          <SortableColumnHeader key={col.key} label={col.label} field={col.key} ordering={ordering} onSort={onSort} />
        ))}
        <span />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Action</span>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          size="compact"
          icon={
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
          }
          title="No tickets found"
          description="Try adjusting your filters or search."
        />
      ) : (
        <div className="divide-y divide-slate-50">
          {tickets.map((t) => {
            const isHighlighted = highlight && t.id === highlight;
            return (
              <motion.div
                key={t.id}
                initial={isHighlighted ? { backgroundColor: "#eef2ff" } : false}
                animate={isHighlighted ? { backgroundColor: "#ffffff" } : {}}
                transition={{ duration: 1.5, delay: 0.3 }}
                className={`md:grid md:grid-cols-[28px_auto_1fr_120px_130px_100px_80px_120px] gap-3 px-6 py-4
                           hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center`}>

                {/* Select */}
                {hasSelection && (
                  <div className="hidden md:block">
                    <RowCheckbox
                      checked={selectedIds.has(t.id)}
                      onChange={() => onToggleOne(t.id)}
                      ariaLabel={`Select ticket ${t.ticket_number}`}
                    />
                  </div>
                )}

                {/* # */}
                <span className="text-[11px] font-mono font-semibold text-slate-500 hidden md:block">{t.ticket_number}</span>

                {/* Title + mobile meta */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 md:hidden mb-1">
                    {hasSelection && (
                      <RowCheckbox
                        checked={selectedIds.has(t.id)}
                        onChange={() => onToggleOne(t.id)}
                        ariaLabel={`Select ticket ${t.ticket_number}`}
                      />
                    )}
                    <span className="text-[11px] font-mono text-slate-500">{t.ticket_number}</span>
                    <Badge domain="ticketStatus" label={t.status} />
                  </div>
                  <button
                    onClick={() => onView(t.id)}
                    className="text-sm font-semibold text-slate-900 truncate hover:text-indigo-700 transition-colors text-left w-full"
                  >
                    {t.title}
                  </button>
                  {t.freelancer && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Assigned: <span className="font-medium">{t.freelancer.name ?? t.freelancer.email}</span>
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="hidden md:block">
                  <Badge domain="ticketStatus" label={t.status} />
                </div>

                {/* Service */}
                <div className="hidden md:block">
                  <span className="text-xs text-slate-500 capitalize">{t.service_type?.replace(/_/g, " ") ?? "—"}</span>
                </div>

                {/* Created */}
                <div className="hidden md:block">
                  <span className="text-xs text-slate-500">{fmtDate(t.created_at)}</span>
                </div>

                {/* View */}
                <div className="hidden md:block">
                  <button
                    onClick={() => onView(t.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200
                               text-slate-600 hover:bg-slate-100 transition-colors">
                    View
                  </button>
                </div>

                {/* Action */}
                <div className="md:justify-self-end mt-2 md:mt-0">
                  <button
                    onClick={() => onAssign(t)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors
                               ${t.freelancer
                                 ? "text-amber-700 border-amber-200 hover:bg-amber-50"
                                 : "text-indigo-700 border-indigo-200 hover:bg-indigo-50"}`}>
                    {t.freelancer ? "Reassign" : "Assign"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
