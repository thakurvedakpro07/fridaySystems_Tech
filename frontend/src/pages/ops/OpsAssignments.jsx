import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getOpsTickets, getOpsTicketHistory, opsAssignTicket, opsUnassignTicket, getOpsFreelancers } from "../../api/ops";
import { usePageTitle } from "../../hooks/usePageTitle";

// ── Constants ─────────────────────────────────────────────────────
const STATUS_BADGE = {
  open:             "bg-indigo-100 text-indigo-700",
  assigned:         "bg-violet-100 text-violet-700",
  in_progress:      "bg-amber-100 text-amber-700",
  waiting_customer: "bg-orange-100 text-orange-700",
  resolved:         "bg-emerald-100 text-emerald-700",
  closed:           "bg-slate-100 text-slate-500",
  pending_payment:  "bg-rose-100 text-rose-700",
};

const AVAIL_LABEL = {
  full_time: "Full Time",
  part_time: "Part Time",
  ad_hoc:    "Ad Hoc",
};
const AVAIL_COLOR = {
  full_time: "bg-emerald-100 text-emerald-700",
  part_time: "bg-amber-100 text-amber-700",
  ad_hoc:    "bg-slate-100 text-slate-500",
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
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function engineerInitials(name, email) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (email ?? "?")[0].toUpperCase();
}

