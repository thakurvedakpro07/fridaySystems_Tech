/**
 * ConversationFeed — the ticket's single conversation surface.
 *
 * One always-visible, chronologically-merged timeline (messages, uploads,
 * lifecycle events) instead of separate Comments / Files / Activity tabs —
 * GitHub Issues / Linear / Intercom style. Customer messages sit on the
 * left, the support side (engineer/admin) on the right with the ResolveHQ
 * accent, and system events are centered, muted dividers.
 */
import { useEffect, useRef, useState } from "react";
import { addComment } from "../../api/tickets";
import { deleteAttachment, uploadAttachment } from "../../api/attachments";
import { useToast } from "../../context/ToastContext";
import { useAuthStore } from "../../store/authStore";
import { formatAbsoluteTime, formatRelativeTime } from "../../utils/time";
import Spinner from "../ui/Spinner";

const MAX_SIZE_MB = 5;
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".csv", ".zip", ".xls", ".xlsx"];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons (hand-rolled, no icon package dependency) ─────────────────────
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const PaperclipIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" /></svg>
);
const SendIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
);
const CodeIcon = (p) => (
  <svg {...iconProps} {...p}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
);
const UploadCloudIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M4 14.9A5 5 0 0 1 6 5.3 6 6 0 0 1 17.7 8H18a4 4 0 0 1 1 7.9" /><path d="M12 12v9" /><path d="m8 17 4-4 4 4" /></svg>
);

const ACTION_META = {
  created:          "🎫",
  status_changed:   "🔄",
  severity_changed: "📊",
  assigned:         "👤",
  reassigned:       "↔️",
  unassigned:       "👤",
  comment_added:    "💬",
  resolved:         "✅",
  closed:           "🔒",
  reopened:         "🔓",
  sla_breached:     "⚠️",
  escalated:        "🚨",
};
const DEFAULT_ICON = "•";

const STATUS_COLOURS = {
  open:            "bg-sky-100 text-sky-700",
  in_progress:     "bg-indigo-100 text-indigo-700",
  resolved:        "bg-emerald-100 text-emerald-700",
  closed:          "bg-slate-100 text-slate-600",
  assigned:        "bg-violet-100 text-violet-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABELS = {
  assigned:    "Ready to Start",
  in_progress: "Work Started",
};
function statusPill(value) {
  if (!value) return null;
  const colour = STATUS_COLOURS[value] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${colour}`}>
      {STATUS_LABELS[value] ?? value.replaceAll("_", " ")}
    </span>
  );
}
function actorLabel(actorEmail, currentUser) {
  if (!actorEmail) return "System";
  if (actorEmail === currentUser?.email) return "You";
  return actorEmail;
}

// ── Role classification — who is the customer, who is "the support side" ──
// Comments/attachments only carry an author email; the ticket already knows
// who the customer is, so anyone else (freelancer or admin) renders as the
// engineer side of the conversation.
function senderRole(email, ticket) {
  if (!email) return "system";
  if (ticket?.customer?.email && email === ticket.customer.email) return "customer";
  return "engineer";
}
function initials(nameOrEmail) {
  if (!nameOrEmail) return "?";
  const base = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = base.replace(/[._-]+/g, " ").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ── Date grouping ("Today" / "Yesterday" / "12 May") ───────────────────
function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function dateKey(d) {
  return startOfDay(d).getTime();
}
function dateLabel(d) {
  const day = startOfDay(d);
  const today = startOfDay(Date.now());
  const diffDays = Math.round((today - day) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return day.toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
    year: day.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function DateDivider({ label }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-500">
        {label}
      </span>
    </div>
  );
}

// ── Message body — renders ```fenced``` segments as code blocks ────────
function MessageBody({ text, isEngineer }) {
  const segments = text.split("```");
  if (segments.length === 1) return <>{text}</>;
  return segments.map((segment, i) =>
    i % 2 === 1 ? (
      <pre
        key={i}
        className={`my-1.5 px-3 py-2 rounded-lg text-[12.5px] font-mono overflow-x-auto whitespace-pre
          ${isEngineer ? "bg-black/25" : "bg-slate-800 text-slate-100"}`}
      >
        <code>{segment.replace(/^[\w-]*\n/, "")}</code>
      </pre>
    ) : (
      segment && <span key={i} className="whitespace-pre-wrap">{segment}</span>
    )
  );
}

