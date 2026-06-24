import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getOpsTickets, getOpsFreelancers, opsAssignTicket, opsUnassignTicket } from "../../api/ops";
import { usePageTitle } from "../../hooks/usePageTitle";

// ── Constants ─────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "", label: "All Tickets" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_customer", label: "Waiting Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "pending_payment", label: "Pending Payment" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_BADGE = {
  open:             "bg-indigo-100 text-indigo-700",
  assigned:         "bg-violet-100 text-violet-700",
  in_progress:      "bg-amber-100 text-amber-700",
  waiting_customer: "bg-orange-100 text-orange-700",
  resolved:         "bg-emerald-100 text-emerald-700",
  closed:           "bg-slate-100 text-slate-500",
  pending_payment:  "bg-rose-100 text-rose-700",
};

const PRIORITY_BADGE = {
  urgent: "bg-rose-100 text-rose-700",
  high:   "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-400",
};

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${colorClass}`}>
      {String(label).replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

// ── Assign / Unassign modal ───────────────────────────────────────
function AssignModal({ ticket, freelancers, onClose, onDone }) {
  const [selected, setSelected] = useState(ticket.freelancer?.id ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isReassign = Boolean(ticket.freelancer);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      if (isReassign && !selected) {
        await opsUnassignTicket(ticket.id, note);
      } else if (selected) {
        await opsAssignTicket(ticket.id, selected);
      }
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">{isReassign ? "Reassign" : "Assign"} Engineer</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{ticket.ticket_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Ticket summary */}
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-slate-800 truncate">{ticket.title}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge label={ticket.status} colorClass={STATUS_BADGE[ticket.status] ?? "bg-slate-100 text-slate-500"} />
              <Badge label={ticket.priority} colorClass={PRIORITY_BADGE[ticket.priority] ?? "bg-slate-100 text-slate-500"} />
            </div>
          </div>

          {isReassign && ticket.freelancer && (
            <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Currently assigned: <span className="font-semibold text-amber-700">{ticket.freelancer.name ?? ticket.freelancer.email}</span>
            </div>
          )}

          {/* Engineer select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isReassign ? "Reassign to" : "Assign to"} Engineer
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition">
              <option value="">
                {isReassign ? "— Unassign (no engineer) —" : "Select an engineer"}
              </option>
              {freelancers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name ?? f.user?.email} — {f.skills_display ?? f.skills ?? ""}
                  {f.active_ticket_count != null ? ` (${f.active_ticket_count} active)` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Unassign note */}
          {isReassign && !selected && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for unassigning (optional)</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Engineer unavailable, skill mismatch…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 resize-none
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition" />
            </div>
          )}

          {err && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 rounded-lg px-3 py-2">{err}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={loading || (!selected && !isReassign)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all
                       ${loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"}`}>
            {loading ? "Saving…" : isReassign && !selected ? "Unassign" : isReassign ? "Reassign" : "Assign"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function OpsTicketQueue() {
  usePageTitle("Ticket Queue — ResolveHQ Ops");

  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freelancers, setFreelancers] = useState([]);
  const [modalTicket, setModalTicket] = useState(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");
  const [highlight, setHighlight] = useState(searchParams.get("highlight") ?? "");
  const [error, setError] = useState(null);
  const searchDebounce = useRef(null);

  const loadFreelancers = useCallback(async () => {
    try {
      const res = await getOpsFreelancers();
      setFreelancers(res.data?.results ?? res.data ?? []);
    } catch (_) {}
  }, []);

  const loadTickets = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOpsTickets({
        status: params.status ?? status,
        priority: params.priority ?? priority,
        search: params.search ?? search,
        ordering: "-created_at",
      });
      setTickets(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [status, priority, search]);

  useEffect(() => {
    loadFreelancers();
    loadTickets();
  }, []);  // initial load only

  // Re-fetch when filters change
  useEffect(() => {
    const p = {};
    if (status) p.status = status;
    if (priority) p.priority = priority;
    if (search) p.search = search;
    setSearchParams(p, { replace: true });
    loadTickets({ status, priority, search });
  }, [status, priority]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSearchChange(val) {
    setSearch(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      loadTickets({ search: val });
    }, 380);
  }

  function onAssignDone() {
    setModalTicket(null);
    loadTickets();
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ticket Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">Filter, search, and assign engineers to tickets.</p>
        </div>

        {/* Filters bar */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3"
             style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by title or ticket number…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition" />
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition min-w-[160px]">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Priority filter */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition min-w-[140px]">
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Clear */}
          {(status || priority || search) && (
            <button onClick={() => { setStatus(""); setPriority(""); setSearch(""); loadTickets({ status: "", priority: "", search: "" }); }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-2 py-1">
              Clear ×
            </button>
          )}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Ticket table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
             style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[auto_1fr_120px_100px_130px_100px_120px] gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50">
            {["#", "Ticket", "Status", "Priority", "Service", "Created", "Action"].map((h) => (
              <span key={h} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
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
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No tickets found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search.</p>
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
                    className={`md:grid md:grid-cols-[auto_1fr_120px_100px_130px_100px_120px] gap-3 px-6 py-4
                               hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center`}>

                    {/* # */}
                    <span className="text-[11px] font-mono font-semibold text-slate-400 hidden md:block">{t.ticket_number}</span>

                    {/* Title + mobile meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 md:hidden mb-1">
                        <span className="text-[11px] font-mono text-slate-400">{t.ticket_number}</span>
                        <Badge label={t.status} colorClass={STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"} />
                        <Badge label={t.priority} colorClass={PRIORITY_BADGE[t.priority] ?? "bg-slate-100 text-slate-500"} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      {t.freelancer && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Assigned: <span className="font-medium">{t.freelancer.name ?? t.freelancer.email}</span>
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="hidden md:block">
                      <Badge label={t.status} colorClass={STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"} />
                    </div>

                    {/* Priority */}
                    <div className="hidden md:block">
                      <Badge label={t.priority} colorClass={PRIORITY_BADGE[t.priority] ?? "bg-slate-100 text-slate-500"} />
                    </div>

                    {/* Service */}
                    <div className="hidden md:block">
                      <span className="text-xs text-slate-500 capitalize">{t.service_type?.replace(/_/g, " ") ?? "—"}</span>
                    </div>

                    {/* Created */}
                    <div className="hidden md:block">
                      <span className="text-xs text-slate-400">{fmtDate(t.created_at)}</span>
                    </div>

                    {/* Action */}
                    <div className="md:justify-self-end mt-2 md:mt-0">
                      <button
                        onClick={() => setModalTicket(t)}
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

        {!loading && tickets.length > 0 && (
          <p className="text-xs text-slate-400 text-center">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalTicket && (
          <AssignModal
            ticket={modalTicket}
            freelancers={freelancers}
            onClose={() => setModalTicket(null)}
            onDone={onAssignDone} />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
