import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import FormSection from "../components/ui/FormSection";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import TableCard from "../components/table/TableCard";
import Pagination from "../components/table/Pagination";
import { useToast } from "../context/ToastContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuthStore } from "../store/authStore";
import {
  listMyOrganizations, getOrganization, updateOrganization,
  listOrganizationMembers, updateMemberRole, removeMember,
  listInvitations, createInvitation, revokeInvitation,
  listOrganizationAuditLog,
} from "../api/organizations";
import {
  BuildingOfficeIcon, UserCircleIcon, ClockIcon, EnvelopeIcon,
} from "../components/tickets/ActionIcons";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function FieldRow({ label, htmlFor, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-start py-3
                    border-b border-slate-100 last:border-0">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-600 sm:pt-2">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function initialsOf(member) {
  const first = (member.user.first_name ?? "").trim();
  const last = (member.user.last_name ?? "").trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return (member.user.email ?? "??").slice(0, 2).toUpperCase();
}

function displayNameOf(member) {
  const first = (member.user.first_name ?? "").trim();
  const last = (member.user.last_name ?? "").trim();
  return first ? `${first}${last ? " " + last : ""}` : member.user.email;
}

// ── Generic confirm dialog for destructive member/invitation actions ──
function ConfirmActionModal({ open, title, body, confirmLabel, loading, onCancel, onConfirm }) {
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </Modal>
  );
}

// ── Profile tab ─────────────────────────────────────────────────
function ProfileTab({ organization, isAdmin, onUpdated }) {
  const toast = useToast();
  const [name, setName] = useState(organization.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(organization.name); }, [organization.name]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await updateOrganization(organization.id, { name: name.trim() });
      onUpdated(data);
      toast("Organization updated successfully", "success");
    } catch {
      toast("Could not save changes. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <FormSection title="Organization Details" description="Shared across every member of your organization.">
        <FieldRow label="Organization name" htmlFor="org-name">
          {isAdmin ? (
            <Input id="org-name" className="w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          ) : (
            <p className="text-sm text-slate-700 pt-2">{organization.name}</p>
          )}
        </FieldRow>
        <FieldRow label="Organization ID">
          <p className="text-sm text-slate-500 font-mono pt-2">{organization.slug}</p>
        </FieldRow>
        <FieldRow label="Members">
          <p className="text-sm text-slate-700 pt-2">{organization.member_count}</p>
        </FieldRow>
        <FieldRow label="Created">
          <p className="text-sm text-slate-700 pt-2">{fmtDate(organization.created_at)}</p>
        </FieldRow>
        <FieldRow label="Your role">
          <div className="pt-1"><Badge domain="orgRole" label={organization.my_role} /></div>
        </FieldRow>
      </FormSection>

      {isAdmin && (
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      )}
    </form>
  );
}

// ── Invite member modal ───────────────────────────────────────────
function InviteModal({ open, orgId, onClose, onInvited }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org_member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setEmail(""); setRole("org_member"); setError(""); }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createInvitation(orgId, email.trim().toLowerCase(), role);
      toast(`Invitation sent to ${email.trim()}`, "success");
      onInvited();
      onClose();
    } catch (err) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.detail || "Could not send invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Invite Member"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Send Invitation</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <Input
            id="invite-email" type="email" className="w-full" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required autoFocus
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
          <Select id="invite-role" className="w-full" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="org_member">Member</option>
            <option value="org_admin">Organization Admin</option>
          </Select>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
    </Modal>
  );
}

