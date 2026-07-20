import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/ToastContext";
import {
  getOpsServices,
  createOpsService,
  updateOpsService,
  deleteOpsService,
  archiveOpsService,
  markOpsServiceUnavailable,
  reactivateOpsService,
} from "../../api/ops";
import { extractErrorMessage } from "../../utils/apiError";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import RowCheckbox from "../../components/ui/RowCheckbox";
import EmptyState from "../../components/ui/EmptyState";
import SearchInput from "../../components/filters/SearchInput";
import SelectFilter from "../../components/filters/SelectFilter";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "unavailable", label: "Unavailable" },
  { value: "archived", label: "Archived" },
];

const COMMON_ICONS = ["🛠️", "💻", "🖥️", "☁️", "☸️", "🗄️", "🔁", "⚙️", "🔒", "📡", "🧩", "🧰"];

function computedStatus(service) {
  if (!service.is_active) return "archived";
  if (!service.is_available) return "unavailable";
  return "active";
}

function fmtMinutes(minutes) {
  if (minutes == null) return "—";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

// ── Create / Edit Modal ────────────────────────────────────────────
function ServiceModal({ open, onClose, onSave, initial, loading, error }) {
  const isEdit = !!initial;
  const blank = {
    name: "", category: "", description: "", icon: "🛠️",
    display_order: "0", resolution_fee: "",
    estimated_response_hours: "", estimated_resolution_hours: "",
    required_skills: "", is_active: true, is_available: true, featured: false,
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        category: initial.category ?? "",
        description: initial.description ?? "",
        icon: initial.icon || "🛠️",
        display_order: String(initial.display_order ?? 0),
        resolution_fee: String(initial.resolution_fee ?? 0),
        estimated_response_hours: initial.estimated_response_minutes != null ? String(initial.estimated_response_minutes / 60) : "",
        estimated_resolution_hours: initial.estimated_resolution_minutes != null ? String(initial.estimated_resolution_minutes / 60) : "",
        required_skills: initial.required_skills ?? "",
        is_active: initial.is_active,
        is_available: initial.is_available,
        featured: initial.featured,
      });
    } else {
      setForm(blank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  const canSave = form.name.trim() && form.resolution_fee !== "";

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      icon: form.icon || "🛠️",
      display_order: Number(form.display_order) || 0,
      resolution_fee: Number(form.resolution_fee) || 0,
      estimated_response_minutes: form.estimated_response_hours === "" ? null : Math.round(Number(form.estimated_response_hours) * 60),
      estimated_resolution_minutes: form.estimated_resolution_hours === "" ? null : Math.round(Number(form.estimated_resolution_hours) * 60),
      required_skills: form.required_skills.trim(),
      is_active: form.is_active,
      is_available: form.is_available,
      featured: form.featured,
    });
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? "Edit Service" : "New Service"}
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <Button onClick={handleSave} disabled={loading || !canSave} loading={loading}>
            {isEdit ? "Save Changes" : "Create Service"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert severity="error">{error}</Alert>}

        {isEdit && (
          <p className="text-xs text-slate-500 -mt-1">
            Internal key: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{initial.key}</code>
            {" "}(fixed — tickets reference this)
          </p>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Icon</label>
            <Input
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              className="w-16 text-center text-lg"
              maxLength={4}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Service Name <span className="text-rose-500">*</span></label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Kubernetes Support"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {COMMON_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setForm((f) => ({ ...f, icon: ic }))}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors ${
                form.icon === ic ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {ic}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Category</label>
          <Input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Cloud, Infrastructure, Data…"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Customer-facing description of what this service covers…"
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Resolution Fee (₹) <span className="text-rose-500">*</span></label>
            <Input
              type="number" min="0"
              value={form.resolution_fee}
              onChange={(e) => setForm((f) => ({ ...f, resolution_fee: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Display Order</label>
            <Input
              type="number"
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Est. Response (hours)</label>
            <Input
              type="number" min="0" step="0.25"
              value={form.estimated_response_hours}
              onChange={(e) => setForm((f) => ({ ...f, estimated_response_hours: e.target.value }))}
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Est. Resolution (hours)</label>
            <Input
              type="number" min="0" step="0.25"
              value={form.estimated_resolution_hours}
              onChange={(e) => setForm((f) => ({ ...f, estimated_resolution_hours: e.target.value }))}
              placeholder="e.g. 24"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Required Skills</label>
          <Input
            value={form.required_skills}
            onChange={(e) => setForm((f) => ({ ...f, required_skills: e.target.value }))}
            placeholder="e.g. aws, kubernetes, server_admin (comma-separated)"
          />
        </div>

        <div className="space-y-2.5 pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RowCheckbox checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} ariaLabel="Is Active" />
            <span className="text-sm text-slate-700">Active <span className="text-xs text-slate-500">(unchecking archives it)</span></span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RowCheckbox checked={form.is_available} onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))} ariaLabel="Is Available" />
            <span className="text-sm text-slate-700">Available <span className="text-xs text-slate-500">(unchecking marks it temporarily unavailable)</span></span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <RowCheckbox checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} ariaLabel="Featured" />
            <span className="text-sm text-slate-700">Featured <span className="text-xs text-slate-500">(highlighted in the customer catalog)</span></span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────
function DeleteConfirmModal({ open, onClose, onConfirm, service, loading }) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Delete Service"
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
        Permanently delete <span className="font-semibold text-slate-800">{service?.name}</span>?
        This cannot be undone. If this service has ever been ordered, deletion will be blocked —
        use Archive instead to hide it while preserving ticket history.
      </p>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function OpsServices() {
  usePageTitle("Services — ResolveHQ");
  const showToast = useToast();

  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [modal, setModal] = useState({ open: false, service: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, service: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search)         params.search = search;
      if (statusFilter)   params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await getOpsServices(params);
      setServices(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to load services."));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const categoryOptions = useMemo(() => {
    const cats = [...new Set(services.map((s) => s.category).filter(Boolean))].sort();
    return [{ value: "", label: "All Categories" }, ...cats.map((c) => ({ value: c, label: c }))];
  }, [services]);

  const handleSave = async (data) => {
    setActionLoading(true);
    setFormError(null);
    try {
      if (modal.service) {
        await updateOpsService(modal.service.id, data);
        showToast("Service updated.", "success");
      } else {
        await createOpsService(data);
        showToast("Service created.", "success");
      }
      setModal({ open: false, service: null });
      load();
    } catch (e) {
      setFormError(extractErrorMessage(e, "Failed to save service."));
    } finally {
      setActionLoading(false);
    }
  };

  const runAction = async (fn, successMsg) => {
    setActionLoading(true);
    try {
      await fn();
      showToast(successMsg, "success");
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, "Action failed."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteOpsService(deleteModal.service.id);
      showToast("Service deleted.", "success");
      setDeleteModal({ open: false, service: null });
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, "Failed to delete service."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between gap-4">
          <PageHeader
            title="Services"
            description="Manage the platform's service catalogue — customers see this live, including availability."
          />
          <Button onClick={() => setModal({ open: true, service: null })}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Service
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search services…" />
          <SelectFilter value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} ariaLabel="Category" />
          <SelectFilter value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} ariaLabel="Status" />
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Service cards */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl">
            <EmptyState
              size="compact"
              icon="🧰"
              title="No services found"
              description="Create your first service to get started."
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {services.map((s) => {
              const state = computedStatus(s);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <span className="text-2xl leading-none shrink-0" role="img" aria-hidden="true">{s.icon || "🛠️"}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                          {s.featured && <Badge tone="violet" shape="pill" label="Featured" />}
                        </div>
                        {s.category && <p className="text-xs text-slate-500 mt-0.5">{s.category}</p>}
                      </div>
                    </div>
                    <Badge domain="serviceStatus" label={state} />
                  </div>

                  {s.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">₹{s.resolution_fee}</span>
                    <span>{fmtMinutes(s.estimated_response_minutes)} response</span>
                    <span>{fmtMinutes(s.estimated_resolution_minutes)} resolution</span>
                  </div>

                  {s.required_skills && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.required_skills.split(",").map((skill) => skill.trim()).filter(Boolean).map((skill) => (
                        <span key={skill} className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 mt-auto border-t border-slate-100">
                    <button
                      onClick={() => setModal({ open: true, service: s })}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>

                    {state === "active" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => runAction(() => markOpsServiceUnavailable(s.id), `${s.name} marked temporarily unavailable.`)}
                        className="text-xs font-semibold text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Mark Unavailable
                      </button>
                    )}
                    {state !== "archived" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => runAction(() => archiveOpsService(s.id), `${s.name} archived.`)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Archive
                      </button>
                    )}
                    {state !== "active" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => runAction(() => reactivateOpsService(s.id), `${s.name} reactivated.`)}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteModal({ open: true, service: s })}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-600 px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <ServiceModal
        open={modal.open}
        onClose={() => setModal({ open: false, service: null })}
        onSave={handleSave}
        initial={modal.service}
        loading={actionLoading}
        error={formError}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, service: null })}
        onConfirm={handleDelete}
        service={deleteModal.service}
        loading={actionLoading}
      />
    </AppShell>
  );
}
