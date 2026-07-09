import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import FilterBar from "../../components/filters/FilterBar";
import TicketQueueTable, { Badge, STATUS_BADGE } from "../../components/tickets/queue/TicketQueueTable";
import Pagination from "../../components/table/Pagination";
import { getOpsTickets, getOpsFreelancers, opsAssignTicket, opsUnassignTicket } from "../../api/ops";
import { usePageTitle } from "../../hooks/usePageTitle";

// ── Constants ─────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "", label: "All Tickets" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Ready to Start" },
  { value: "in_progress", label: "Work Started" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "pending_payment", label: "Pending Payment" },
];

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
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{ticket.ticket_number}</p>
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
              {ticket.severity && <Badge label={ticket.severity} colorClass="bg-slate-100 text-slate-600" />}
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

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freelancers, setFreelancers] = useState([]);
  const [modalTicket, setModalTicket] = useState(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [highlight, setHighlight] = useState(searchParams.get("highlight") ?? "");
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page"), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [error, setError] = useState(null);
  const searchDebounce = useRef(null);
  const isFirstStatusEffect = useRef(true);

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
        search: params.search ?? search,
        page: params.page ?? page,
        ordering: "-created_at",
      });
      const data = res.data ?? {};
      const results = data.results ?? (Array.isArray(data) ? data : []);
      setTickets(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrevious(data.previous ?? null);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    loadFreelancers();
    loadTickets();
  }, []);  // initial load only

  // Re-fetch when filters change
  useEffect(() => {
    // On initial mount, keep whatever page was deep-linked in the URL
    // (e.g. ?status=open&page=3) — effect above already triggered the
    // initial fetch, so just keep the URL params consistent without
    // resetting page or fetching again.
    if (isFirstStatusEffect.current) {
      isFirstStatusEffect.current = false;
      const p = {};
      if (status) p.status = status;
      if (search) p.search = search;
      if (page > 1) p.page = String(page);
      setSearchParams(p, { replace: true });
      return;
    }

    // An explicit status change invalidates the current page — reset to 1.
    const p = {};
    if (status) p.status = status;
    if (search) p.search = search;
    setPage(1);
    setSearchParams(p, { replace: true });
    loadTickets({ status, search, page: 1 });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSearchChange(val) {
    setSearch(val);
    setPage(1);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      const p = {};
      if (status) p.status = status;
      if (val) p.search = val;
      setSearchParams(p, { replace: true });
      loadTickets({ search: val, page: 1 });
    }, 380);
  }

  function onPageChange(newPage) {
    if (newPage < 1) return;
    const p = {};
    if (status) p.status = status;
    if (search) p.search = search;
    if (newPage > 1) p.page = String(newPage);
    setPage(newPage);
    setSearchParams(p); // push (no replace) — a new history entry per page navigation
    loadTickets({ page: newPage });
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
        <FilterBar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search by title or ticket number…"
          status={status}
          onStatusChange={setStatus}
          statusOptions={STATUS_OPTIONS}
          onClear={() => {
            setStatus("");
            setSearch("");
            setPage(1);
            setSearchParams({}, { replace: true });
            loadTickets({ status: "", search: "", page: 1 });
          }}
        />

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Ticket table */}
        <TicketQueueTable
          tickets={tickets}
          loading={loading}
          highlight={highlight}
          onView={(id) => navigate(`/tickets/${id}`)}
          onAssign={(t) => setModalTicket(t)}
        />

        <Pagination
          page={page}
          count={count}
          hasPrevious={Boolean(previous)}
          hasNext={Boolean(next)}
          loading={loading}
          onPageChange={onPageChange}
        />
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
