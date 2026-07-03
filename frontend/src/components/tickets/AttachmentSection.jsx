/**
 * AttachmentSection — file upload + list for a ticket.
 * Shown as the third tab inside TicketDetail.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteAttachment, listAttachments, uploadAttachment } from "../../api/attachments";
import { useToast } from "../../context/ToastContext";

const MAX_SIZE_MB = 5;
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".csv", ".zip", ".xls", ".xlsx"];

const MIME_ICONS = {
  "image/":       "🖼️",
  "application/pdf": "📄",
  "text/":        "📝",
  "application/zip": "🗜️",
  "application/vnd": "📊",
};

function getFileIcon(mime) {
  if (!mime) return "📎";
  for (const [prefix, icon] of Object.entries(MIME_ICONS)) {
    if (mime.startsWith(prefix)) return icon;
  }
  return "📎";
}

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentCard({ attachment, onDelete, canDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return;
    setDeleting(true);
    await onDelete(attachment.id);
    setDeleting(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200
                    rounded-xl hover:bg-slate-100 transition-colors group">
      <span className="text-2xl shrink-0">{getFileIcon(attachment.mime_type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{attachment.file_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatBytes(attachment.file_size)}
          {attachment.uploaded_by_email && ` · ${attachment.uploaded_by_email}`}
          {" · "}{new Date(attachment.uploaded_at).toLocaleDateString("en-IN", {
            day: "numeric", month: "short",
          })}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {attachment.file_url && (
          <a
            href={attachment.file_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            View
          </a>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
            title="Delete attachment"
          >
            {deleting ? "…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AttachmentSection({ ticketId, userEmail, isStaff }) {
  const toast = useToast();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const fileInputRef                  = useRef(null);

  const load = useCallback(() => {
    listAttachments(ticketId)
      .then(({ data }) => setAttachments(data.results ?? data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const validateAndUpload = async (file) => {
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
      load();
    } catch (err) {
      toast(err.response?.data?.detail || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) validateAndUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndUpload(file);
  };

  const handleDelete = async (attachmentId) => {
    try {
      await deleteAttachment(ticketId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast("Attachment deleted.", "success");
    } catch {
      toast("Could not delete attachment.", "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                    transition-all duration-150 select-none
                    ${dragOver
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                    }
                    ${uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <div className="text-3xl mb-2">{uploading ? "⏳" : "📎"}</div>
        <p className="text-sm font-medium text-slate-700">
          {uploading ? "Uploading…" : "Drop a file here or click to browse"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          PNG, JPG, PDF, CSV, ZIP, Excel · Max {MAX_SIZE_MB} MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_EXT.join(",")}
          onChange={handleFileInput}
        />
      </div>

      {/* Attachment list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-14 shimmer rounded-xl" />
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">No attachments yet.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <AttachmentCard
              key={att.id}
              attachment={att}
              onDelete={handleDelete}
              canDelete={isStaff || att.uploaded_by_email === userEmail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
