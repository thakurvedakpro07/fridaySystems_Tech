import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  getOpsServices,
  createOpsService,
  updateOpsService,
  toggleOpsService,
} from "../../api/ops";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";

// ── Service Form Modal ────────────────────────────────────────────
function ServiceModal({ open, onClose, onSave, initial, loading }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({ name: "", description: "", required_skills: "", status: "active" });

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { name: initial.name, description: initial.description, required_skills: initial.required_skills, status: initial.status }
        : { name: "", description: "", required_skills: "", status: "active" }
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10"
      >
        <h3 className="text-base font-bold text-slate-900 mb-5">
          {isEdit ? "Edit Service" : "Create Service"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Service Name <span className="text-rose-500">*</span></label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Linux Provisioning"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Brief description of what this service covers…"
              className="resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Required Skills</label>
            <Input
              value={form.required_skills}
              onChange={(e) => setForm((f) => ({ ...f, required_skills: e.target.value }))}
              placeholder="e.g. linux, bash, vmware (comma-separated)"
            />
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !form.name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-40"
          >
            {loading ? "Saving…" : (isEdit ? "Save Changes" : "Create Service")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function OpsServices() {
  usePageTitle("Services — ResolveHQ");

  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modal, setModal] = useState({ open: false, service: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await getOpsServices(params);
      setServices(res.data?.results ?? res.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData) => {
    setActionLoading(true);
    try {
      if (modal.service) {
        await updateOpsService(modal.service.id, formData);
        showToast("Service updated.");
      } else {
        await createOpsService(formData);
        showToast("Service created.");
      }
      setModal({ open: false, service: null });
      load();
    } catch (e) {
      const detail = e?.response?.data;
      const msg = typeof detail === "string" ? detail
        : detail?.name?.[0] ?? detail?.detail ?? "Failed to save service.";
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (service) => {
    try {
      await toggleOpsService(service.id);
      const next = service.status === "active" ? "inactive" : "active";
      showToast(`Service set to ${next}.`);
      load();
    } catch (e) {
      showToast(e?.response?.data?.detail ?? "Toggle failed.", "error");
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <PageHeader title="Services" description="Manage the platform's service catalogue." />
          <Button onClick={() => setModal({ open: true, service: null })}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Service
          </Button>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`px-4 py-3 rounded-xl text-sm font-semibold ${
                toast.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="flex-1 min-w-[200px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Service cards */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl">
            <EmptyState
              size="compact"
              icon={
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.905-2.72c.174-.168.35-.337.518-.512a5.29 5.29 0 00-7.497-7.497c-.175.168-.344.343-.512.518" />
                </svg>
              }
              title="No services found"
              description="Create your first service to get started."
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {services.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.description}</p>
                    )}
                  </div>
                  <Badge domain="active" label={s.status} />
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

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => setModal({ open: true, service: s })}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(s)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      s.status === "active"
                        ? "text-rose-600 border-rose-200 hover:border-rose-300"
                        : "text-emerald-600 border-emerald-200 hover:border-emerald-300"
                    }`}
                  >
                    {s.status === "active" ? "Disable" : "Enable"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ServiceModal
        open={modal.open}
        onClose={() => setModal({ open: false, service: null })}
        onSave={handleSave}
        initial={modal.service}
        loading={actionLoading}
      />
    </AppShell>
  );
}
