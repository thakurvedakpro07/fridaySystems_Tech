import { motion } from "framer-motion";

// ── Shared status display helpers ──────────────────────────────────
// Exported (not just used internally) so OpsTicketQueue.jsx's AssignModal
// can render the same status/severity badges without a second definition.
export const STATUS_BADGE = {
  open:             "bg-indigo-100 text-indigo-700",
  assigned:         "bg-violet-100 text-violet-700",
  in_progress:      "bg-amber-100 text-amber-700",
  resolved:         "bg-emerald-100 text-emerald-700",
  closed:           "bg-slate-100 text-slate-500",
  pending_payment:  "bg-rose-100 text-rose-700",
};

export const STATUS_LABEL = {
  assigned:    "Ready to Start",
  in_progress: "Work Started",
};

export function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${colorClass}`}>
      {STATUS_LABEL[label] ?? String(label).replace(/_/g, " ")}
    </span>
  );
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function TicketQueueTable({ tickets, loading, highlight, onView, onAssign }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[auto_1fr_120px_130px_100px_80px_120px] gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50">
        {["#", "Ticket", "Status", "Service", "Created", "", "Action"].map((h, i) => (
          <span key={i} className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</span>
        ))}
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">No tickets found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search.</p>
        </div>
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
                className={`md:grid md:grid-cols-[auto_1fr_120px_130px_100px_80px_120px] gap-3 px-6 py-4
                           hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center`}>

                {/* # */}
                <span className="text-[11px] font-mono font-semibold text-slate-500 hidden md:block">{t.ticket_number}</span>

                {/* Title + mobile meta */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 md:hidden mb-1">
                    <span className="text-[11px] font-mono text-slate-500">{t.ticket_number}</span>
                    <Badge label={t.status} colorClass={STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"} />
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
                  <Badge label={t.status} colorClass={STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"} />
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