// ── Activity log icon by action ───────────────────────────────────
function ActivityIcon({ action }) {
  const label = (action ?? "").toLowerCase();
  if (label.includes("assign")) {
    return (
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      </div>
    );
  }
  if (label.includes("unassign") || label.includes("remove")) {
    return (
      <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      </div>
    );
  }
  if (label.includes("status")) {
    return (
      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </div>
  );
}

// ── Assign Engineer Modal ─────────────────────────────────────────
function AssignEngineerModal({ ticket, onClose, onAssigned }) {
  const [engineers, setEngineers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [successId, setSuccessId]   = useState(null);
  const [error, setError]           = useState("");
  const [unassignNote, setUnassignNote] = useState("");
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const serviceType = (ticket.service_type ?? "").toLowerCase();

  useEffect(() => {
    getOpsFreelancers()
      .then((r) => {
        const all = r.data?.results ?? r.data ?? [];
        // Matching engineers (by service type in skills) first, then sorted by active ticket count
        const match  = all.filter((e) => e.skills?.toLowerCase().includes(serviceType));
        const others = all.filter((e) => !e.skills?.toLowerCase().includes(serviceType));
        setEngineers([...match, ...others]);
      })
      .catch(() => setError("Could not load engineers."))
      .finally(() => setLoading(false));
  }, [serviceType]);

  async function doAssign(engineerId) {
    setAssigningId(engineerId);
    setError("");
    try {
      await opsAssignTicket(ticket.id, engineerId);
      setSuccessId(engineerId);
      setTimeout(() => { onAssigned(); onClose(); }, 800);
    } catch (e) {
      setError(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Assignment failed.");
      setAssigningId(null);
    }
  }

  async function doUnassign() {
    setUnassigning(true);
    setError("");
    try {
      await opsUnassignTicket(ticket.id, unassignNote);
      onAssigned();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error ?? e?.response?.data?.detail ?? "Unassign failed.");
      setUnassigning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-base">
                {ticket.freelancer ? "Reassign Engineer" : "Assign Engineer"}
              </h2>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{ticket.ticket_number}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-2 truncate">{ticket.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 capitalize">
              {String(ticket.service_type ?? "").replace(/_/g, " ")}
            </span>
            {ticket.severity && (
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                {ticket.severity}
              </span>
            )}
            {ticket.freelancer && (
              <span className="text-[11px] text-violet-600 font-medium">
                Current: {ticket.freelancer.name ?? ticket.freelancer.email}
              </span>
            )}
          </div>
        </div>

        {/* Body — engineer list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => <div key={n} className="h-20 bg-slate-50 animate-pulse rounded-xl" />)}
            </div>
          ) : error && engineers.length === 0 ? (
            <p className="text-sm text-rose-600 text-center py-8">{error}</p>
          ) : engineers.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-slate-700">No engineers available</p>
              <p className="text-xs text-slate-500 mt-1">Approve engineers in the user management panel first.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {engineers.map((eng) => {
                const isMatch   = !!eng.skills?.toLowerCase().includes(serviceType);
                const skills    = eng.skills
                  ? eng.skills.split(",").map((s) => s.trim()).filter(Boolean)
                  : [];
                const initials  = engineerInitials(eng.name, eng.email);
                const isAssigning = assigningId === eng.id;
                const isSuccess   = successId === eng.id;

                return (
                  <div
                    key={eng.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      isSuccess
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-indigo-700">{initials}</span>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{eng.name}</span>
                        {isMatch && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            ★ Recommended
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${AVAIL_COLOR[eng.availability] ?? "bg-slate-100 text-slate-500"}`}>
                          {AVAIL_LABEL[eng.availability] ?? eng.availability ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-500">
                          {eng.active_tickets ?? 0} active ticket{(eng.active_tickets ?? 0) !== 1 ? "s" : ""}
                        </span>
                        {eng.rating && parseFloat(eng.rating) > 0 && (
                          <span className="text-[11px] text-amber-600 font-medium">
                            ⭐ {parseFloat(eng.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded capitalize"
                            >
                              {skill}
                            </span>
                          ))}
                          {skills.length > 4 && (
                            <span className="text-[10px] text-slate-400">+{skills.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Assign button */}
                    <button
                      disabled={!!assigningId || !!successId}
                      onClick={() => doAssign(eng.id)}
                      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        isSuccess
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      }`}
                    >
                      {isSuccess ? "✓ Assigned" : isAssigning ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                );
              })}
              {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Unassign section (only for already-assigned tickets) */}
        {ticket.freelancer && (
          <div className="px-6 pb-5 pt-3 border-t border-slate-100 shrink-0">
            {!confirmUnassign ? (
              <button
                onClick={() => setConfirmUnassign(true)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
              >
                Unassign current engineer…
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  value={unassignNote}
                  onChange={(e) => setUnassignNote(e.target.value)}
                  placeholder="Reason for unassigning (optional)"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-800
                             focus:outline-none focus:ring-2 focus:ring-rose-400/60 transition"
                />
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={doUnassign}
                    disabled={unassigning}
                    className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-lg
                               hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    {unassigning ? "Unassigning…" : "Confirm Unassign"}
                  </button>
                  <button
                    onClick={() => { setConfirmUnassign(false); setError(""); }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── History drawer ────────────────────────────────────────────────
function HistoryDrawer({ ticket, onClose, onOpenAssignModal }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getOpsTicketHistory(ticket.id)
      .then((r) => setHistory(r.data?.results ?? r.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [ticket.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">

        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Assignment History</h3>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">{ticket.ticket_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ticket summary */}
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50 shrink-0">
          <p className="text-sm font-semibold text-slate-900 mb-2">{ticket.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge label={ticket.status} colorClass={STATUS_BADGE[ticket.status] ?? "bg-slate-100 text-slate-500"} />
            {ticket.severity && <Badge label={ticket.severity} colorClass="bg-slate-100 text-slate-600" />}
            {ticket.freelancer && (
              <span className="text-[11px] text-slate-500">
                Engineer: <span className="font-semibold">{ticket.freelancer.name ?? ticket.freelancer.email}</span>
              </span>
            )}
          </div>

          <button
            onClick={() => { onOpenAssignModal(ticket); onClose(); }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200
                       hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            {ticket.freelancer ? "Reassign Engineer →" : "Assign Engineer →"}
          </button>
        </div>

        {/* Activity log */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Activity Log</p>
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-4 w-px bg-slate-100" />
              <div className="space-y-5">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 relative">
                    <ActivityIcon action={entry.action} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-semibold text-slate-800 capitalize">
                        {String(entry.action ?? "").replace(/_/g, " ")}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-slate-500 mt-0.5">{entry.note}</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-1">
                        {fmtDate(entry.created_at)}
                        {entry.performed_by_name && (
                          <span className="ml-2">by <span className="font-medium">{entry.performed_by_name}</span></span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function OpsAssignments() {
  usePageTitle("Assignments — ResolveHQ Ops");

  const [tickets, setTickets]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [engineerCount, setEngineerCount] = useState(0);
  const [activeTicket, setActiveTicket]   = useState(null);
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [error, setError]                 = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketsRes, flRes] = await Promise.all([
        getOpsTickets({ ordering: "-updated_at" }),
        getOpsFreelancers(),
      ]);
      setTickets(ticketsRes.data?.results ?? ticketsRes.data ?? []);
      const fl = flRes.data?.results ?? flRes.data ?? [];
      setEngineerCount(fl.length);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assigned   = tickets.filter((t) => t.freelancer);
  const unassigned = tickets.filter((t) => !t.freelancer && t.status === "open");

  function openAssignModal(ticket) {
    setActiveTicket(null);
    setAssigningTicket(ticket);
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Assignments</h1>
          <p className="text-sm text-slate-500 mt-0.5">View and manage all ticket-engineer assignments.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Summary row */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Assigned",     value: assigned.length,   color: "text-violet-600" },
              { label: "Unassigned",   value: unassigned.length, color: "text-rose-600" },
              { label: "Total Active", value: tickets.filter((t) => !["resolved","closed"].includes(t.status)).length, color: "text-indigo-600" },
              { label: "Engineers",    value: engineerCount,     color: "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-5 py-4"
                   style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Assigned tickets */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
               style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Assigned Tickets</h2>
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                {assigned.length}
              </span>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-xl" />)}
              </div>
            ) : assigned.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">No assigned tickets.</div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
                {assigned.map((t) => (
                  <div key={t.id}
                       className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                       onClick={() => setActiveTicket(t)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-slate-500">{t.ticket_number}</span>
                        <Badge label={t.status} colorClass={STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        {t.freelancer.name ?? t.freelancer.email}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unassigned tickets */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
               style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Unassigned Open Tickets</h2>
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                {unassigned.length}
              </span>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-xl" />)}
              </div>
            ) : unassigned.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">All open tickets assigned</p>
                <p className="text-xs text-slate-500 mt-1">Good work!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
                {unassigned.map((t) => (
                  <div key={t.id}
                       className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <button
                      onClick={() => setActiveTicket(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-slate-500">{t.ticket_number}</span>
                        {t.severity && <Badge label={t.severity} colorClass="bg-slate-100 text-slate-600" />}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(t.created_at)}</p>
                    </button>
                    <button
                      onClick={() => openAssignModal(t)}
                      className="shrink-0 text-xs font-semibold text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded-lg
                                 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                    >
                      Assign →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History drawer */}
      <AnimatePresence>
        {activeTicket && (
          <HistoryDrawer
            ticket={activeTicket}
            onClose={() => setActiveTicket(null)}
            onOpenAssignModal={openAssignModal}
          />
        )}
      </AnimatePresence>

      {/* Assign engineer modal */}
      <AnimatePresence>
        {assigningTicket && (
          <AssignEngineerModal
            ticket={assigningTicket}
            onClose={() => setAssigningTicket(null)}
            onAssigned={() => { load(); setAssigningTicket(null); }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
