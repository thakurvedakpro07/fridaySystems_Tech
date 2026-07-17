import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useAuthStore } from "../../store/authStore";
import {
  getOpsUsers,
  opsChangeRole,
  opsDeactivateUser,
  opsReactivateUser,
} from "../../api/ops";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import Alert from "../../components/ui/Alert";
import TableCard from "../../components/table/TableCard";
import Pagination from "../../components/table/Pagination";

// ── Constants ─────────────────────────────────────────────────────
// Human-readable role labels — kept here (rather than only inside Badge's
// "role" domain) since this file also uses them for modal copy ("Change
// role for X (currently Y)"), not just badge rendering.
const ROLE_DISPLAY = {
  customer:            "Customer",
  freelancer:          "Engineer",
  admin:               "Super Admin",
  operations_manager:  "Operations Manager",
  finance_manager:     "Finance Manager",
  support_agent:       "Support Agent",
};

// Mirrors _ALLOWED_TRANSITIONS in views.py — keeps the role picker filtered client-side
// to prevent confusing "transition not allowed" server errors.
const ALLOWED_TRANSITIONS = {
  customer:            ["freelancer", "operations_manager", "finance_manager", "support_agent", "admin"],
  freelancer:          ["customer", "operations_manager", "finance_manager", "support_agent", "admin"],
  operations_manager:  ["customer", "freelancer", "finance_manager", "support_agent", "admin"],
  finance_manager:     ["customer", "operations_manager", "support_agent"],
  support_agent:       ["customer", "operations_manager", "finance_manager"],
  admin:               ["operations_manager"],
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

// ── Confirmation Modal ────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger = false, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10"
      >
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{body}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50 ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Role Change Modal ─────────────────────────────────────────────
function RoleChangeModal({ open, onClose, user, onConfirm, loading }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) { setSelectedRole(""); setNote(""); setConfirmed(false); }
  }, [open]);

  if (!open || !user) return null;

  const allowed = ALLOWED_TRANSITIONS[user.role] ?? [];
  const fromLabel = ROLE_DISPLAY[user.role] ?? user.role;
  const toLabel   = ROLE_DISPLAY[selectedRole] ?? selectedRole;

  const handleConfirm = () => {
    if (!selectedRole) return;
    if (!confirmed) { setConfirmed(true); return; }
    onConfirm(selectedRole, note);
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
        {!confirmed ? (
          <>
            <h3 className="text-base font-bold text-slate-900 mb-1">Change Role</h3>
            <p className="text-sm text-slate-500 mb-5">
              Change role for <span className="font-semibold text-slate-800">{user.full_name || user.email}</span>
              {" "}(currently <span className="font-semibold">{fromLabel}</span>)
            </p>

            <div className="space-y-2 mb-5">
              {allowed.map((role) => (
                <label key={role}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedRole === role
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                    className="accent-indigo-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ROLE_DISPLAY[role]}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Reason for role change…"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedRole}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-bold text-slate-900 mb-4">Confirm Role Change</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700">{user.full_name || user.email}</p>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{fromLabel}</span>
                {" → "}
                <span className="font-semibold text-indigo-700">{toLabel}</span>
              </p>
              {note && <p className="text-xs text-slate-500 italic">"{note}"</p>}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmed(false)} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Back
              </button>
              <button
                onClick={() => onConfirm(selectedRole, note)}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? "Saving…" : "Confirm"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function OpsUsers() {
  usePageTitle("User Management — ResolveHQ");
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.is_staff && currentUser?.role === "admin";

  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [count, setCount]       = useState(0);
  const [next, setNext]         = useState(null);
  const [previous, setPrevious] = useState(null);

  const [roleModal, setRoleModal]   = useState({ open: false, user: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, user: null, label: "", body: "", danger: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: pageSize };
      if (search)      params.search    = search;
      if (roleFilter)  params.role      = roleFilter;
      if (activeFilter !== "") params.is_active = activeFilter;
      const res = await getOpsUsers(params);
      const data = res.data ?? {};
      const results = data.results ?? (Array.isArray(data) ? data : []);
      setUsers(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrevious(data.previous ?? null);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, activeFilter, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  // ── Role change ──────────────────────────────────────────────
  const handleRoleChange = async (newRole, note) => {
    setActionLoading(true);
    try {
      await opsChangeRole(roleModal.user.id, newRole, note);
      showToast(`Role updated to ${ROLE_DISPLAY[newRole]}.`);
      setRoleModal({ open: false, user: null });
      load();
    } catch (e) {
      showToast(e?.response?.data?.detail ?? "Failed to change role.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Deactivate / Reactivate ───────────────────────────────────
  const handleConfirmAction = async () => {
    const { action, user } = confirmModal;
    setActionLoading(true);
    try {
      if (action === "deactivate") {
        await opsDeactivateUser(user.id);
        showToast(`${user.email} has been deactivated.`);
      } else if (action === "reactivate") {
        await opsReactivateUser(user.id);
        showToast(`${user.email} has been reactivated.`);
      }
      setConfirmModal({ open: false, action: null, user: null, label: "", body: "", danger: false });
      load();
    } catch (e) {
      showToast(e?.response?.data?.detail ?? "Action failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <PageHeader title="User Management" description="View, promote, demote, and manage all platform users." />

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
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
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="flex-1 min-w-[200px] text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
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
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {/* Error */}
        {error && <Alert severity="error">{error}</Alert>}

        {/* Table */}
        <TableCard
          columns={["Name", "Email", "Role", "Status", "Joined", "Actions"]}
          gridColsClassName="grid-cols-[1fr_1.5fr_1fr_0.7fr_1fr_auto]"
          loading={loading}
          isEmpty={users.length === 0}
          emptyState={
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-slate-700">No users found</p>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search or filters.</p>
            </div>
          }
        >
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-[1fr_1.5fr_1fr_0.7fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {u.full_name || "—"}
                    {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">(you)</span>}
                  </p>
                </div>
                <p className="text-sm text-slate-500 truncate">{u.email}</p>
                <Badge domain="role" label={u.role} />
                <Badge domain="active" label={u.is_active ? "active" : "inactive"} />
                <p className="text-xs text-slate-500">{fmtDate(u.date_joined)}</p>

                {/* Action buttons — Super Admin only */}
                <div className="flex items-center gap-2 justify-end shrink-0">
                  {isSuperAdmin && !isSelf && (
                    <>
                      <button
                        onClick={() => setRoleModal({ open: true, user: u })}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Change Role
                      </button>
                      {u.is_active ? (
                        <button
                          onClick={() => setConfirmModal({
                            open: true, action: "deactivate", user: u, danger: true,
                            label: "Deactivate",
                            body: `Deactivate ${u.email}? They will not be able to log in.`,
                          })}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmModal({
                            open: true, action: "reactivate", user: u, danger: false,
                            label: "Reactivate",
                            body: `Reactivate ${u.email}? They will be able to log in again.`,
                          })}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Reactivate
                        </button>
                      )}
                    </>
                  )}
                  {(!isSuperAdmin || isSelf) && (
                    <span className="text-xs text-slate-500 italic">View only</span>
                  )}
                </div>
              </motion.div>
            );
          })}
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
          itemLabel="user"
        />

      </div>

      {/* Modals */}
      <RoleChangeModal
        open={roleModal.open}
        user={roleModal.user}
        onClose={() => setRoleModal({ open: false, user: null })}
        onConfirm={handleRoleChange}
        loading={actionLoading}
      />

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.label}
        body={confirmModal.body}
        confirmLabel={confirmModal.label}
        danger={confirmModal.danger}
        loading={actionLoading}
        onClose={() => setConfirmModal({ open: false, action: null, user: null, label: "", body: "", danger: false })}
        onConfirm={handleConfirmAction}
      />

    </AppShell>
  );
}
