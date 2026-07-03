/**
 * FreelancerTicketActions — action bar for the engineer working a ticket.
 *
 * Freelancers can only advance the ticket through their allowed transitions:
 *   assigned ("Ready to Start") → in_progress ("Work Started")
 *   in_progress                → resolved
 *
 * There is no "waiting for customer" status — the ticket stays "in_progress"
 * for the entire time the engineer and customer communicate. Requesting
 * information, uploading a file, and starting a remote session are all
 * messages/actions in the conversation, not status changes, so none of them
 * open a confirmation dialog. Only Mark Resolved does, since it's the one
 * action that requires the engineer to record what was actually done.
 *
 * Props:
 *   ticket         — the full ticket object
 *   onUpdate       — callback fired after a successful update so parent can refetch the ticket
 *   draftMessage   — current text in the conversation composer (lifted to TicketDetail)
 *   onDraftChange  — setter for draftMessage
 *   onFeedRefresh  — refetches the conversation feed (after an upload / remote session)
 *   composerId     — id of the conversation composer textarea, for focusing
 */
import { useRef, useState } from "react";
import { freelancerStartRemoteSession, freelancerUpdateStatus, addComment } from "../../api/tickets";
import { uploadAttachment } from "../../api/attachments";
import { useToast } from "../../context/ToastContext";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Popover from "../ui/Popover";

const FREELANCER_TRANSITIONS = {
  assigned:    ["in_progress"],
  in_progress: ["resolved"],
};

// Transitions to these statuses apply instantly — no modal.
const INSTANT_STATUSES = new Set(["in_progress"]);

// Same wording customers and admins see for these statuses (Badge, timeline, queues) —
// keeps "Ready to Start" / "Work Started" consistent everywhere in the product.
const STATUS_LABEL = {
  in_progress: "Work Started",
  resolved:    "Resolved",
};

function labelFor(targetStatus) {
  if (targetStatus === "in_progress") return "Start Working";
  if (targetStatus === "resolved") return "Mark Resolved";
  return targetStatus.replaceAll("_", " ");
}

const REQUEST_TEMPLATES = [
  { label: "Request screenshot", template: "Could you share a screenshot showing the issue? That'll help me see exactly what you're seeing." },
  { label: "Request log files", template: "Could you send over the relevant log files? That'll help narrow down what's happening." },
  { label: "Request remote session", template: "Would it be possible to start a remote session (e.g. AnyDesk) so I can take a closer look?" },
  { label: "Ask a question", template: "" },
  { label: "Request credentials", template: "Could you share the credentials needed to access this? I'll keep them strictly to resolving this ticket." },
  { label: "Custom", template: "" },
];

function focusComposer(composerId) {
  requestAnimationFrame(() => {
    document.getElementById(composerId)?.focus();
  });
}

