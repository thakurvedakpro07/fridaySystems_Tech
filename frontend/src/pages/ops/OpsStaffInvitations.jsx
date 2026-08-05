import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/ToastContext";
import {
  listStaffInvitations,
  createStaffInvitation,
  revokeStaffInvitation,
  resendStaffInvitation,
} from "../../api/staffInvitations";
import { extractErrorMessage } from "../../utils/apiError";
import PageHeader from "../../components/ui/PageHeader";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import TableCard from "../../components/table/TableCard";
import Pagination from "../../components/table/Pagination";
import SelectFilter from "../../components/filters/SelectFilter";
import EmptyState from "../../components/ui/EmptyState";

const ROLE_OPTIONS = [
  { value: "freelancer", label: "Engineer" },
  { value: "admin", label: "Super Admin" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
];

const ROLE_FILTER_OPTIONS = [{ value: "", label: "All Roles" }, ...ROLE_OPTIONS];

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

// ── Send Invitation Modal ──────────────────────────────────────────
function InviteModal({ open, onClose, onSave, loading, error }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("freelancer");

  useEffect(() => {
    if (open) { setEmail(""); setRole("freelancer"); }
  }, [open]);

  if (!open) return null;

  const canSave = email.trim().length > 0;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Send Staff Invitation"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <Button onClick={() => onSave({ email: email.trim(), role })} disabled={loading || !canSave} loading={loading}>
            Send Invitation
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert severity="error">{error}</Alert>}

        <div>
          <label htmlFor="staff-invite-email" className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
          <Input
            id="staff-invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="staff-invite-role" className="block text-xs font-semibold text-slate-500 mb-1.5">Role</label>
          <Select id="staff-invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <p className="text-xs text-slate-500 italic">
          Accepting the emailed link grants this role immediately — Engineer fast-tracks
          someone into the freelancer marketplace role, Super Admin grants full platform access.
        </p>
      </div>
    </Modal>
  );
}

// ── Revoke confirm ─────────────────────────────────────────────────
function RevokeConfirmModal({ open, onClose, onConfirm, invitation, loading }) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Revoke Invitation"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <Button variant="danger" onClick={onConfirm} disabled={loading} loading={loading}>
            Revoke
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 leading-relaxed">
        Revoke the invitation for <span className="font-semibold text-slate-800">{invitation?.email}</span>?
        The invite link will stop working immediately. To invite them again later, you'll need to send a new invitation.
      </p>
    </Modal>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function OpsStaffInvitations() {
  usePageTitle("Staff Invitations — ResolveHQ");
  const showToast = useToast();

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);

  const [inviteModal, setInviteModal] = useState(false);
  const [revokeModal, setRevokeModal] = useState({ open: false, invitation: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const res = await listStaffInvitations(params);
      const data = res.data ?? {};
      const results = data.results ?? (Array.isArray(data) ? data : []);
      setInvitations(results);
      setCount(data.count ?? results.length);
      setNext(data.next ?? null);
      setPrevious(data.previous ?? null);
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to load staff invitations."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async ({ email, role }) => {
    setActionLoading(true);
    setFormError(null);
    try {
      await createStaffInvitation(email, role);
      showToast(`Invitation sent to ${email}.`, "success");
      setInviteModal(false);
      setPage(1);
      load();
    } catch (e) {
      setFormError(extractErrorMessage(e, "Failed to send invitation."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    setActionLoading(true);
    try {
      await revokeStaffInvitation(revokeModal.invitation.id);
      showToast("Invitation revoked.", "success");
      setRevokeModal({ open: false, invitation: null });
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, "Failed to revoke invitation."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResend = async (invitation) => {
    setResendingId(invitation.id);
    try {
      await resendStaffInvitation(invitation.id);
      showToast(`Invitation resent to ${invitation.email}.`, "success");
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, "Failed to resend invitation."), "error");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between gap-4">
          <PageHeader
            title="Staff Invitations"
            description="Invite a known person directly into the Engineer or Super Admin role by email."
          />
          <Button onClick={() => { setFormError(null); setInviteModal(true); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Send Invitation
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_FILTER_OPTIONS} ariaLabel="Status" />
          <SelectFilter value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }} options={ROLE_FILTER_OPTIONS} ariaLabel="Role" />
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <TableCard
          columns={["Email", "Role", "Status", "Invited By", "Sent", "Expires", "Actions"]}
          gridColsClassName="grid-cols-[1.4fr_0.9fr_0.8fr_1.2fr_1fr_1fr_auto]"
          loading={loading}
          isEmpty={invitations.length === 0}
          emptyState={
            <EmptyState
              size="compact"
              icon={
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM3.75 20.25a8.25 8.25 0 0116.5 0" />
                </svg>
              }
              title="No staff invitations yet"
              description="Send an invitation to bring a known Engineer or Admin onto the platform directly."
            />
          }
        >
          {invitations.map((inv, idx) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.02 }}
              className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1.2fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-900 truncate">{inv.email}</p>
              <p className="text-sm text-slate-600">{inv.role_display}</p>
              <Badge domain="invitationStatus" label={inv.status} />
              <p className="text-sm text-slate-600 truncate">{inv.invited_by_email ?? "—"}</p>
              <p className="text-xs text-slate-500">{fmtDateTime(inv.created_at)}</p>
              <p className="text-xs text-slate-500">{fmtDateTime(inv.expires_at)}</p>
              <div className="flex items-center gap-2 justify-end shrink-0">
                {(inv.status === "pending" || inv.status === "expired") && (
                  <button
                    onClick={() => handleResend(inv)}
                    disabled={resendingId === inv.id}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {resendingId === inv.id ? "Resending…" : "Resend"}
                  </button>
                )}
                {inv.status === "pending" && (
                  <button
                    onClick={() => setRevokeModal({ open: true, invitation: inv })}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
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
          itemLabel="invitation"
        />

      </div>

      <InviteModal
        open={inviteModal}
        onClose={() => setInviteModal(false)}
        onSave={handleInvite}
        loading={actionLoading}
        error={formError}
      />

      <RevokeConfirmModal
        open={revokeModal.open}
        onClose={() => setRevokeModal({ open: false, invitation: null })}
        onConfirm={handleRevoke}
        invitation={revokeModal.invitation}
        loading={actionLoading}
      />
    </AppShell>
  );
}
