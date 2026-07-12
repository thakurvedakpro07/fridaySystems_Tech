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
 * open a confirmation dialog. Mark Resolved does, but as of Phase 4.5 it's
 * not this component's own dialog — it hands off to ResolutionPanel's
 * capture form (via onRequestResolve), which requires a structured
 * resolution summary and only transitions the status once that's saved.
 *
 * Props:
 *   ticket          — the full ticket object
 *   onUpdate        — callback fired after a successful update so parent can refetch the ticket
 *   draftMessage    — current text in the conversation composer (lifted to TicketDetail)
 *   onDraftChange   — setter for draftMessage
 *   onFeedRefresh   — refetches the conversation feed (after an upload / remote session)
 *   composerId      — id of the conversation composer textarea, for focusing
 *
 * Mark Resolved doesn't resolve the ticket itself here — it navigates to the
 * dedicated Resolution Workspace page (/tickets/:id/resolve), which captures
 * the structured resolution summary first and only then transitions status.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { freelancerStartRemoteSession, freelancerUpdateStatus } from "../../api/tickets";
import { uploadAttachment } from "../../api/attachments";
import { useToast } from "../../context/ToastContext";
import Button from "../ui/Button";
import Popover from "../ui/Popover";
import { PlayCircleIcon, CheckCircleIcon, ChatBubbleIcon, UploadIcon, ComputerDesktopIcon } from "./ActionIcons";

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
  if (targetStatus === "resolved") return "Resolve Ticket";
  return targetStatus.replaceAll("_", " ");
}

function iconFor(targetStatus) {
  if (targetStatus === "resolved") return <CheckCircleIcon />;
  return <PlayCircleIcon />;
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
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-2">
      {nextStatuses.map((targetStatus) => (
        <Button
          key={targetStatus}
          className={`w-full ${targetStatus === "resolved" ? "mb-1" : ""}`}
          size={targetStatus === "resolved" ? "lg" : "md"}
          variant={targetStatus === "resolved" ? "primary" : "secondary"}
          disabled={saving}
          onClick={() => (
            INSTANT_STATUSES.has(targetStatus)
              ? handleInstantClick(targetStatus)
              : navigate(`/tickets/${ticket.id}/resolve`)
          )}
        >
          {iconFor(targetStatus)}
          {labelFor(targetStatus)}
        </Button>
      ))}

      {canMessage && (
        <>
          <div className="relative w-full">
            <Button className="w-full" variant="secondary" onClick={() => setShowRequestPopover((v) => !v)}>
              <ChatBubbleIcon />
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

          <Button className="w-full" variant="secondary" disabled={uploading} onClick={handleFileButtonClick}>
            <UploadIcon />
            {uploading ? "Uploading…" : "Upload File"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

          <div className="relative w-full">
            <Button className="w-full" variant="secondary" onClick={() => setShowRemotePopover((v) => !v)}>
              <ComputerDesktopIcon />
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
  );
}
