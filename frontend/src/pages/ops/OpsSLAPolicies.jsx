import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/ToastContext";
import {
  getOpsSLAPolicies,
  createOpsSLAPolicy,
  updateOpsSLAPolicy,
  deleteOpsSLAPolicy,
} from "../../api/ops";
import { listServices } from "../../api/tickets";
import { extractErrorMessage } from "../../utils/apiError";
import PageHeader from "../../components/ui/PageHeader";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import TableCard from "../../components/table/TableCard";
import SelectFilter from "../../components/filters/SelectFilter";
import EmptyState from "../../components/ui/EmptyState";

// Mirrors backend/support_app/services/sla_service.py's _DEFAULTS — the
// hardcoded fallback applied when no SLAPolicy row matches a ticket's
// service_type/severity/plan. Reference only; not authoritative — the
// backend is the source of truth if this ever drifts.
const PLATFORM_DEFAULTS = [
  { severity: "critical", label: "Critical", firstResponse: 30 * 60, resolution: 8 * 3600 },
  { severity: "high", label: "High", firstResponse: 1 * 3600, resolution: 24 * 3600 },
  { severity: "medium", label: "Medium", firstResponse: 2 * 3600, resolution: 48 * 3600 },
  { severity: "low", label: "Low", firstResponse: 4 * 3600, resolution: 72 * 3600 },
];

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PLAN_OPTIONS = [
  { value: "default", label: "Default (all plans)" },
  { value: "free", label: "Free" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
];

function fmtSeconds(seconds) {
  if (seconds == null) return "—";
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

// ── Create / Edit Modal ────────────────────────────────────────────
function PolicyModal({ open, onClose, onSave, initial, services, loading, error }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    service_type: "", severity: "medium", plan: "default",
    first_response_hours: "", resolution_hours: "",
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        service_type: initial.service_type,
        severity: initial.severity,
        plan: initial.plan,
        first_response_hours: String(initial.first_response_seconds / 3600),
        resolution_hours: String(initial.resolution_seconds / 3600),
      });
    } else {
      setForm({
        service_type: services[0]?.key ?? "",
        severity: "medium", plan: "default",
        first_response_hours: "", resolution_hours: "",
      });
    }
  }, [open, initial, services]);

  if (!open) return null;

  const canSave = form.service_type && form.first_response_hours && form.resolution_hours;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      service_type: form.service_type,
      severity: form.severity,
      plan: form.plan,
      first_response_seconds: Math.round(Number(form.first_response_hours) * 3600),
      resolution_seconds: Math.round(Number(form.resolution_hours) * 3600),
    });
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? "Edit SLA Policy" : "New SLA Policy"}
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <Button onClick={handleSave} disabled={loading || !canSave} loading={loading}>
            {isEdit ? "Save Changes" : "Create Policy"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert severity="error">{error}</Alert>}

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Service</label>
          <Select
            value={form.service_type}
            onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))}
            disabled={isEdit}
          >
            {services.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Severity</label>
            <Select
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              disabled={isEdit}
            >
              {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Plan</label>
            <Select
              value={form.plan}
              onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
              disabled={isEdit}
            >
              {PLAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">First Response (hours)</label>
            <Input
              type="number" min="0" step="0.25"
              value={form.first_response_hours}
              onChange={(e) => setForm((f) => ({ ...f, first_response_hours: e.target.value }))}
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Resolution (hours)</label>
            <Input
              type="number" min="0" step="0.25"
              value={form.resolution_hours}
              onChange={(e) => setForm((f) => ({ ...f, resolution_hours: e.target.value }))}
              placeholder="e.g. 24"
            />
          </div>
        </div>
        {isEdit && (
          <p className="text-xs text-slate-500 italic">
            Service, severity, and plan cannot be changed once created — delete and re-create instead.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────
function DeleteConfirmModal({ open, onClose, onConfirm, policy, loading }) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Delete SLA Policy"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <Button variant="danger" onClick={onConfirm} disabled={loading} loading={loading}>
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 leading-relaxed">
        Remove this override for <span className="font-semibold text-slate-800">{policy?.service_type_display}</span>
        {" / "}<span className="font-semibold text-slate-800">{policy?.severity_display}</span>
        {" ("}{policy?.plan}{")"}? Tickets matching this combination will fall back to the default
        plan's policy, or the platform default if none exists.
      </p>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function OpsSLAPolicies() {
  usePageTitle("SLA Policies — ResolveHQ");
  const showToast = useToast();

  const [policies, setPolicies] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [serviceFilter, setServiceFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  const [modal, setModal] = useState({ open: false, policy: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, policy: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (serviceFilter) params.service_type = serviceFilter;
      if (severityFilter) params.severity = severityFilter;
      if (planFilter) params.plan = planFilter;
      const res = await getOpsSLAPolicies(params);
      setPolicies(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to load SLA policies."));
    } finally {
      setLoading(false);
    }
  }, [serviceFilter, severityFilter, planFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    listServices().then((res) => setServices(res.data?.services ?? [])).catch(() => setServices([]));
  }, []);

  const serviceOptions = [
    { value: "", label: "All Services" },
    ...services.map((s) => ({ value: s.key, label: s.name })),
  ];

  const handleSave = async (data) => {
    setActionLoading(true);
    setFormError(null);
    try {
      if (modal.policy) {
        await updateOpsSLAPolicy(modal.policy.id, {
          first_response_seconds: data.first_response_seconds,
          resolution_seconds: data.resolution_seconds,
        });
        showToast("SLA policy updated.", "success");
      } else {
        await createOpsSLAPolicy(data);
        showToast("SLA policy created.", "success");
      }
      setModal({ open: false, policy: null });
      load();
    } catch (e) {
      setFormError(extractErrorMessage(e, "Failed to save SLA policy."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteOpsSLAPolicy(deleteModal.policy.id);
      showToast("SLA policy deleted.", "success");
      setDeleteModal({ open: false, policy: null });
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, "Failed to delete SLA policy."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between gap-4">
          <PageHeader
            title="SLA Policies"
            description="Override response and resolution targets per service, severity, and plan."
          />
          <Button onClick={() => setModal({ open: true, policy: null })}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Policy
          </Button>
        </div>

        {/* Platform defaults reference */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Platform Defaults (apply when no override exists below)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLATFORM_DEFAULTS.map((d) => (
              <div key={d.severity} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-700">{d.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fmtSeconds(d.firstResponse)} response · {fmtSeconds(d.resolution)} resolution
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <SelectFilter value={serviceFilter} onChange={setServiceFilter} options={serviceOptions} ariaLabel="Service" />
          <SelectFilter value={severityFilter} onChange={setSeverityFilter} options={[{ value: "", label: "All Severities" }, ...SEVERITY_OPTIONS]} ariaLabel="Severity" />
          <SelectFilter value={planFilter} onChange={setPlanFilter} options={[{ value: "", label: "All Plans" }, ...PLAN_OPTIONS]} ariaLabel="Plan" />
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <TableCard
          columns={["Service", "Severity", "Plan", "First Response", "Resolution", "Actions"]}
          gridColsClassName="grid-cols-[1.3fr_0.8fr_0.9fr_1fr_1fr_auto]"
          loading={loading}
          isEmpty={policies.length === 0}
          emptyState={
            <EmptyState
              size="compact"
              icon={
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              }
              title="No SLA overrides configured"
              description="Every ticket currently uses the platform defaults shown above."
            />
          }
        >
          {policies.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-[1.3fr_0.8fr_0.9fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-900 truncate">{p.service_type_display}</p>
              <p className="text-sm text-slate-600">{p.severity_display}</p>
              <p className="text-sm text-slate-600 capitalize">{p.plan}</p>
              <p className="text-sm text-slate-600">{fmtSeconds(p.first_response_seconds)}</p>
              <p className="text-sm text-slate-600">{fmtSeconds(p.resolution_seconds)}</p>
              <div className="flex items-center gap-2 justify-end shrink-0">
                <button
                  onClick={() => setModal({ open: true, policy: p })}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteModal({ open: true, policy: p })}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </TableCard>

      </div>

      <PolicyModal
        open={modal.open}
        onClose={() => setModal({ open: false, policy: null })}
        onSave={handleSave}
        initial={modal.policy}
        services={services}
        loading={actionLoading}
        error={formError}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, policy: null })}
        onConfirm={handleDelete}
        policy={deleteModal.policy}
        loading={actionLoading}
      />
    </AppShell>
  );
}
