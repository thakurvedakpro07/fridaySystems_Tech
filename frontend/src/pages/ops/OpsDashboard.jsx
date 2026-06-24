import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { getOpsDashboard, getOpsTickets } from "../../api/ops";
import { usePageTitle } from "../../hooks/usePageTitle";

// ── Shared tokens ─────────────────────────────────────────────────
const KPI_STYLES = {
  indigo:  { num: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100" },
  emerald: { num: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  amber:   { num: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
  violet:  { num: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100" },
  sky:     { num: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-100" },
  rose:    { num: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100" },
  orange:  { num: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-100" },
};

const STATUS_COLORS = {
  open:             "bg-indigo-100 text-indigo-700",
  assigned:         "bg-violet-100 text-violet-700",
  in_progress:      "bg-amber-100 text-amber-700",
  waiting_customer: "bg-orange-100 text-orange-700",
  resolved:         "bg-emerald-100 text-emerald-700",
  closed:           "bg-slate-100 text-slate-600",
  pending_payment:  "bg-rose-100 text-rose-700",
};

function KpiCard({ label, value, sub, color = "indigo", icon, loading, to }) {
  const s = KPI_STYLES[color] ?? KPI_STYLES.indigo;
  const inner = (
    <div className={`bg-white border ${s.border} rounded-2xl px-6 py-5 flex items-start justify-between gap-3
                     hover:-translate-y-0.5 transition-all duration-200 h-full`}
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.07)" }}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        {loading ? (
          <div className="h-10 w-16 bg-slate-100 animate-pulse rounded-lg mb-1" />
        ) : (
          <p className={`text-4xl font-black ${s.num} leading-none`}>{value ?? "—"}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>
        )}
      </div>
      {icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.num}`}>
          {icon}
        </div>
      )}
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{inner}</Link>;
  }
  return inner;
}

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

// ── Icons ─────────────────────────────────────────────────────────
const IC = {
  ticket: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  assign: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  eng: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function OpsDashboard() {
  usePageTitle("Operations Dashboard — ResolveHQ");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [openTickets, setOpenTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatsLoading(true);
    setTicketsLoading(true);
    setError(null);
    try {
      const [dashRes, ticketsRes] = await Promise.all([
        getOpsDashboard(),
        getOpsTickets({ status: "open", ordering: "-created_at" }),
      ]);
      setStats(dashRes.data);
      setOpenTickets(ticketsRes.data?.results ?? ticketsRes.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load dashboard.");
    } finally {
      setStatsLoading(false);
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operations Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Ticket queue overview and freelancer assignment management.</p>
          </div>
          <Link to="/operations/tickets"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                       px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            Manage Tickets
          </Link>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-sm font-medium flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <KpiCard label="Open — Unassigned" value={stats?.open} color="indigo"
              sub="Awaiting engineer assignment" icon={IC.ticket} loading={statsLoading}
              to="/operations/tickets?status=open" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <KpiCard label="In Progress" value={(stats?.assigned ?? 0) + (stats?.in_progress ?? 0)}
              color="amber" sub="Assigned or actively worked" icon={IC.clock} loading={statsLoading}
              to="/operations/tickets?status=in_progress" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <KpiCard label="Waiting on Customer" value={stats?.waiting_customer} color="orange"
              sub="Engineer needs a response" icon={IC.alert} loading={statsLoading}
              to="/operations/tickets?status=waiting_customer" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <KpiCard label="Resolved / Closed" value={(stats?.resolved ?? 0) + (stats?.closed ?? 0)}
              color="emerald" sub="Successfully completed" icon={IC.check} loading={statsLoading}
              to="/operations/tickets?status=resolved" />
          </motion.div>
        </div>

        {/* Secondary row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <KpiCard label="Active Engineers" value={stats?.active_freelancers} color="violet"
              sub="Approved & available" icon={IC.eng} loading={statsLoading}
              to="/operations/freelancers" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
            className="lg:col-span-2">
            <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl px-6 py-5 text-white h-full flex items-center justify-between"
                 style={{ boxShadow: "0 4px 20px -4px rgb(13 148 136 / 0.35)" }}>
              <div>
                <p className="text-[10px] font-bold text-teal-200 uppercase tracking-widest mb-2">
                  Platform Revenue
                </p>
                {statsLoading ? (
                  <div className="h-10 w-32 bg-white/20 animate-pulse rounded-lg" />
                ) : (
                  <p className="text-4xl font-black leading-none">
                    {stats?.revenue != null ? `₹${Number(stats.revenue).toLocaleString("en-IN")}` : "₹0"}
                  </p>
                )}
                <p className="text-xs text-teal-200 mt-2">From completed payments</p>
              </div>
              <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Open tickets needing assignment */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
               style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Unassigned Open Tickets</h2>
                <p className="text-xs text-slate-400 mt-0.5">Tickets paid and waiting for an engineer</p>
              </div>
              <Link to="/operations/tickets?status=open"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                View all →
              </Link>
            </div>

            {ticketsLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : openTickets.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">All open tickets are assigned</p>
                <p className="text-xs text-slate-400 mt-1">No unassigned tickets at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {openTickets.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-semibold text-slate-400">{t.ticket_number}</span>
                        {t.severity && <Badge label={t.severity} colorClass="bg-slate-100 text-slate-600" />}
                        <Badge label={t.service_type?.replace(/_/g, " ") ?? "—"} colorClass="bg-slate-100 text-slate-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(t.created_at)}</p>
                    </div>
                    <Link to={`/operations/tickets?highlight=${t.id}`}
                      className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200
                                 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors">
                      Assign →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick nav cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { to: "/operations/tickets", label: "Ticket Queue", desc: "Filter, search, and assign all tickets", color: "indigo" },
            { to: "/operations/freelancers", label: "Engineer Roster", desc: "Skills, availability, and active load", color: "violet" },
            { to: "/operations/assignments", label: "Assignment History", desc: "View all assignment and reassignment events", color: "emerald" },
          ].map((card) => {
            const s = KPI_STYLES[card.color];
            return (
              <Link key={card.to} to={card.to}
                className={`bg-white border ${s.border} rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group`}
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <p className={`text-sm font-bold ${s.num} mb-1`}>{card.label}</p>
                <p className="text-xs text-slate-400">{card.desc}</p>
                <p className={`text-xs font-semibold ${s.num} mt-3 group-hover:translate-x-1 transition-transform duration-150`}>
                  Open →
                </p>
              </Link>
            );
          })}
        </div>

      </div>
    </AppShell>
  );
}
