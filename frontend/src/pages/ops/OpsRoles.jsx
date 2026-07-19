import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getOpsRoleAudit } from "../../api/ops";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import Alert from "../../components/ui/Alert";
import TableCard from "../../components/table/TableCard";
import EmptyState from "../../components/ui/EmptyState";

function RolePill({ role }) {
  return <Badge domain="role" label={role} />;
}

// Read-only reference matrix — mirrors the actual permission classes in
// backend/support_app/permissions.py. Not fetched from an API: the six
// roles and their capabilities are fixed/hardcoded on the backend today
// (no custom-role system exists), so a static mirror is the simplest
// correct source here. Keep in sync with permissions.py if that file's
// role predicates change.
const ROLE_CAPABILITIES = [
  {
    role: "customer",
    summary: "Self-service ticket submission and billing.",
    capabilities: [
      "Create and track own support tickets",
      "View own invoices and billing history",
      "Submit CSAT ratings on resolved tickets",
    ],
  },
  {
    role: "freelancer",
    summary: "Resolves tickets assigned by Operations.",
    capabilities: [
      "View and resolve only tickets assigned to them",
      "Post public and internal-only comments",
      "Submit a resolution for customer approval",
    ],
  },
  {
    role: "support_agent",
    summary: "Front-line ticket management, no financial or user access.",
    capabilities: [
      "View, assign, reassign, and escalate any ticket",
      "Update ticket status",
      "No access to payments, users, or platform settings",
    ],
  },
  {
    role: "finance_manager",
    summary: "Financial visibility and payment actions only.",
    capabilities: [
      "Confirm and refund payments",
      "View financial and executive analytics",
      "Cannot assign tickets, change status, or manage users",
    ],
  },
  {
    role: "operations_manager",
    summary: "Everything Support Agent can do, plus platform configuration.",
    capabilities: [
      "Everything Support Agent can do",
      "Manage Engineers, Services, and SLA Policies",
      "Read-only visibility into Users and Payments (cannot write)",
    ],
  },
  {
    role: "admin",
    summary: "Full platform access — the only role that can change roles.",
    capabilities: [
      "Everything every other role can do",
      "Change any user's role and deactivate/reactivate accounts (audited)",
      "Only role with access to Platform Settings and the System Audit Log",
    ],
  },
];

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function OpsRoles() {
  usePageTitle("Roles — ResolveHQ");

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
        <PageHeader title="Roles" description="What each role can do, and the immutable history of every role change." />

        {/* Role Capability Matrix */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-3">What Each Role Can Do</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLE_CAPABILITIES.map((r) => (
              <div key={r.role} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="mb-3">
                  <RolePill role={r.role} />
                </div>
                <p className="text-xs text-slate-500 mb-3">{r.summary}</p>
                <ul className="space-y-2">
                  {r.capabilities.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs text-slate-600">
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Role Change Audit */}
        <h2 className="text-sm font-bold text-slate-900 pt-2">Role Change Audit</h2>

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

        {error && <Alert severity="error">{error}</Alert>}

        {/* Timeline */}
        <TableCard
          columns={["User", "From", "To", "Changed By", "Date"]}
          gridColsClassName="grid-cols-[1.5fr_0.9fr_0.9fr_1.2fr_1fr]"
          loading={loading}
          isEmpty={entries.length === 0}
          emptyState={
            <EmptyState
              size="compact"
              icon={
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              }
              title="No role changes recorded"
              description="Every role promotion and demotion will appear here."
            />
          }
        >
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
                  <p className="text-[11px] text-slate-500 italic truncate mt-0.5">"{entry.note}"</p>
                )}
              </div>
              <RolePill role={entry.old_role} />
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <RolePill role={entry.new_role} />
              </div>
              <p className="text-xs text-slate-500 truncate">{entry.changed_by_email}</p>
              <p className="text-xs text-slate-500">{fmtDateTime(entry.timestamp)}</p>
            </motion.div>
          ))}
        </TableCard>

      </div>
    </AppShell>
  );
}
