/**
 * FreelancerTicketActions — status update buttons for freelancers.
 *
 * Freelancers can only advance the ticket through their allowed transitions:
 *   assigned        → in_progress
 *   in_progress     → waiting_customer | resolved
 *   waiting_customer → in_progress | resolved
 *
 * Props:
 *   ticket   — the full ticket object
 *   onUpdate — callback fired after a successful update so parent can refetch
 */
import { useState } from "react";
import { freelancerUpdateStatus } from "../../api/tickets";
import { useToast } from "../../context/ToastContext";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

const FREELANCER_TRANSITIONS = {
  assigned:         ["in_progress"],
  in_progress:      ["waiting_customer", "resolved"],
  waiting_customer: ["in_progress", "resolved"],
};

const STATUS_LABELS = {
  in_progress:      "Mark In Progress",
  waiting_customer: "Waiting for Customer",
  resolved:         "Mark Resolved",
};

export default function FreelancerTicketActions({ ticket, onUpdate }) {
  const toast = useToast();
  const [showModal, setShowModal]     = useState(false);
  const [targetStatus, setTargetStatus] = useState(null);
  const [note, setNote]               = useState("");
  const [saving, setSaving]           = useState(false);

  const nextStatuses = FREELANCER_TRANSITIONS[ticket.status] ?? [];

  if (nextStatuses.length === 0) return null;

  const openModal = (status) => {
    setTargetStatus(status);
    setNote("");
    setShowModal(true);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await freelancerUpdateStatus(ticket.id, targetStatus, note);
      toast(`Status updated to ${targetStatus.replaceAll("_", " ")}.`, "success");
      setShowModal(false);
      onUpdate();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Failed to update status.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">Update Status</p>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <Button
              key={status}
              variant={status === "resolved" ? "primary" : "secondary"}
              onClick={() => openModal(status)}
            >
              {STATUS_LABELS[status] ?? status.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Move to: ${targetStatus?.replaceAll("_", " ")}`}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="freelancer-note" className="block text-sm font-medium text-slate-700 mb-1.5">Note (optional)</label>
            <textarea
              id="freelancer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note for the customer or admin…"
              className="input-base resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button disabled={saving} onClick={handleUpdate}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