export default function FreelancerTicketActions({
  ticket, onUpdate, draftMessage, onDraftChange, onFeedRefresh, composerId,
}) {
  const toast = useToast();
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [showRequestPopover, setShowRequestPopover] = useState(false);
  const [showRemotePopover, setShowRemotePopover] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [sharingRemote, setSharingRemote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  if (ticket.status === "closed") return null;

  const nextStatuses = FREELANCER_TRANSITIONS[ticket.status] ?? [];
  const canMessage = ticket.status === "in_progress" || ticket.status === "resolved";

  const applyStatus = async (targetStatus, note) => {
    const { data: updatedTicket } = await freelancerUpdateStatus(ticket.id, targetStatus, note);
    onUpdate(updatedTicket);
    return updatedTicket;
  };

  const handleInstantClick = async (targetStatus) => {
    setSaving(true);
    try {
      await applyStatus(targetStatus, "");
      toast(`${STATUS_LABEL[targetStatus] ?? targetStatus}.`, "success");
    } catch (err) {
      toast(err.response?.data?.detail ?? "Failed to update status.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleResolveConfirm = async () => {
    if (!resolutionSummary.trim()) return;
    setSaving(true);
    try {
      await applyStatus("resolved", resolutionSummary.trim());
      if (internalNote.trim() !== "") {
        await addComment(ticket.id, internalNote.trim(), true);
      }
      toast("Ticket marked resolved.", "success");
      setShowResolveModal(false);
      onFeedRefresh?.();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Failed to update status.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePickTemplate = (template) => {
    onDraftChange(template);
    setShowRequestPopover(false);
    focusComposer(composerId);
  };

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadAttachment(ticket.id, file);
      toast("File uploaded.", "success");
      onFeedRefresh?.();
    } catch (err) {
      toast(err.response?.data?.detail || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleShareRemoteSession = async () => {
    if (!remoteUrl.trim()) return;
    setSharingRemote(true);
    try {
      const { data: updatedTicket } = await freelancerStartRemoteSession(ticket.id, remoteUrl.trim());
      onUpdate(updatedTicket);
      onFeedRefresh?.();
      toast("Remote session shared.", "success");
      setShowRemotePopover(false);
      setRemoteUrl("");
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not share the remote session link.", "error");
    } finally {
      setSharingRemote(false);
    }
  };

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">Engineer Actions</p>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((targetStatus) => (
          <Button
            key={targetStatus}
            variant={targetStatus === "resolved" ? "primary" : "secondary"}
            disabled={saving}
            onClick={() => (
              INSTANT_STATUSES.has(targetStatus)
                ? handleInstantClick(targetStatus)
                : setShowResolveModal(true)
            )}
          >
            {labelFor(targetStatus)}
          </Button>
        ))}

        {canMessage && (
          <>
            <div className="relative">
              <Button variant="secondary" onClick={() => setShowRequestPopover((v) => !v)}>
                Request Information
              </Button>
              <Popover isOpen={showRequestPopover} onClose={() => setShowRequestPopover(false)}
                       anchorClassName="left-0 w-64 p-1.5">
                {REQUEST_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => handlePickTemplate(t.template)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700
                               hover:bg-slate-50 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </Popover>
            </div>

            <Button variant="secondary" disabled={uploading} onClick={handleFileButtonClick}>
              {uploading ? "Uploading…" : "Upload File"}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

            <div className="relative">
              <Button variant="secondary" onClick={() => setShowRemotePopover((v) => !v)}>
                Start Remote Session
              </Button>
              <Popover isOpen={showRemotePopover} onClose={() => setShowRemotePopover(false)}
                       anchorClassName="left-0 w-80 p-3">
                <label htmlFor="remote-session-url" className="block text-xs font-medium text-slate-700 mb-1.5">
                  AnyDesk / remote session link
                </label>
                <div className="flex gap-2">
                  <input
                    id="remote-session-url"
                    type="url"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="https://anydesk.com/…"
                    className="input-base flex-1 text-sm"
                  />
                  <Button size="sm" disabled={sharingRemote || !remoteUrl.trim()} onClick={handleShareRemoteSession}>
                    {sharingRemote ? "Sharing…" : "Share"}
                  </Button>
                </div>
              </Popover>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title="Mark Resolved"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="freelancer-resolution" className="block text-sm font-medium text-slate-700 mb-1.5">
              Resolution summary
            </label>
            <textarea
              id="freelancer-resolution"
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              rows={3}
              placeholder="Summarize how the issue was resolved for the customer…"
              className="input-base resize-none"
            />
          </div>
          <div>
            <label htmlFor="freelancer-internal-note" className="block text-sm font-medium text-slate-700 mb-1.5">
              Internal note (optional)
            </label>
            <textarea
              id="freelancer-internal-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
              placeholder="Add a note for admins — not visible to the customer…"
              className="input-base resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowResolveModal(false)}>Cancel</Button>
            <Button disabled={saving || !resolutionSummary.trim()} onClick={handleResolveConfirm}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
