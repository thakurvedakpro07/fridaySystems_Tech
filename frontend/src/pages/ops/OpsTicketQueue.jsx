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

const SERVICE_OPTIONS = [
  { value: "", label: "All Services" },
  { value: "desktop", label: "Desktop" },
  { value: "linux", label: "Linux" },
  { value: "windows", label: "Windows" },
  { value: "patching", label: "Patching" },
  { value: "security", label: "Security" },
  { value: "vmware", label: "VMware" },
  { value: "sap", label: "SAP" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
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
  const [serviceType, setServiceType] = useState(searchParams.get("service_type") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");
  const [assignedTo, setAssignedTo] = useState(searchParams.get("assigned_to") ?? "");
  const [highlight, setHighlight] = useState(searchParams.get("highlight") ?? "");
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page"), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  // Raw DRF `ordering` value: "" = default (-created_at, sent by the
  // backend automatically when the param is omitted), "field" = ascending,
  // "-field" = descending.
  const [ordering, setOrdering] = useState(() => searchParams.get("ordering") ?? "");
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
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
      const currentOrdering = params.ordering ?? ordering;
      const currentServiceType = params.service_type ?? serviceType;
      const currentPriority = params.priority ?? priority;
      const currentAssignedTo = params.assigned_to ?? assignedTo;
      const res = await getOpsTickets({
        status: params.status ?? status,
        search: params.search ?? search,
        page: params.page ?? page,
        // Omit entirely when unset so the backend applies its own default
        // (-created_at) / no filter — matches how status/search are already omitted.
        ...(currentOrdering ? { ordering: currentOrdering } : {}),
        ...(currentServiceType ? { service_type: currentServiceType } : {}),
        ...(currentPriority ? { priority: currentPriority } : {}),
        ...(currentAssignedTo ? { assigned_to: currentAssignedTo } : {}),
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
  }, [status, search, page, ordering, serviceType, priority, assignedTo]);

  // Builds the canonical URL params object from current state, with
  // per-call overrides — the single source of truth for what goes in the
  // URL, used by every handler below so status/search/service_type/
  // priority/assigned_to/ordering/page all stay consistent together.
  function buildParams(overrides = {}) {
    const v = {
      status: overrides.status ?? status,
      search: overrides.search ?? search,
      service_type: overrides.service_type ?? serviceType,
      priority: overrides.priority ?? priority,
      assigned_to: overrides.assigned_to ?? assignedTo,
      ordering: overrides.ordering ?? ordering,
      page: overrides.page ?? page,
    };
    const p = {};
    if (v.status) p.status = v.status;
    if (v.search) p.search = v.search;
    if (v.service_type) p.service_type = v.service_type;
    if (v.priority) p.priority = v.priority;
    if (v.assigned_to) p.assigned_to = v.assigned_to;
    if (v.ordering) p.ordering = v.ordering;
    if (v.page > 1) p.page = String(v.page);
    return p;
  }

  useEffect(() => {
    loadFreelancers();
    loadTickets();
  }, []);  // initial load only

  // Restore status/service_type/priority/assigned_to/ordering on browser
  // Back/Forward (page/search keep their existing behavior — out of scope
  // here). Our own click/change handlers already update local state and
  // the URL together in the same render, so this is a no-op immediately
  // after them; it only actually fires on a true popstate navigation.
  useEffect(() => {
    const url = {
      status: searchParams.get("status") ?? "",
      service_type: searchParams.get("service_type") ?? "",
      priority: searchParams.get("priority") ?? "",
      assigned_to: searchParams.get("assigned_to") ?? "",
      ordering: searchParams.get("ordering") ?? "",
    };
    const changed =
      url.status !== status ||
      url.service_type !== serviceType ||
      url.priority !== priority ||
      url.assigned_to !== assignedTo ||
      url.ordering !== ordering;

    if (changed) {
      setStatus(url.status);
      setServiceType(url.service_type);
      setPriority(url.priority);
      setAssignedTo(url.assigned_to);
      setOrdering(url.ordering);
      loadTickets(url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function onSearchChange(val) {
    setSearch(val);
    setPage(1);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearchParams(buildParams({ search: val, page: 1 }), { replace: true });
      loadTickets({ search: val, page: 1 });
    }, 380);
  }

  function onPageChange(newPage) {
    if (newPage < 1) return;
    setPage(newPage);
    setSearchParams(buildParams({ page: newPage })); // push — a new history entry per page navigation
    loadTickets({ page: newPage });
  }

  // Clicking a sortable header cycles: ascending → descending → default (off).
  function onSort(field) {
    let nextOrdering;
    if (ordering === field) {
      nextOrdering = `-${field}`;
    } else if (ordering === `-${field}`) {
      nextOrdering = "";
    } else {
      nextOrdering = field;
    }
    setOrdering(nextOrdering);
    setPage(1); // a re-sorted result set invalidates the current page
    setSearchParams(buildParams({ ordering: nextOrdering, page: 1 })); // push — an explicit sort choice
    loadTickets({ ordering: nextOrdering, page: 1 });
  }

  // Any explicit filter change (status/service/priority/engineer) invalidates
  // the current page — reset to 1. Ordering and search are preserved.
  function onFilterChange(field, value) {
    const setters = {
      status: setStatus,
      service_type: setServiceType,
      priority: setPriority,
      assigned_to: setAssignedTo,
    };
    setters[field](value);
    setPage(1);
    setSearchParams(buildParams({ [field]: value, page: 1 }), { replace: true });
    loadTickets({ [field]: value, page: 1 });
  }

  function onAssignDone() {
    setModalTicket(null);
    loadTickets();
  }

  const engineerOptions = [
    { value: "", label: "All Engineers" },
    ...freelancers.map((f) => ({ value: f.id, label: f.name ?? f.email })),
  ];

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
          onStatusChange={(v) => onFilterChange("status", v)}
          statusOptions={STATUS_OPTIONS}
          extraFilters={[
            { key: "service_type", value: serviceType, onChange: (v) => onFilterChange("service_type", v), options: SERVICE_OPTIONS, ariaLabel: "Filter by service" },
            { key: "priority", value: priority, onChange: (v) => onFilterChange("priority", v), options: PRIORITY_OPTIONS, ariaLabel: "Filter by priority" },
            { key: "assigned_to", value: assignedTo, onChange: (v) => onFilterChange("assigned_to", v), options: engineerOptions, ariaLabel: "Filter by engineer" },
          ]}
          onClear={() => {
            setStatus("");
            setServiceType("");
            setPriority("");
            setAssignedTo("");
            setSearch("");
            setPage(1);
            // Clearing filters preserves the current sort — sorting isn't a filter.
            const p = {};
            if (ordering) p.ordering = ordering;
            setSearchParams(p, { replace: true });
            loadTickets({ status: "", search: "", service_type: "", priority: "", assigned_to: "", page: 1 });
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
          ordering={ordering}
          onSort={onSort}
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