function FeedCommentBubble({ comment, ticket, currentUser }) {
  const role = senderRole(comment.author_email, ticket);
  const isEngineer = role === "engineer";
  const name = comment.author_email ?? "Deleted User";
  const label = comment.author_email === currentUser?.email ? "You" : name;
  const timeLabel = formatRelativeTime(comment.created_at);

  return (
    <div className={`flex gap-2.5 ${isEngineer ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0
          ${isEngineer ? "bg-brand-gradient text-white" : "bg-slate-200 text-slate-600"}`}
      >
        {initials(name)}
      </div>
      <div className={`flex flex-col max-w-[75%] min-w-0 ${isEngineer ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-1.5 mb-1 px-0.5">
          <span className="text-xs font-medium text-slate-600">{label}</span>
          {comment.is_internal && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50
                             border border-amber-200 text-[10px] font-semibold text-amber-700">
              Internal
            </span>
          )}
          {comment.is_edited && <span className="text-[11px] text-slate-400 italic">edited</span>}
          <span className="text-[11px] text-slate-400" title={formatAbsoluteTime(comment.created_at)}>
            {timeLabel}
          </span>
        </div>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm
            ${isEngineer ? "bg-brand-gradient text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"}
            ${comment.is_internal ? "ring-1 ring-amber-300/70" : ""}`}
        >
          <MessageBody text={comment.body} isEngineer={isEngineer} />
        </div>
      </div>
    </div>
  );
}

function fileBadge(mime, fileName) {
  const ext = (fileName?.split(".").pop() || "").toUpperCase();
  if (mime?.includes("pdf")) return { label: "PDF", classes: "bg-red-50 text-red-600 ring-red-100" };
  if (mime?.includes("zip")) return { label: "ZIP", classes: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (mime?.includes("sheet") || mime?.includes("excel")) return { label: ext || "XLS", classes: "bg-emerald-50 text-emerald-600 ring-emerald-100" };
  if (mime?.startsWith("text/")) return { label: ext || "TXT", classes: "bg-slate-100 text-slate-600 ring-slate-200" };
  return { label: ext || "FILE", classes: "bg-brand-50 text-brand-600 ring-brand-100" };
}

function AttachmentActions({ attachment, canDelete, deleting, onDelete, light }) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      {attachment.file_url && (
        <a
          href={attachment.file_url} target="_blank" rel="noreferrer"
          className={`text-xs font-medium ${light ? "text-slate-200 hover:text-white" : "text-brand-600 hover:text-brand-700"}`}
        >
          View
        </a>
      )}
      {canDelete && (
        <button
          onClick={onDelete} disabled={deleting}
          className={`text-xs disabled:opacity-50 ${light ? "text-slate-400 hover:text-rose-300" : "text-slate-400 hover:text-rose-600"}`}
        >
          {deleting ? "…" : "Delete"}
        </button>
      )}
    </div>
  );
}