// ── Members tab ────────────────────────────────────────────────
function MembersTab({ orgId, isAdmin, currentUserId }) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(null); // membership id currently saving
  const [removeConfirm, setRemoveConfirm] = useState({ open: false, member: null });
  const [revokeConfirm, setRevokeConfirm] = useState({ open: false, invitation: null });
  const [actionLoading, setActionLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const { data } = await listOrganizationMembers(orgId, { page_size: 100 });
      setMembers(data.results ?? []);
    } catch {
      toast("Could not load members.", "error");
    } finally {
      setLoadingMembers(false);
    }
  }, [orgId, toast]);

  const loadInvitations = useCallback(async () => {
    if (!isAdmin) { setLoadingInvitations(false); return; }
    setLoadingInvitations(true);
    try {
      const { data } = await listInvitations(orgId, { page_size: 100 });
      setInvitations(data.results ?? []);
    } catch {
      toast("Could not load invitations.", "error");
    } finally {
      setLoadingInvitations(false);
    }
  }, [orgId, isAdmin, toast]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { loadInvitations(); }, [loadInvitations]);

  const handleRoleChange = async (member, newRole) => {
    setRoleUpdating(member.id);
    try {
      await updateMemberRole(orgId, member.user.id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
      toast(`${displayNameOf(member)}'s role updated.`, "success");
    } catch (err) {
      toast(err.response?.data?.detail || "Could not change role.", "error");
    } finally {
      setRoleUpdating(null);
    }
  };

  const handleRemoveConfirm = async () => {
    const member = removeConfirm.member;
    setActionLoading(true);
    try {
      await removeMember(orgId, member.user.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast(`${displayNameOf(member)} removed from the organization.`, "success");
      setRemoveConfirm({ open: false, member: null });
    } catch (err) {
      toast(err.response?.data?.detail || "Could not remove member.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeConfirm = async () => {
    const invitation = revokeConfirm.invitation;
    setActionLoading(true);
    try {
      await revokeInvitation(orgId, invitation.id);
      setInvitations((prev) => prev.map((i) => (i.id === invitation.id ? { ...i, status: "revoked" } : i)));
      toast(`Invitation to ${invitation.email} revoked.`, "success");
      setRevokeConfirm({ open: false, invitation: null });
    } catch (err) {
      toast(err.response?.data?.detail || "Could not revoke invitation.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length} member{members.length === 1 ? "" : "s"}</p>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>Invite Member</Button>
        )}
      </div>

      <TableCard
        columns={["Member", "Role", "Joined", "Actions"]}
        gridColsClassName="grid-cols-[1.5fr_1fr_1fr_auto]"
        loading={loadingMembers}
        isEmpty={members.length === 0}
        emptyState={<EmptyState size="compact" title="No members yet" description="Invite teammates to join your organization." />}
      >
        {members.map((m) => {
          const isSelf = m.user.id === currentUserId;
          return (
            <div key={m.id} className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                  {initialsOf(m)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {displayNameOf(m)}
                    {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{m.user.email}</p>
                </div>
              </div>
              {isAdmin && !isSelf ? (
                <Select
                  value={m.role}
                  disabled={roleUpdating === m.id}
                  onChange={(e) => handleRoleChange(m, e.target.value)}
                  className="w-auto text-xs"
                >
                  <option value="org_member">Member</option>
                  <option value="org_admin">Organization Admin</option>
                </Select>
              ) : (
                <Badge domain="orgRole" label={m.role} />
              )}
              <p className="text-xs text-slate-500">{fmtDate(m.joined_at)}</p>
              <div className="flex justify-end">
                {isAdmin && !isSelf && (
                  <button
                    onClick={() => setRemoveConfirm({ open: true, member: m })}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </TableCard>

      {isAdmin && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Pending Invitations</h3>
          <TableCard
            columns={["Email", "Role", "Invited By", "Expires", "Actions"]}
            gridColsClassName="grid-cols-[1.5fr_1fr_1.2fr_1fr_auto]"
            loading={loadingInvitations}
            isEmpty={pendingInvitations.length === 0}
            emptyState={
              <EmptyState
                size="compact"
                icon={<EnvelopeIcon className="w-6 h-6 text-slate-500" />}
                title="No pending invitations"
                description="Invited teammates will appear here until they accept."
              />
            }
          >
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[1.5fr_1fr_1.2fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                <p className="text-sm text-slate-700 truncate">{inv.email}</p>
                <Badge domain="orgRole" label={inv.role} />
                <p className="text-xs text-slate-500 truncate">{inv.invited_by_email ?? "—"}</p>
                <p className="text-xs text-slate-500">{fmtDate(inv.expires_at)}</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setRevokeConfirm({ open: true, invitation: inv })}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </TableCard>
        </div>
      )}

      <InviteModal open={inviteOpen} orgId={orgId} onClose={() => setInviteOpen(false)} onInvited={() => { loadMembers(); loadInvitations(); }} />

      <ConfirmActionModal
        open={removeConfirm.open}
        title="Remove Member"
        body={removeConfirm.member ? `Remove ${displayNameOf(removeConfirm.member)} from this organization? They will lose access immediately.` : ""}
        confirmLabel="Remove"
        loading={actionLoading}
        onCancel={() => setRemoveConfirm({ open: false, member: null })}
        onConfirm={handleRemoveConfirm}
      />

      <ConfirmActionModal
        open={revokeConfirm.open}
        title="Revoke Invitation"
        body={revokeConfirm.invitation ? `Revoke the invitation sent to ${revokeConfirm.invitation.email}? This link will stop working.` : ""}
        confirmLabel="Revoke"
        loading={actionLoading}
        onCancel={() => setRevokeConfirm({ open: false, invitation: null })}
        onConfirm={handleRevokeConfirm}
      />
    </div>
  );
}

// ── Audit log tab (org_admin only) ────────────────────────────────
function AuditTab({ orgId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listOrganizationAuditLog(orgId, { page, page_size: pageSize })
      .then(({ data }) => {
        if (cancelled) return;
        setEntries(data.results ?? []);
        setCount(data.count ?? 0);
        setNext(data.next ?? null);
        setPrevious(data.previous ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, page, pageSize]);

  return (
    <div className="space-y-4">
      <TableCard
        columns={["Action", "Actor", "Date"]}
        gridColsClassName="grid-cols-[1.5fr_1.5fr_1fr]"
        loading={loading}
        isEmpty={entries.length === 0}
        emptyState={<EmptyState size="compact" title="No audit entries yet" description="Organization changes will appear here." />}
      >
        {entries.map((entry) => (
          <div key={entry.id} className="grid grid-cols-[1.5fr_1.5fr_1fr] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
            <Badge domain="orgAuditAction" label={entry.action} />
            <p className="text-sm text-slate-700 truncate">{entry.user_email ?? "Unknown"}</p>
            <p className="text-xs text-slate-500">{fmtDateTime(entry.created_at)}</p>
          </div>
        ))}
      </TableCard>

      <Pagination
        page={page} pageSize={pageSize} count={count}
        hasPrevious={Boolean(previous)} hasNext={Boolean(next)} loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(v) => { setPageSize(Number(v)); setPage(1); }}
        itemLabel="entry"
      />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────
export default function OrganizationPage() {
  usePageTitle("Organization");
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  // Every user belongs to exactly one organization today, but membership is
  // already many-to-many (OrganizationMembership), so a user accepting an
  // invitation to a second organization works without a schema change — this
  // switcher is what makes that reachable in the UI ahead of time.
  useEffect(() => {
    let cancelled = false;
    listMyOrganizations()
      .then(({ data }) => {
        if (cancelled) return;
        const orgs = data.results ?? data ?? [];
        setMyOrganizations(orgs);
        if (orgs[0]) setOrgId(orgs[0].id);
        else setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    getOrganization(orgId)
      .then(({ data }) => { if (!cancelled) setOrganization(data); })
      .catch(() => { if (!cancelled) toast("Could not load organization.", "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, toast]);

  const isAdmin = organization?.my_role === "org_admin";

  const TABS = [
    { id: "profile", label: "Profile", Icon: BuildingOfficeIcon },
    { id: "members", label: "Members", Icon: UserCircleIcon },
    ...(isAdmin ? [{ id: "audit", label: "Audit Log", Icon: ClockIcon }] : []),
  ];

  if (loading) {
    return (
      <AppShell maxWidth="max-w-4xl">
        <div className="space-y-4">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-12 rounded-xl" />)}
        </div>
      </AppShell>
    );
  }

  if (!organization) {
    return (
      <AppShell maxWidth="max-w-4xl">
        <EmptyState
          icon={<BuildingOfficeIcon className="w-8 h-8 text-slate-500" />}
          title="No organization found"
          description="You don't currently belong to an organization."
        />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="max-w-4xl">
      <div className="mb-6">
        <PageHeader
          title={organization.name}
          description={`${organization.member_count} member${organization.member_count === 1 ? "" : "s"}`}
          actions={myOrganizations.length > 1 && (
            <Select
              value={orgId}
              onChange={(e) => { setOrgId(e.target.value); setActiveTab("profile"); }}
              className="w-auto"
            >
              {myOrganizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </Select>
          )}
        />
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 text-sm font-medium
                        py-2 px-4 rounded-lg transition-all duration-150
              ${activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <tab.Icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div key={activeTab} className="animate-fade-in">
        {activeTab === "profile" && (
          <ProfileTab organization={organization} isAdmin={isAdmin} onUpdated={setOrganization} />
        )}
        {activeTab === "members" && (
          <MembersTab orgId={organization.id} isAdmin={isAdmin} currentUserId={user?.id} />
        )}
        {activeTab === "audit" && isAdmin && (
          <AuditTab orgId={organization.id} />
        )}
      </div>
    </AppShell>
  );
}
