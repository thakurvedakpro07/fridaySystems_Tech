import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import AppShell from "../../components/layout/AppShell";
import FilterBar from "../../components/filters/FilterBar";
import QuickViews from "../../components/filters/QuickViews";
import TicketQueueTable, { Badge, STATUS_BADGE } from "../../components/tickets/queue/TicketQueueTable";
import Pagination from "../../components/table/Pagination";
import { getOpsTickets, getOpsFreelancers, opsAssignTicket, opsUnassignTicket, opsStatusUpdate } from "../../api/ops";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useSelection } from "../../hooks/useSelection";
import { useRoles } from "../../hooks/useRoles";
import { useToast } from "../../context/ToastContext";

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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20; // matches the backend's default when ?page_size= is omitted

// Built-in "Saved Views" — each is a full, exact filter state (not merged
// with whatever's currently set), so "is this preset active" can be a
// simple equality check. Only touches the four filter dimensions (status/
// service_type/priority/assigned_to) — search and ordering are left alone,
// consistent with how onFilterChange/onClear already treat search/ordering
// as separate from "filters" elsewhere in this file.
// Status mapping notes: "open" already means paid-but-unassigned in this
// system (see OpsDashboard's "open = unassigned" convention), so it maps
// to the Unassigned view; "in_progress" (actively being worked, including
// customer back-and-forth) is the closest match for "My Open Tickets".
const QUICK_VIEWS = [
  { key: "all",              label: "All Tickets",      filters: { status: "",             service_type: "", priority: "", assigned_to: "" } },
  { key: "my_open",          label: "My Open Tickets",  filters: { status: "in_progress",  service_type: "", priority: "", assigned_to: "" } },
  { key: "unassigned",       label: "Unassigned",       filters: { status: "open",          service_type: "", priority: "", assigned_to: "" } },
  { key: "pending_payment",  label: "Pending Payment",  filters: { status: "pending_payment", service_type: "", priority: "", assigned_to: "" } },
  { key: "high_priority",    label: "High Priority",    filters: { status: "",             service_type: "", priority: "high", assigned_to: "" } },
  { key: "linux",            label: "Linux",            filters: { status: "",             service_type: "linux", priority: "", assigned_to: "" } },
  { key: "windows",          label: "Windows",          filters: { status: "",             service_type: "windows", priority: "", assigned_to: "" } },
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

// ── Bulk assign modal ──────────────────────────────────────────────
// Assign-only (no unassign concept for a bulk selection). Reuses the same
// single-ticket assignment endpoint, looping sequentially since no bulk
// endpoint exists — a failed ticket doesn't stop the rest from being tried.
// Two-step flow: pick an engineer, then explicitly confirm before the loop
// (below, unchanged) actually runs — prevents an accidental mass-assign.
function BulkAssignModal({ ticketIds, freelancers, onClose, onDone }) {
  const [step, setStep] = useState("select"); // "select" | "confirm"
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedFreelancer = freelancers.find((f) => f.id === selected);
  const selectedFreelancerLabel = selectedFreelancer
    ? (selectedFreelancer.name ?? selectedFreelancer.user?.email ?? selectedFreelancer.email)
    : "";

  async function submit() {
    if (!selected) return;
    setLoading(true);
    setProgress(0);
    let succeeded = 0;
    let failed = 0;
    for (const ticketId of ticketIds) {
      try {
        await opsAssignTicket(ticketId, selected);
        succeeded++;
      } catch (e) {
        failed++;
      }
      setProgress((p) => p + 1);
    }
    setLoading(false);
    onDone({ succeeded, failed });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
         onClick={(e) => !loading && e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Assign Engineer</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ticketIds.length} ticket{ticketIds.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={onClose} disabled={loading}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "select" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assign to Engineer</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition">
                <option value="">Select an engineer</option>
                {freelancers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name ?? f.user?.email} — {f.skills_display ?? f.skills ?? ""}
                    {f.active_ticket_count != null ? ` (${f.active_ticket_count} active)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {step === "confirm" && !loading && (
            <p className="text-sm text-slate-700">
              Assign <span className="font-semibold">{ticketIds.length}</span> selected ticket{ticketIds.length !== 1 ? "s" : ""} to{" "}
              <span className="font-semibold">&ldquo;{selectedFreelancerLabel}&rdquo;</span>?
            </p>
          )}

          {loading && (
            <p className="text-xs text-slate-500">Assigning {progress} of {ticketIds.length}…</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => (step === "confirm" ? setStep("select") : onClose())}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button
            onClick={() => (step === "confirm" ? submit() : setStep("confirm"))}
            disabled={loading || !selected}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all
                       ${loading || !selected ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"}`}>
            {loading ? "Assigning…" : step === "confirm" ? "Assign Tickets" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Statuses that end a ticket's lifecycle — a bulk transition into one of
// these gets an extra warning in the confirmation step below.
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);

// ── Bulk status update modal ───────────────────────────────────────
// Same pattern as BulkAssignModal: reuses the existing single-ticket status
// endpoint, looping sequentially since no bulk endpoint exists — a failed
// ticket doesn't stop the rest from being tried. Two-step flow: pick a
// status, then explicitly confirm (with a terminal-status warning when
// applicable) before the loop (below, unchanged) actually runs.
function BulkStatusModal({ ticketIds, statusOptions, onClose, onDone }) {
  const [step, setStep] = useState("select"); // "select" | "confirm"
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedStatusLabel = statusOptions.find((o) => o.value === selected)?.label ?? selected;
  const isTerminalStatus = TERMINAL_STATUSES.has(selected);

  async function submit() {
    if (!selected) return;
    setLoading(true);
    setProgress(0);
    let succeeded = 0;
    let failed = 0;
    for (const ticketId of ticketIds) {
      try {
        await opsStatusUpdate(ticketId, selected);
        succeeded++;
      } catch (e) {
        failed++;
      }
      setProgress((p) => p + 1);
    }
    setLoading(false);
    onDone({ succeeded, failed });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
         onClick={(e) => !loading && e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Update Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ticketIds.length} ticket{ticketIds.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={onClose} disabled={loading}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "select" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Status</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition">
                <option value="">Select a status</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {step === "confirm" && !loading && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Update status of <span className="font-semibold">{ticketIds.length}</span> selected ticket{ticketIds.length !== 1 ? "s" : ""} to{" "}
                <span className="font-semibold">&ldquo;{selectedStatusLabel}&rdquo;</span>?
              </p>
              {isTerminalStatus && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  &ldquo;{selectedStatusLabel}&rdquo; ends a ticket's lifecycle. This affects multiple tickets at once — double-check the selection before continuing.
                </p>
              )}
            </div>
          )}

          {loading && (
            <p className="text-xs text-slate-500">Updating {progress} of {ticketIds.length}…</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => (step === "confirm" ? setStep("select") : onClose())}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button
            onClick={() => (step === "confirm" ? submit() : setStep("confirm"))}
            disabled={loading || !selected}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all
                       ${loading || !selected ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"}`}>
            {loading ? "Updating…" : step === "confirm" ? "Update Tickets" : "Confirm"}
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
  const { isTicketManagementStaff } = useRoles();
  // Both bulk actions currently require the same backend permission
  // (IsTicketManagementStaff on ops_assign_ticket / ops_status_update), but
  // gated independently per the actual authorization each one needs — not
  // collapsed into one flag — so they stay correct if that ever diverges.
  const canBulkAssign = isTicketManagementStaff;
  const canBulkUpdateStatus = isTicketManagementStaff;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freelancers, setFreelancers] = useState([]);
  const [modalTicket, setModalTicket] = useState(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const addToast = useToast();
  // Bulk selection — persists across page/filter/sort changes since it's
  // keyed purely on ticket id, independent of what `tickets` currently holds.
  const selection = useSelection();
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
  const [pageSize, setPageSize] = useState(() => {
    const s = parseInt(searchParams.get("page_size"), 10);
    return PAGE_SIZE_OPTIONS.includes(s) ? s : DEFAULT_PAGE_SIZE;
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
  // Tracks the in-flight tickets request so a newer loadTickets() call can
  // cancel whatever's still pending — prevents a slow, superseded response
  // from landing after a faster, newer one and overwriting current state
  // with stale data (see audit C1).
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Must reset to true here, not just at useRef(true) declaration time —
    // under StrictMode's dev-only mount→cleanup→mount double-invoke, the
    // cleanup below runs once synthetically before the "real" mount settles,
    // permanently flipping this to false with nothing to ever flip it back.
    // Every subsequent loadTickets() call would then hit its `!isMountedRef.
    // current` guard and silently bail before setTickets/setLoading(false),
    // even though the component is genuinely still mounted.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const loadFreelancers = useCallback(async () => {
    try {
      const res = await getOpsFreelancers();
      setFreelancers(res.data?.results ?? res.data ?? []);
    } catch (_) {}
  }, []);

  const loadTickets = useCallback(async (params = {}) => {
    // Cancel whatever request is still in flight before starting a new one
    // — only the request started here can go on to update state below.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const currentOrdering = params.ordering ?? ordering;
      const currentServiceType = params.service_type ?? serviceType;
      const currentPriority = params.priority ?? priority;
      const currentAssignedTo = params.assigned_to ?? assignedTo;
      const currentPageSize = params.page_size ?? pageSize;
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
        ...(currentPageSize !== DEFAULT_PAGE_SIZE ? { page_size: currentPageSize } : {}),
      }, { signal: controller.signal });

      if (!isMountedRef.current || controller.signal.aborted) return;
      const data = res.data ?? {};
      const results = data.results ?? (Array.isArray(data) ? data : []);
      setTickets(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrevious(data.previous ?? null);
    } catch (e) {
      // A superseded/unmount-triggered abort is expected, not a failure —
      // ignore it silently rather than surfacing an error banner.
      if (axios.isCancel(e) || controller.signal.aborted) return;
      if (!isMountedRef.current) return;
      setError(e?.response?.data?.detail ?? "Failed to load tickets.");
    } finally {
      // Only the request that "won" (wasn't itself aborted by a newer one)
      // gets to clear the loading state.
      if (isMountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [status, search, page, ordering, serviceType, priority, assignedTo, pageSize]);

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
      page_size: overrides.page_size ?? pageSize,
    };
    const p = {};
    if (v.status) p.status = v.status;
    if (v.search) p.search = v.search;
    if (v.service_type) p.service_type = v.service_type;
    if (v.priority) p.priority = v.priority;
    if (v.assigned_to) p.assigned_to = v.assigned_to;
    if (v.ordering) p.ordering = v.ordering;
    if (v.page > 1) p.page = String(v.page);
    if (v.page_size !== DEFAULT_PAGE_SIZE) p.page_size = String(v.page_size);
    return p;
  }

  useEffect(() => {
    loadFreelancers();
    loadTickets();
  }, []);  // initial load only

  // C2: whenever the visible ticket list changes — refresh, search, filter,
  // sort, pagination, page size, quick views, or a refetch after a bulk/
  // single-ticket action — drop any selected id that's no longer on screen.
  // Tied to `tickets` itself (not to which handler caused the change) so it
  // can't miss a case: every one of those flows ends the same way, a fresh
  // `setTickets(results)` in loadTickets. Reuses the existing `toggle`
  // (flips a selected id off) instead of adding new state to useSelection.
  useEffect(() => {
    if (selection.count === 0) return;
    const visibleIds = new Set(tickets.map((t) => t.id));
    selection.selected.forEach((id) => {
      if (!visibleIds.has(id)) selection.toggle(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  // Restore status/service_type/priority/assigned_to/ordering/page/page_size
  // on browser Back/Forward (search keeps its existing behavior — out of
  // scope here). Our own click/change handlers already update local state
  // and the URL together in the same render, so this is a no-op immediately
  // after them; it only actually fires on a true popstate navigation.
  useEffect(() => {
    const urlPage = (() => {
      const n = parseInt(searchParams.get("page"), 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    })();
    const urlPageSize = (() => {
      const n = parseInt(searchParams.get("page_size"), 10);
      return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
    })();
    const url = {
      status: searchParams.get("status") ?? "",
      service_type: searchParams.get("service_type") ?? "",
      priority: searchParams.get("priority") ?? "",
      assigned_to: searchParams.get("assigned_to") ?? "",
      ordering: searchParams.get("ordering") ?? "",
      page: urlPage,
      page_size: urlPageSize,
    };
    const changed =
      url.status !== status ||
      url.service_type !== serviceType ||
      url.priority !== priority ||
      url.assigned_to !== assignedTo ||
      url.ordering !== ordering ||
      url.page !== page ||
      url.page_size !== pageSize;

    if (changed) {
      setStatus(url.status);
      setServiceType(url.service_type);
      setPriority(url.priority);
      setAssignedTo(url.assigned_to);
      setOrdering(url.ordering);
      setPage(url.page);
      setPageSize(url.page_size);
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

  function onPageSizeChange(val) {
    const newSize = parseInt(val, 10);
    setPageSize(newSize);
    setPage(1); // changing page size resets to page 1
    setSearchParams(buildParams({ page_size: newSize, page: 1 })); // push — an explicit choice, like page navigation
    loadTickets({ page_size: newSize, page: 1 });
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

  // Applies a Saved View's full filter state at once (same "atomic reset"
  // pattern as onClear, just with preset target values instead of all-empty).
  function onQuickViewSelect(view) {
    setStatus(view.filters.status);
    setServiceType(view.filters.service_type);
    setPriority(view.filters.priority);
    setAssignedTo(view.filters.assigned_to);
    setPage(1);
    setSearchParams(buildParams({ ...view.filters, page: 1 }), { replace: true });
    loadTickets({ ...view.filters, page: 1 });
  }

  // A view is "active" only when every one of its filter values exactly
  // matches current state — no partial/best-effort match.
  const activeQuickViewKey = QUICK_VIEWS.find((v) =>
    v.filters.status === status &&
    v.filters.service_type === serviceType &&
    v.filters.priority === priority &&
    v.filters.assigned_to === assignedTo
  )?.key ?? null;

  function onAssignDone() {
    setModalTicket(null);
    loadTickets();
  }

  function onBulkAssignDone({ succeeded, failed }) {
    setBulkAssignOpen(false);
    selection.clear();
    loadTickets();
    if (failed === 0) {
      addToast(`Assigned ${succeeded} ticket${succeeded !== 1 ? "s" : ""}.`, "success");
    } else if (succeeded === 0) {
      addToast(`Failed to assign ${failed} ticket${failed !== 1 ? "s" : ""}. Please try again.`, "error");
    } else {
      addToast(`Assigned ${succeeded} ticket${succeeded !== 1 ? "s" : ""}; ${failed} failed.`, "warning");
    }
  }

  function onBulkStatusDone({ succeeded, failed }) {
    setBulkStatusOpen(false);
    selection.clear();
    loadTickets();
    if (failed === 0) {
      addToast(`Updated status for ${succeeded} ticket${succeeded !== 1 ? "s" : ""}.`, "success");
    } else if (succeeded === 0) {
      addToast(`Failed to update ${failed} ticket${failed !== 1 ? "s" : ""}. Please try again.`, "error");
    } else {
      addToast(`Updated ${succeeded} ticket${succeeded !== 1 ? "s" : ""}; ${failed} failed.`, "warning");
    }
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

        {/* Saved Views */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Saved Views</p>
          <QuickViews views={QUICK_VIEWS} activeKey={activeQuickViewKey} onSelect={onQuickViewSelect} />
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
            // Clearing filters preserves sort and page size — neither is a filter.
            setSearchParams(
              buildParams({ status: "", search: "", service_type: "", priority: "", assigned_to: "", page: 1 }),
              { replace: true }
            );
            loadTickets({ status: "", search: "", service_type: "", priority: "", assigned_to: "", page: 1 });
          }}
        />

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Hidden entirely when the current role can perform neither bulk
            action (e.g. Finance Manager) — selection itself still works,
            it's just this action surface that disappears. */}
        {selection.count > 0 && (canBulkAssign || canBulkUpdateStatus) && (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3">
            <p className="text-sm font-semibold text-indigo-900">
              Selected: {selection.count} ticket{selection.count !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              {canBulkAssign && (
                <button
                  onClick={() => setBulkAssignOpen(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Assign Engineer
                </button>
              )}
              {canBulkUpdateStatus && (
                <button
                  onClick={() => setBulkStatusOpen(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 transition-colors">
                  Update Status
                </button>
              )}
            </div>
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
          selectedIds={selection.selected}
          onToggleOne={selection.toggle}
          onToggleAll={selection.toggleAll}
        />

        <Pagination
          page={page}
          pageSize={pageSize}
          count={count}
          hasPrevious={Boolean(previous)}
          hasNext={Boolean(next)}
          loading={loading}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
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
        {bulkAssignOpen && (
          <BulkAssignModal
            ticketIds={Array.from(selection.selected)}
            freelancers={freelancers}
            onClose={() => setBulkAssignOpen(false)}
            onDone={onBulkAssignDone} />
        )}
        {bulkStatusOpen && (
          <BulkStatusModal
            ticketIds={Array.from(selection.selected)}
            statusOptions={STATUS_OPTIONS.filter((o) => o.value)}
            onClose={() => setBulkStatusOpen(false)}
            onDone={onBulkStatusDone} />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
