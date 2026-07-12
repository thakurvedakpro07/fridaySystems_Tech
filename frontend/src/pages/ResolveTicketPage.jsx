/**
 * ResolveTicketPage — the Resolution Workspace (/tickets/:id/resolve).
 *
 * Replaces the old "Mark Resolved" drawer/modal entirely. "Mark Resolved"
 * (FreelancerTicketActions) and "Change Status → Resolved" (AdminTicketActions)
 * now just navigate here instead of opening an in-place form — this is a full
 * dedicated page, not an overlay, so there's room to grow (attachments, future
 * AI/KB suggestions) without fighting a drawer's limited space.
 *
 * No new backend endpoints or fields: exactly like the drawer it replaces,
 * this persists the 5 structured fields through the existing internal-note
 * channel (utils/resolution.js) and transitions status through the existing
 * ops/freelancer status endpoints (resolveTicketByRole). "Save Draft" reuses
 * the same non-resolving save the old "Capture Resolution / Update" drawer
 * used — it just doesn't call resolveTicketByRole afterward.
 */
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { addComment } from "../api/tickets";
import { uploadAttachment, deleteAttachment } from "../api/attachments";
import { useConversationFeed } from "../hooks/useConversationFeed";
import { useRoleTicketFetcher } from "../hooks/useRoleTicketFetcher";
import { useRoles } from "../hooks/useRoles";
import { useSlaClocks } from "../hooks/useSlaClocks";
import { usePageTitle } from "../hooks/usePageTitle";
import { useToast } from "../context/ToastContext";
import { getDisplayName } from "../utils/displayName";
import { formatAbsoluteTime, formatRelativeTime } from "../utils/time";
import {
  FIELDS, REQUIRED_TO_RESOLVE, composeBody, findLatestResolution, resolveTicketByRole,
} from "../utils/resolution";
import ConversationFeed from "../components/tickets/ConversationFeed";
import MainLayout from "../components/layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import SLABadge from "../components/dashboard/SLABadge";

const NOTES_COMPOSER_ID = "resolve-notes-composer";

function humanize(str) {
  if (!str) return "";
  return str.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fileBadge(mime, fileName) {
  const ext = (fileName?.split(".").pop() || "").toUpperCase();
  if (mime?.includes("pdf")) return { label: "PDF", classes: "bg-red-50 text-red-600 ring-red-100" };
  if (mime?.includes("zip")) return { label: "ZIP", classes: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (mime?.startsWith("image/")) return { label: ext || "IMG", classes: "bg-violet-50 text-violet-600 ring-violet-100" };
  return { label: ext || "FILE", classes: "bg-indigo-50 text-indigo-600 ring-indigo-100" };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons (hand-rolled, matching the Heroicons-outline convention already
// established in ConversationFeed.jsx — no icon package dependency) ────────
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const FlagIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M4 21V4m0 0h13.5l-2.25 4.25L17.5 12.5H4" /></svg>
);
const UserIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.12a7.5 7.5 0 0 1 15 0" /></svg>
);
const HeadsetIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z" /></svg>
);
const CalendarIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z" /></svg>
);
const ClockIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M12 6v6l4 2" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
);
const TagIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M9.57 3H5.25A2.25 2.25 0 0 0 3 5.25v4.32c0 .6.24 1.17.66 1.59l9.58 9.58c.7.7 1.78.87 2.6.33a18.1 18.1 0 0 0 5.23-5.22c.54-.83.37-1.91-.33-2.61L11.16 3.66A2.25 2.25 0 0 0 9.57 3Z" /><path d="M6.75 6.75h.008v.008H6.75V6.75Z" /></svg>
);
const UploadCloudIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M4 14.9A5 5 0 0 1 6 5.3 6 6 0 0 1 17.7 8H18a4 4 0 0 1 1 7.9" /><path d="M12 12v9" /><path d="m8 17 4-4 4 4" /></svg>
);
const ChevronDownIcon = (p) => (
  <svg {...iconProps} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
const CheckIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M5 13l4 4L19 7" /></svg>
);
const ArrowRightIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
);
const ArrowLeftIcon = (p) => (
  <svg {...iconProps} {...p}><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
);

// ── Metadata pill — icon + label/value, used in the header's property row.
// Equal-height grid cell (h-full); dd has no forced truncate/leading-none so
// multi-line content (e.g. the stacked SLA value) can wrap without clipping —
// single-line values opt into truncation themselves via their own span. ────
function MetaPill({ icon: Icon, label, children }) {
  return (
    <div className="h-full flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
      <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-none">{label}</dt>
        <dd className="text-sm font-semibold text-slate-800 mt-1.5">{children}</dd>
      </div>
    </div>
  );
}