function FeedAttachmentCard({ attachment, ticket, canDelete, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [textPreview, setTextPreview] = useState(null); // null = loading, false = unavailable, string = content

  const role = senderRole(attachment.uploaded_by_email, ticket);
  const isEngineer = role === "engineer";
  const isImage = attachment.mime_type?.startsWith("image/");
  const isTextLike = attachment.mime_type?.startsWith("text/") && !isImage;
  const badge = fileBadge(attachment.mime_type, attachment.file_name);

  useEffect(() => {
    if (!isTextLike || !attachment.file_url) return;
    let cancelled = false;
    fetch(attachment.file_url)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((content) => {
        if (!cancelled) setTextPreview(content.split("\n").slice(0, 8).join("\n"));
      })
      .catch(() => { if (!cancelled) setTextPreview(false); });
    return () => { cancelled = true; };
  }, [isTextLike, attachment.file_url]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return;
    setDeleting(true);
    await onDelete(attachment.id);
    setDeleting(false);
  };

  const meta = (
    <p className="text-[11px] text-slate-400 mt-1">
      {formatBytes(attachment.file_size)}
      {" · "}<span title={formatAbsoluteTime(attachment.uploaded_at)}>{formatRelativeTime(attachment.uploaded_at)}</span>
    </p>
  );

  return (
    <div className={`flex gap-2.5 ${isEngineer ? "flex-row-reverse" : ""}`}>
      <div className="w-7 shrink-0" />
      <div className={`flex flex-col max-w-[75%] min-w-0 ${isEngineer ? "items-end" : "items-start"}`}>
        <p className="text-xs text-slate-400 mb-1 px-0.5">
          {actorLabel(attachment.uploaded_by_email)} uploaded
        </p>

        {isImage ? (
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <a href={attachment.file_url} target="_blank" rel="noreferrer">
              <img
                src={attachment.file_url} alt={attachment.file_name}
                className="max-h-64 max-w-full object-contain bg-slate-50 block"
              />
            </a>
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 truncate">{attachment.file_name}</p>
              <AttachmentActions attachment={attachment} canDelete={canDelete} deleting={deleting} onDelete={handleDelete} />
            </div>
          </div>
        ) : isTextLike && textPreview ? (
          <div className="w-full rounded-xl border border-slate-700 bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-800/70 border-b border-slate-700/60">
              <span className="text-xs font-medium text-slate-200 truncate">{attachment.file_name}</span>
              <AttachmentActions attachment={attachment} canDelete={canDelete} deleting={deleting} onDelete={handleDelete} light />
            </div>
            <pre className="text-[11.5px] font-mono text-slate-300 px-3 py-2.5 overflow-x-auto max-h-40 whitespace-pre">
              {textPreview}
            </pre>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-sm min-w-[220px]">
            <span className={`w-10 h-10 rounded-lg ring-1 flex items-center justify-center text-[10px] font-bold shrink-0 ${badge.classes}`}>
              {badge.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{attachment.file_name}</p>
              {meta}
            </div>
            <AttachmentActions attachment={attachment} canDelete={canDelete} deleting={deleting} onDelete={handleDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function FeedActivityDivider({ entry, currentUser }) {
  const icon = ACTION_META[entry.action] ?? DEFAULT_ICON;
  const hasTransition = entry.from_value && entry.to_value;

  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="flex-1 h-px bg-slate-200" />
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500 shrink-0">
        <span className="text-sm leading-none">{icon}</span>
        <span>
          <span className="font-medium text-slate-600">{actorLabel(entry.actor_email, currentUser)}</span>
          {" "}{(entry.action_display ?? entry.action).toLowerCase()}
        </span>
        {hasTransition && (
          <span className="inline-flex items-center gap-1">
            {statusPill(entry.from_value)}
            <span className="text-slate-300">→</span>
            {statusPill(entry.to_value)}
          </span>
        )}
        <span className="text-slate-400" title={formatAbsoluteTime(entry.created_at)}>
          · {formatRelativeTime(entry.created_at)}
        </span>
      </div>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

export default function ConversationFeed({
  ticketId, ticket, items, loading, error, refetch,
  draftMessage, onDraftChange, composerId = "conversation-composer",
}) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [isDraggingOver, setDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);
  const scrollRef     = useRef(null);
  const toast = useToast();
  const user = useAuthStore((s) => s.user);

  // Keep the latest message in view as the feed grows — chat-app behaviour.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast(`File exceeds ${MAX_SIZE_MB} MB limit.`, "error");
      return;
    }
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      toast(`File type "${ext}" is not allowed.`, "error");
      return;
    }
    setUploading(true);
    try {
      await uploadAttachment(ticketId, file);
      toast("File uploaded.", "success");
      refetch();
    } catch (err) {
      toast(err.response?.data?.detail || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!draftMessage.trim()) return;
    setSubmitting(true);
    try {
      await addComment(ticketId, draftMessage.trim());
      onDraftChange("");
      refetch();
      toast("Message sent", "success");
    } catch {
      toast("Failed to send message. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSend(e);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items ?? [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          uploadFile(file);
        }
        return;
      }
    }
  };

  const insertCodeBlock = () => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    const insertion = selected ? "```\n" + selected + "\n```" : "```\n\n```";
    const next = value.slice(0, start) + insertion + value.slice(end);
    onDraftChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = selected ? start + insertion.length : start + 4;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    uploadFile(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) setDraggingOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setDraggingOver(false); }
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    uploadFile(file);
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await deleteAttachment(ticketId, attachmentId);
      toast("Attachment deleted.", "success");
      refetch();
    } catch {
      toast("Could not delete attachment.", "error");
    }
  };

  let lastDateKey = null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Conversation</p>
        {items.length > 0 && (
          <span className="text-xs text-slate-400">{items.length} update{items.length === 1 ? "" : "s"}</span>
        )}
      </div>

      <div ref={scrollRef} className="p-5 space-y-4 max-h-[32rem] overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center gap-2 py-4">
            <Spinner size="sm" />
            <span className="text-sm text-slate-500">Loading conversation…</span>
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-slate-500 text-sm">No activity yet. Send the first message below.</p>
        )}
        {items.map((item) => {
          const key = dateKey(item._at);
          const showDivider = key !== lastDateKey;
          lastDateKey = key;

          let node;
          if (item._kind === "comment") {
            node = <FeedCommentBubble key={`c-${item.id}`} comment={item} ticket={ticket} currentUser={user} />;
          } else if (item._kind === "attachment") {
            node = (
              <FeedAttachmentCard
                key={`a-${item.id}`}
                attachment={item}
                ticket={ticket}
                canDelete={user?.is_staff || item.uploaded_by_email === user?.email}
                onDelete={handleDeleteAttachment}
              />
            );
          } else {
            node = <FeedActivityDivider key={`t-${item.id}`} entry={item} currentUser={user} />;
          }

          return showDivider ? (
            <div key={`grp-${key}`} className="space-y-4">
              <DateDivider label={dateLabel(item._at)} />
              {node}
            </div>
          ) : node;
        })}
      </div>

      <form
        onSubmit={handleSend}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative border-t border-slate-100 p-4"
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-10 m-2 flex flex-col items-center justify-center gap-1.5
                          rounded-xl border-2 border-dashed border-brand-400 bg-brand-50/95">
            <UploadCloudIcon className="w-6 h-6 text-brand-500" />
            <span className="text-sm font-medium text-brand-600">Drop file to attach</span>
          </div>
        )}

        <label htmlFor={composerId} className="sr-only">Write a message</label>
        <textarea
          ref={textareaRef}
          id={composerId}
          value={draftMessage}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={2}
          placeholder="Write a message… (Ctrl+Enter to send, paste an image or drop a file)"
          className="input-base resize-none py-2.5 font-sans"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach a file"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500
                         hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {uploading ? <Spinner size="sm" /> : <PaperclipIcon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={insertCodeBlock}
              title="Insert code block"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500
                         hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <CodeIcon className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_EXT.join(",")}
            onChange={handleFileInput}
          />
          <button
            type="submit"
            disabled={submitting || !draftMessage.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-gradient text-white text-sm
                       font-medium rounded-lg hover:opacity-95 active:opacity-90
                       disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm"
          >
            {submitting ? "Sending…" : (<>Send <SendIcon className="w-3.5 h-3.5" /></>)}
          </button>
        </div>
      </form>
    </div>
  );
}
