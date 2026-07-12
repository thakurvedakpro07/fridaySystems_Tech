/**
 * AdminTicketActions — action panel shown to admins on the ticket detail page.
 * Allows: assign a freelancer, change ticket status, unassign freelancer.
 *
 * Props:
 *   ticket   — the full ticket object (needs ticket.id, ticket.status, ticket.assigned_to)
 *   onUpdate — callback fired after a successful action so the parent can refetch
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { opsAssignTicket, opsStatusUpdate, opsUnassignTicket, getOpsFreelancers } from "../../api/ops";
import { useToast } from "../../context/ToastContext";
import { useRoles } from "../../hooks/useRoles";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { CheckCircleIcon, UserPlusIcon, UserMinusIcon, ArrowsPathIcon } from "./ActionIcons";

const STATUS_TRANSITIONS = {
  open:            ["assigned", "closed"],
  assigned:        ["in_progress", "open"],
  in_progress:     ["resolved"],
  resolved:        ["closed", "in_progress"],
  closed:          [],
  pending_payment: ["open"],
};

// Same wording customers see everywhere else (Badge, timeline, queues) — "assigned"
// means the engineer hasn't started yet, so it reads "Ready to Start" here too.
const STATUS_LABEL = {
  assigned:    "Ready to Start",
  in_progress: "Work Started",
};
const statusLabel = (s) => STATUS_LABEL[s] ?? s.replaceAll("_", " ");

export default function AdminTicketActions({ ticket, onUpdate }) {
  const toast = useToast();
  const navigate = useNavigate();
  // Rendered for both the true Super Admin ("admin") role and the collapsed
  // "support_agent" role string (which TicketDetailPage.jsx's role fetcher
  // also assigns to Ops Manager AND Finance Manager) — this is the one place
  // that actually distinguishes them, mirroring IsTicketManagementStaff on
  // the backend (ops manager OR support agent OR super admin, excluding
  // finance manager), same as OpsTicketQueue.jsx's bulk-toolbar gating.
  const { isTicketManagementStaff } = useRoles();
  const [freelancers, setFreelancers]         = useState([]);
  const [showAssign, setShowAssign]           = useState(false);
  const [showStatus, setShowStatus]           = useState(false);
  const [showUnassign, setShowUnassign]       = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState("");
  const [selectedStatus, setSelectedStatus]   = useState("");
  const [note, setNote]                       = useState("");
  const [saving, setSaving]                   = useState(false);

  // Load freelancer list when assign modal opens
  useEffect(() => {
    if (!showAssign) return;
    getOpsFreelancers()
      .then(({ data }) => setFreelancers(data.results ?? data))
      .catch(() => toast("Could not load freelancers.", "error"));
  }, [showAssign]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isTicketManagementStaff) return null;

  const nextStatuses = STATUS_TRANSITIONS[ticket.status] ?? [];
  // "resolved" is surfaced as its own dedicated primary button below
  // (canResolve), so it's excluded from the generic Change Status dropdown
  // to avoid two different controls reaching the same destination.
  const dropdownStatuses = nextStatuses.filter((s) => s !== "resolved");
  const canResolve = ticket.status === "in_progress";
  const canAssign = !ticket.assigned_to && ticket.status !== "closed";

  const handleResolveClick = () => navigate(`/tickets/${ticket.id}/resolve`);

  const handleAssign = async () => {
    if (!selectedFreelancer) return;
    setSaving(true);
    try {
      await opsAssignTicket(ticket.id, selectedFreelancer);
      toast("Freelancer assigned.", "success");
      setShowAssign(false);
      setSelectedFreelancer("");
      onUpdate();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Failed to assign.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) return;

    // Marking resolved is a dedicated workflow, not a plain status change —
    // hand off to the Resolution Workspace page instead of updating status
    // immediately. That page captures the resolution summary first and only
    // then transitions the status.
    if (selectedStatus === "resolved") {
      setShowStatus(false);
      setSelectedStatus("");
      setNote("");
      navigate(`/tickets/${ticket.id}/resolve`);
      return;
    }

    setSaving(true);
    try {
      await opsStatusUpdate(ticket.id, selectedStatus, note);
      toast(`Status changed to ${statusLabel(selectedStatus)}.`, "success");
      setShowStatus(false);
      setSelectedStatus("");
      setNote("");
      onUpdate();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Failed to update status.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      await opsUnassignTicket(ticket.id, note);
      toast("Freelancer unassigned.", "success");
      setShowUnassign(false);
      setNote("");
      onUpdate();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Failed to unassign.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Resolve Ticket — the primary command action, promoted out of the
            Change Status dropdown so it's a first-class, one-click control. */}
        {canResolve && (
          <Button className="w-full mb-1" size="lg" variant="primary" onClick={handleResolveClick}>
            <CheckCircleIcon />
            Resolve Ticket
          </Button>
        )}

        {/* Assign Freelancer — primary when it's the next actionable step
            and Resolve isn't applicable yet (mutually exclusive with
            canResolve: an in-progress ticket is always already assigned). */}
        {canAssign && (
          <Button className="w-full mb-1" size="lg" onClick={() => setShowAssign(true)} variant="primary">
            <UserPlusIcon />
            Assign Freelancer
          </Button>
        )}

        {dropdownStatuses.length > 0 && (
          <Button className="w-full" onClick={() => setShowStatus(true)} variant="secondary">
            <ArrowsPathIcon />
            Change Status
          </Button>
        )}

        {ticket.assigned_to && (
          <Button className="w-full" onClick={() => setShowUnassign(true)} variant="danger">
            <UserMinusIcon />
            Unassign
          </Button>
        )}

        {dropdownStatuses.length === 0 && ticket.status === "closed" && (
          <p className="text-sm text-slate-500 italic">This ticket is closed.</p>
        )}
      </div>

      {/* ── Assign modal ──────────────────────────────────────── */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Freelancer">
        <div className="space-y-4">
          <div>
            <label htmlFor="assign-freelancer" className="block text-sm font-medium text-slate-700 mb-1.5">Select Freelancer</label>
            <select
              id="assign-freelancer"
              value={selectedFreelancer}
              onChange={(e) => setSelectedFreelancer(e.target.value)}
              className="input-base"
            >
              <option value="">— choose a freelancer —</option>
              {freelancers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name ?? f.user?.email} — {f.skills_display ?? f.skills ?? ""}
                  {f.active_ticket_count != null ? ` (${f.active_ticket_count} active)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button disabled={!selectedFreelancer || saving} onClick={handleAssign}>
              {saving ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Status change modal ───────────────────────────────── */}
      <Modal isOpen={showStatus} onClose={() => setShowStatus(false)} title="Change Status">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-status" className="block text-sm font-medium text-slate-700 mb-1.5">New Status</label>
            <select
              id="new-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-base"
            >
              <option value="">— choose a status —</option>
              {dropdownStatuses.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status-note" className="block text-sm font-medium text-slate-700 mb-1.5">Note (optional)</label>
            <textarea
              id="status-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for status change…"
              className="input-base resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowStatus(false)}>Cancel</Button>
            <Button disabled={!selectedStatus || saving} onClick={handleStatusChange}>
              {saving ? "Saving…" : "Update Status"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Unassign modal ────────────────────────────────────── */}
      <Modal isOpen={showUnassign} onClose={() => setShowUnassign(false)} title="Unassign Freelancer">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will remove <strong>{ticket.assigned_to?.email}</strong> from the ticket and move it back to <em>open</em>.
          </p>
          <div>
            <label htmlFor="unassign-note" className="block text-sm font-medium text-slate-700 mb-1.5">Note (optional)</label>
            <textarea
              id="unassign-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for unassigning…"
              className="input-base resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowUnassign(false)}>Cancel</Button>
            <Button variant="danger" disabled={saving} onClick={handleUnassign}>
              {saving ? "Removing…" : "Unassign"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
