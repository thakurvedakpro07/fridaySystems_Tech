import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getOpsAuditLog } from "../../api/ops";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import Alert from "../../components/ui/Alert";
import TableCard from "../../components/table/TableCard";
import Pagination from "../../components/table/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import FilterBar from "../../components/filters/FilterBar";

const ENTITY_OPTIONS = [
  { value: "", label: "All Entities" },
  { value: "user", label: "User" },
  { value: "service", label: "Service" },
  { value: "payment", label: "Payment" },
  { value: "sla_policy", label: "SLA Policy" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "user_deactivated", label: "User Deactivated" },
  { value: "user_reactivated", label: "User Reactivated" },
  { value: "service_created", label: "Service Created" },
  { value: "service_updated", label: "Service Updated" },
  { value: "service_archived", label: "Service Archived" },
  { value: "service_marked_unavailable", label: "Service Marked Unavailable" },
  { value: "service_reactivated", label: "Service Reactivated" },
  { value: "service_deleted", label: "Service Deleted" },
  { value: "payment_confirmed", label: "Payment Confirmed" },
  { value: "payment_refunded", label: "Payment Refunded" },
  { value: "sla_policy_created", label: "SLA Policy Created" },
  { value: "sla_policy_updated", label: "SLA Policy Updated" },
  { value: "sla_policy_deleted", label: "SLA Policy Deleted" },
];

// metadata keys are written by services/audit_service.py call sites — pick
// whichever descriptive key is present rather than dumping raw JSON.
function formatDetails(metadata) {
  if (!metadata) return "—";
  if (metadata.target_email) return metadata.target_email;
  if (metadata.invoice_number) return `Invoice ${metadata.invoice_number}`;
  if (metadata.name) return metadata.name;
  if (metadata.service_type) return `${metadata.service_type} / ${metadata.severity} (${metadata.plan})`;
  return "—";
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function OpsAuditLog() {
  usePageTitle("Audit Log — ResolveHQ");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      if (entityFilter) params.entity = entityFilter;
      if (actionFilter) params.action = actionFilter;
      const res = await getOpsAuditLog(params);
      const data = res.data ?? {};
      const results = data.results ?? (Array.isArray(data) ? data : []);
      setEntries(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrevious(data.previous ?? null);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [search, entityFilter, actionFilter, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const handleClear = () => {
    setSearch(""); setEntityFilter(""); setActionFilter(""); setPage(1);
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <PageHeader
          title="Audit Log"
          description="Immutable, system-wide trail of user, service, and payment actions."
        />

        {/* Filters */}
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search by user email…"
          status={entityFilter}
          onStatusChange={(v) => { setEntityFilter(v); setPage(1); }}
          statusOptions={ENTITY_OPTIONS}
          extraFilters={[
            {
              key: "action",
              value: actionFilter,
              onChange: (v) => { setActionFilter(v); setPage(1); },
              options: ACTION_OPTIONS,
              ariaLabel: "Action",
            },
          ]}
          onClear={handleClear}
        />

        {error && <Alert severity="error">{error}</Alert>}

        {/* Table */}
        <TableCard
          columns={["Action", "Entity", "Actor", "Details", "Date"]}
          gridColsClassName="grid-cols-[1.2fr_0.8fr_1.3fr_1.3fr_1fr]"
          loading={loading}
          isEmpty={entries.length === 0}
          emptyState={
            <EmptyState
              size="compact"
              icon={
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75M3.75 6.75h16.5M3.75 6.75v10.5A2.25 2.25 0 006 19.5h12a2.25 2.25 0 002.25-2.25V6.75M3.75 6.75L6 3.75h12l2.25 3" />
                </svg>
              }
              title="No audit entries found"
              description="User, service, and payment actions will appear here as they happen."
            />
          }
        >
          {entries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="grid grid-cols-[1.2fr_0.8fr_1.3fr_1.3fr_1fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
            >
              <Badge domain="auditAction" label={entry.action} />
              <Badge domain="auditEntity" label={entry.entity} />
              <p className="text-sm text-slate-700 truncate">{entry.user_email ?? "Unknown"}</p>
              <p className="text-xs text-slate-500 truncate">{formatDetails(entry.metadata)}</p>
              <p className="text-xs text-slate-500">{fmtDateTime(entry.created_at)}</p>
            </motion.div>
          ))}
        </TableCard>

        <Pagination
          page={page}
          pageSize={pageSize}
          count={count}
          hasPrevious={Boolean(previous)}
          hasNext={Boolean(next)}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={(v) => { setPageSize(Number(v)); setPage(1); }}
          itemLabel="record"
        />

      </div>
    </AppShell>
  );
}