// ── Card wrapper for each major section — title/description header, optional
// collapse toggle, consistent padding/radius/shadow across the page ────────
function SectionCard({ eyebrow, title, description, collapsed, onToggleCollapse, bodyId, bodyClassName, children }) {
  const collapsible = typeof onToggleCollapse === "function";
  const header = (
    <div className="flex-1 text-left min-w-0">
      {eyebrow && <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{eyebrow}</p>}
      <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    </div>
  );

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="w-full flex items-center justify-between gap-4 px-6 sm:px-7 py-5 border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
        >
          {header}
          <ChevronDownIcon className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
        </button>
      ) : (
        <div className="flex items-start justify-between gap-4 px-6 sm:px-7 py-5 border-b border-slate-100">{header}</div>
      )}
      <div id={bodyId} className={`${bodyClassName ?? "px-6 sm:px-7 py-6"} ${collapsed ? "hidden" : ""}`}>
        {children}
      </div>
    </section>
  );
}

// ── "What's needed to resolve" checklist strip — purely derived from the
// existing `values`/`attachments`, doesn't touch REQUIRED_TO_RESOLVE or the
// actual validation logic in handleResolve. ─────────────────────────────────
function RequirementChip({ label, done, required }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium transition-colors
        ${done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-500"}`}
    >
      <span className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${done ? "bg-emerald-500 text-white" : "border border-slate-300"}`}>
        {done && <CheckIcon className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      {label}
      {!required && <span className="text-slate-400 font-normal">(optional)</span>}
    </span>
  );
}

function ResolutionRequirements({ values, attachmentCount }) {
  const items = [
    { id: "rootCause", label: "Root Cause", required: true, done: !!(values.rootCause ?? "").toString().trim() },
    { id: "stepsTaken", label: "Steps Taken", required: true, done: !!(values.stepsTaken ?? "").toString().trim() },
    { id: "resolutionNotes", label: "Resolution Notes", required: true, done: !!(values.resolutionNotes ?? "").toString().trim() },
    { id: "attachments", label: "Attachments", required: false, done: attachmentCount > 0 },
    { id: "prevention", label: "Prevention", required: false, done: !!(values.prevention ?? "").toString().trim() },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 mb-7 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-1 shrink-0">To resolve</span>
      {items.map(({ id, ...rest }) => <RequirementChip key={id} {...rest} />)}
    </div>
  );
}

function AttachmentsSection({ ticketId, attachments, loading, onUploaded, onDeleted }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDraggingOver, setDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAttachment(ticketId, file);
      toast("File uploaded.", "success");
      onUploaded();
    } catch (err) {
      toast(err.response?.data?.detail || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    uploadFile(file);
  };

  const handleDelete = async (attachmentId, fileName) => {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    setDeletingId(attachmentId);
    try {
      await deleteAttachment(ticketId, attachmentId);
      toast("Attachment deleted.", "success");
      onDeleted();
    } catch {
      toast("Could not delete attachment.", "error");
    } finally {
      setDeletingId(null);
    }
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
    uploadFile(e.dataTransfer?.files?.[0]);
  };

  return (
    <SectionCard eyebrow="Section 2" title="Attachments" description="Screenshots, logs, or other evidence supporting this resolution.">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors
          ${isDraggingOver ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 bg-slate-50/60"}`}
      >
        <span className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors
          ${isDraggingOver ? "bg-indigo-100 text-indigo-600" : "bg-white text-slate-400 border border-slate-200"}`}>
          <UploadCloudIcon className="w-5 h-5" />
        </span>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">Drag and drop files here</span>, or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Browse Files"}
          </button>
        </p>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {(loading || attachments.length > 0) && (
        <div className="mt-4 space-y-2.5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Spinner size="sm" /> Loading attachments…
            </div>
          )}
          {attachments.map((a) => {
            const badge = fileBadge(a.mime_type, a.file_name);
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
              >
                <span className={`w-10 h-10 rounded-lg ring-1 flex items-center justify-center text-[10px] font-bold shrink-0 ${badge.classes}`}>
                  {badge.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{a.file_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(a.file_size)} · {a.uploaded_by_email ?? "Unknown"}
                    {" · "}<span title={formatAbsoluteTime(a.uploaded_at)}>{formatRelativeTime(a.uploaded_at)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      View
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(a.id, a.file_name)}
                    disabled={deletingId === a.id}
                    className="text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50"
                  >
                    {deletingId === a.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && attachments.length === 0 && (
        <p className="text-xs text-slate-400 mt-3">No files attached yet.</p>
      )}
    </SectionCard>
  );
}

export default function ResolveTicketPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { fetchFn, role } = useRoleTicketFetcher(id);
  const { isTicketManagementStaff } = useRoles();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const feed = useConversationFeed(id);
  const [draftMessage, setDraftMessage] = useState("");

  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(null); // null | "draft" | "resolve"
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const prefilled = useRef(false);

  usePageTitle(ticket ? `Resolve ${ticket.ticket_number}` : "Resolve Ticket");

  useEffect(() => {
    setLoading(true);
    fetchFn()
      .then(({ data }) => setTicket(data))
      .catch((err) => {
        setError(err.response?.status === 404 ? "Ticket not found." : "Could not load ticket. Please try again.");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Prefill once from any previously captured resolution summary — only on
  // first load, so a later feed.refetch() (e.g. after uploading a file)
  // doesn't clobber whatever the user is actively typing.
  useEffect(() => {
    if (prefilled.current || feed.loading) return;
    const latest = findLatestResolution(feed.items);
    if (latest) setValues(latest);
    prefilled.current = true;
  }, [feed.items, feed.loading]);

  const { resolution: resolutionClock } = useSlaClocks(ticket ?? {});
  const attachments = feed.items.filter((i) => i._kind === "attachment");

  const canAccess = role === "freelancer" || ((role === "admin" || role === "support_agent") && isTicketManagementStaff);
  const canResolve = ticket?.status === "in_progress";

  const handleFieldChange = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  };

  const handleCancel = () => navigate(`/tickets/${id}`);

  const handleSaveDraft = async () => {
    if (!FIELDS.some(({ key }) => (values[key] ?? "").toString().trim())) {
      toast("Add at least one field before saving.", "error");
      return;
    }
    setSaving("draft");
    try {
      await addComment(id, composeBody(values), true);
      feed.refetch();
      toast("Draft saved.", "success");
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not save draft. Please try again.", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleResolve = async () => {
    const errors = {};
    for (const key of REQUIRED_TO_RESOLVE) {
      if (!(values[key] ?? "").toString().trim()) {
        errors[key] = "Required before resolving this ticket.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      document.getElementById(`res-${Object.keys(errors)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setFieldErrors({});
    setSaving("resolve");
    let summarySaved = false;
    try {
      await addComment(id, composeBody(values), true);
      summarySaved = true;
      await resolveTicketByRole(role, id, "Resolved with a structured resolution summary — see internal notes.");
      toast("Ticket resolved successfully.", "success");
      navigate(`/tickets/${id}`);
    } catch (err) {
      if (summarySaved) {
        toast("Resolution summary saved, but marking the ticket resolved failed. Please try again.", "error");
      } else {
        toast(err.response?.data?.detail ?? "Could not save resolution summary. Please try again.", "error");
      }
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <MainLayout maxWidth="max-w-5xl">
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout maxWidth="max-w-5xl">
        <Alert severity="error" className="mt-6">{error}</Alert>
      </MainLayout>
    );
  }

  if (!ticket) return null;

  if (!canAccess) return <Navigate to={`/tickets/${id}`} replace />;

  if (!canResolve) {
    return (
      <MainLayout maxWidth="max-w-5xl">
        <div className="pt-6">
          <Link to={`/tickets/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" strokeWidth={2.5} />
            Back to Ticket
          </Link>
          <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <p className="text-base font-semibold text-slate-900">This ticket can't be resolved right now.</p>
            <p className="text-sm text-slate-500 mt-1.5">
              Only a ticket that's currently <span className="font-medium">Work Started</span> can be marked resolved.
              This ticket is currently <Badge label={ticket.status} domain="ticketStatus" />.
            </p>
            <Button className="mt-5" variant="secondary" onClick={handleCancel}>Back to Ticket</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const engineerName = ticket.assigned_to
    ? (getDisplayName(ticket.assigned_to, "full") || ticket.assigned_to.email?.split("@")[0] || "—")
    : "—";

  return (
    <MainLayout maxWidth="max-w-5xl">
      <div className="pt-6 pb-10">
        {/* Top — back link, page-level navigation, not workspace content */}
        <Link to={`/tickets/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors group">
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
          Back to Ticket
        </Link>

        {/* Header card */}
        <div className="mt-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-7">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">{ticket.ticket_number}</span>
            <Badge label={ticket.status} domain="ticketStatus" />
          </div>
          <p className="mt-4 text-[11px] font-bold text-indigo-500 uppercase tracking-widest">Resolution Workspace</p>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-1">{ticket.title}</h1>

          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-6 pt-6 border-t border-slate-100 items-stretch">
            <MetaPill icon={FlagIcon} label="Priority"><Badge label={ticket.severity} domain="severity" /></MetaPill>
            <MetaPill icon={UserIcon} label="Customer">
              <span className="block break-words">{ticket.customer?.name ?? ticket.customer?.email ?? "—"}</span>
            </MetaPill>
            <MetaPill icon={HeadsetIcon} label="Assigned Engineer">
              <span className="block break-words">{engineerName}</span>
            </MetaPill>
            <MetaPill icon={CalendarIcon} label="Created">
              <span className="block break-words">
                {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </MetaPill>
            {/* SLA is a vertical block, not a single line — a status badge and a
                countdown ("2d 20h remaining") can't share one row without one of
                them truncating, so they stack instead of competing for width. */}
            <MetaPill icon={ClockIcon} label="Current SLA">
              <div className="flex flex-col gap-1">
                <SLABadge status={resolutionClock.status} />
                {resolutionClock.label && (
                  <span className={`text-xs font-medium leading-none ${resolutionClock.overdue ? "text-rose-600" : "text-slate-500"}`}>
                    {resolutionClock.label}
                  </span>
                )}
              </div>
            </MetaPill>
            <MetaPill icon={TagIcon} label="Service">
              <span className="block break-words">{humanize(ticket.service_type)}</span>
            </MetaPill>
          </dl>
        </div>

        {/* Sections */}
        <div className="mt-6 space-y-6">
          {/* Section 1 — Resolution Details */}
          <SectionCard eyebrow="Section 1" title="Resolution Details" description="What happened, what was done, and how to prevent it next time.">
            <ResolutionRequirements values={values} attachmentCount={attachments.length} />
            <div className="space-y-6">
              {FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label htmlFor={`res-${key}`} className="block text-sm font-semibold text-slate-800 mb-2">
                    {label}{key === "timeSpent" ? " (minutes)" : ""}
                    {REQUIRED_TO_RESOLVE.has(key) && <span className="text-rose-500"> *</span>}
                  </label>
                  {type === "number" ? (
                    <input
                      id={`res-${key}`}
                      type="number"
                      min="0"
                      placeholder="e.g. 45"
                      value={values[key] ?? ""}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      className="input-base text-base rounded-xl py-3 max-w-xs hover:border-slate-300"
                    />
                  ) : (
                    <textarea
                      id={`res-${key}`}
                      value={values[key] ?? ""}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      rows={key === "rootCause" || key === "prevention" ? 3 : 5}
                      placeholder={`Describe the ${label.toLowerCase()}…`}
                      className={`input-base text-base leading-relaxed rounded-xl py-3 resize-none hover:border-slate-300 ${
                        fieldErrors[key] ? "border-rose-300 focus:ring-rose-300/60 hover:border-rose-300" : ""
                      }`}
                    />
                  )}
                  {fieldErrors[key] && <p className="text-xs text-rose-600 mt-1.5">{fieldErrors[key]}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Section 2 — Attachments */}
          <AttachmentsSection
            ticketId={id}
            attachments={attachments}
            loading={feed.loading}
            onUploaded={feed.refetch}
            onDeleted={feed.refetch}
          />

          {/* Section 3 — Activity Timeline (reuses the ticket's existing conversation/activity component) */}
          <SectionCard
            eyebrow="Section 3"
            title="Activity Timeline"
            description="Full activity, comments, and internal notes for this ticket."
            collapsed={timelineCollapsed}
            onToggleCollapse={() => setTimelineCollapsed((v) => !v)}
            bodyId="resolve-timeline-panel"
            bodyClassName="p-5"
          >
            <ConversationFeed
              ticketId={id}
              ticket={ticket}
              items={feed.items}
              loading={feed.loading}
              error={feed.error}
              refetch={feed.refetch}
              draftMessage={draftMessage}
              onDraftChange={setDraftMessage}
              role={role}
              composerId={NOTES_COMPOSER_ID}
            />
          </SectionCard>
        </div>
      </div>

      {/* Bottom sticky action bar */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-between shadow-[0_-4px_16px_-4px_rgb(0_0_0_/_0.06)]">
        <Button variant="ghost" size="lg" onClick={handleCancel} disabled={saving !== null}>
          Cancel
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="lg" onClick={handleSaveDraft} loading={saving === "draft"} disabled={saving !== null}>
            {saving === "draft" ? "Saving…" : "Save Draft"}
          </Button>
          <Button size="lg" onClick={handleResolve} loading={saving === "resolve"} disabled={saving !== null}>
            {saving === "resolve" ? "Resolving…" : (<>Resolve Ticket <ArrowRightIcon className="w-4 h-4" /></>)}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
