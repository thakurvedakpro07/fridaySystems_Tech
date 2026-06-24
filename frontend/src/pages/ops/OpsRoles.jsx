import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getOpsRoleAudit } from "../../api/ops";

const ROLE_DISPLAY = {
  customer:            "Customer",
  freelancer:          "Engineer",
  admin:               "Super Admin",
  operations_manager:  "Operations Manager",
  finance_manager:     "Finance Manager",
  support_agent:       "Support Agent",
};

const ROLE_COLORS = {
  customer:            "bg-slate-100 text-slate-700",
  freelancer:          "bg-indigo-100 text-indigo-700",
  admin:               "bg-violet-100 text-violet-700",
  operations_manager:  "bg-amber-100 text-amber-700",
  finance_manager:     "bg-teal-100 text-teal-700",
  support_agent:       "bg-orange-100 text-orange-700",
};

function RolePill({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLORS[role] ?? "bg-slate-100 text-slate-600"}`}>
      {ROLE_DISPLAY[role] ?? role}
    </span>
  );
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function OpsRoles() {
  usePageTitle("Role Audit Log — ResolveHQ");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const res = await getOpsRoleAudit(params);
      setEntries(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Role Change Audit</h1>
          <p className="text-sm text-slate-500 mt-0.5">Immutable log of every role promotion and demotion.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user email…"
            className="flex-1 min-w-[200px] text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All Roles</option>
            <option value="customer">Customer</option>
            <option value="freelancer">Engineer</option>
            <option value="support_agent">Support Agent</option>
            <option value="finance_manager">Finance Manager</option>
            <option value="operations_manager">Operations Manager</option>
            <option value="admin">Super Admin</option>
          </select>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Column headers */}
          <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_1.2fr_1fr] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
            {["User", "From", "To", "Changed By", "Date"].map((h) => (
              <p key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{h}</p>
            ))}
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No role changes recorded</p>
              <p className="text-xs text-slate-400 mt-1">Every role promotion and demotion will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {entries.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="grid grid-cols-[1.5fr_0.9fr_0.9fr_1.2fr_1fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{entry.target_email}</p>
                    {entry.note && (
                      <p className="text-[11px] text-slate-400 italic truncate mt-0.5">"{entry.note}"</p>
                    )}
                  </div>
                  <RolePill role={entry.old_role} />
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <RolePill role={entry.new_role} />
                  </div>
                  <p className="text-xs text-slate-500 truncate">{entry.changed_by_email}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(entry.timestamp)}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
