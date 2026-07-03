/**
 * ConversationFeed — the ticket's single conversation surface.
 *
 * Replaces the old Comments / Files / Activity tabs with one always-visible,
 * chronologically-merged feed: messages render as chat bubbles, uploads as
 * inline file cards, and lifecycle events (assigned, status changed,
 * resolved, ...) as small centered dividers — interleaved by timestamp so
 * the whole ticket reads as one thread, GitHub-Issues/Linear style.
 */
import { useRef, useState } from "react";
import { addComment } from "../../api/tickets";
import { deleteAttachment, uploadAttachment } from "../../api/attachments";
import { useToast } from "../../context/ToastContext";
import { useAuthStore } from "../../store/authStore";
import { formatAbsoluteTime, formatRelativeTime } from "../../utils/time";
import Spinner from "../ui/Spinner";

const MAX_SIZE_MB = 5;
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".csv", ".zip", ".xls", ".xlsx"];

const MIME_ICONS = {
  "image/": "🖼️", "application/pdf": "📄", "text/": "📝",
  "application/zip": "🗜️", "application/vnd": "📊",
};
function getFileIcon(mime) {
  if (!mime) return "📎";
  for (const [prefix, icon] of Object.entries(MIME_ICONS)) {
    if (mime.startsWith(prefix)) return icon;
  }
  return "📎";
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACTION_META = {
  created:          { icon: "🎫", bg: "bg-blue-50",    text: "text-blue-700" },
  status_changed:   { icon: "🔄", bg: "bg-amber-50",   text: "text-amber-700" },
  severity_changed: { icon: "📊", bg: "bg-rose-50",    text: "text-rose-700" },
  assigned:         { icon: "👤", bg: "bg-violet-50",  text: "text-violet-700" },
  reassigned:       { icon: "↔️", bg: "bg-violet-50",  text: "text-violet-700" },
  unassigned:       { icon: "👤", bg: "bg-slate-50",   text: "text-slate-500" },
  comment_added:    { icon: "💬", bg: "bg-slate-50",   text: "text-slate-500" },
  resolved:         { icon: "✅", bg: "bg-emerald-50", text: "text-emerald-700" },
  closed:           { icon: "🔒", bg: "bg-slate-50",   text: "text-slate-700" },
  reopened:         { icon: "🔓", bg: "bg-blue-50",    text: "text-blue-700" },
  sla_breached:     { icon: "⚠️", bg: "bg-red-50",     text: "text-red-700" },
};
const DEFAULT_META = { icon: "•", bg: "bg-slate-50", text: "text-slate-500" };

const STATUS_COLOURS = {
  open:            "bg-sky-100 text-sky-700",
  in_progress:     "bg-indigo-100 text-indigo-700",
  resolved:        "bg-emerald-100 text-emerald-700",
  closed:          "bg-slate-100 text-slate-600",
  assigned:        "bg-violet-100 text-violet-700",
  pending_payment: "bg-yellow-100 text-yellow-700",
};
function statusPill(value) {
  if (!value) return null;
  const colour = STATUS_COLOURS[value] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${colour}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function actorLabel(actorEmail, currentUser) {
  if (!actorEmail) return "system";
  if (actorEmail === currentUser?.email) return "you";
  if (currentUser?.role !== "admin" && currentUser?.is_staff) return "Admin";
  return actorEmail;
}

function FeedCommentBubble({ comment, currentUser }) {
  const isOwn = comment.author_email === currentUser?.email;
  const timeLabel = formatRelativeTime(comment.created_at);

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-slate-500">
          {comment.author_email ?? "Deleted User"}
          {comment.is_edited && <span className="ml-1 italic">(edited)</span>}
        </span>
        {comment.is_internal && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50
                           border border-amber-200 text-[10px] font-semibold text-amber-700">
            Internal
          </span>
        )}
        <span className="text-xs text-slate-500">·</span>
        <span className="text-xs text-slate-500" title={formatAbsoluteTime(comment.created_at)}>
          {timeLabel}
        </span>
      </div>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${isOwn ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}
          ${comment.is_internal ? "ring-1 ring-amber-300" : ""}`}
      >
        {comment.body}
      </div>
    </div>
  );
}

function FeedAttachmentCard({ attachment, canDelete, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return;
    setDeleting(true);
    await onDelete(attachment.id);
    setDeleting(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl self-start max-w-[80%]">
      <span className="text-2xl shrink-0">{getFileIcon(attachment.mime_type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{attachment.file_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatBytes(attachment.file_size)}
          {attachment.uploaded_by_email && ` · ${attachment.uploaded_by_email}`}
          {" · "}{formatRelativeTime(attachment.uploaded_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {attachment.file_url && (
          <a href={attachment.file_url} target="_blank" rel="noreferrer"
             className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            View
          </a>
        )}
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting}
                  className="text-xs text-slate-500 hover:text-rose-600 disabled:opacity-50">
            {deleting ? "…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

function FeedActivityDivider({ entry, currentUser }) {
  const meta = ACTION_META[entry.action] ?? DEFAULT_META;
  const hasTransition = entry.from_value && entry.to_value;

  return (
    <div className="flex items-center justify-center py-1">
      <div className={`inline-flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-full
                       ${meta.bg} text-[11px] ${meta.text}`}>
        <span>{meta.icon}</span>
        <span className="font-medium">{entry.action_display}</span>
        <span className="text-slate-500">by {actorLabel(entry.actor_email, currentUser)}</span>
        {hasTransition && (
          <span className="inline-flex items-center gap-1">
            {statusPill(entry.from_value)}
            <span>→</span>
            {statusPill(entry.to_value)}
          </span>
        )}
        <span className="text-slate-500" title={formatAbsoluteTime(entry.created_at)}>
          {formatRelativeTime(entry.created_at)}
        </span>
      </div>
    </div>
  );
}

export default function ConversationFeed({
  ticketId, items, loading, error, refetch,
  draftMessage, onDraftChange, composerId = "conversation-composer",
}) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();
  const user = useAuthStore((s) => s.user);

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

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
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

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await deleteAttachment(ticketId, attachmentId);
      toast("Attachment deleted.", "success");
      refetch();
    } catch {
      toast("Could not delete attachment.", "error");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">Conversation</p>
      </div>

      <div className="p-5 space-y-4 max-h-[32rem] overflow-y-auto">
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
          if (item._kind === "comment") {
            return <FeedCommentBubble key={`c-${item.id}`} comment={item} currentUser={user} />;
          }
          if (item._kind === "attachment") {
            return (
              <FeedAttachmentCard
                key={`a-${item.id}`}
                attachment={item}
                canDelete={user?.is_staff || item.uploaded_by_email === user?.email}
                onDelete={handleDeleteAttachment}
              />
            );
          }
          return <FeedActivityDivider key={`t-${item.id}`} entry={item} currentUser={user} />;
        })}
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-100 p-4">
        <label htmlFor={composerId} className="sr-only">Write a message</label>
        <textarea
          id={composerId}
          value={draftMessage}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Write a message… (Ctrl+Enter to send)"
          className="input-base resize-none py-2.5"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach a file"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500
                       hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {uploading ? "⏳" : "📎"}
          </button>
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm
                       font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
