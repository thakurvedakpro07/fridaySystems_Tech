import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import ActivityTimeline from "./ActivityTimeline";
import AttachmentSection from "./AttachmentSection";
import CommentSection from "./CommentSection";
import AdminTicketActions from "./AdminTicketActions";
import FreelancerTicketActions from "./FreelancerTicketActions";
import PaymentGateway from "./PaymentGateway";
import CSATWidget from "./CSATWidget";
import CustomerResolutionActions from "./CustomerResolutionActions";
import Badge from "../ui/Badge";
import { updateTicket } from "../../api/tickets";

// ── Ticket Timeline ───────────────────────────────────────────────
const LIFECYCLE = [
  {
    status: "pending_payment",
    label: "Ticket Created",
    desc: "Ticket submitted — awaiting payment to activate",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    status: "open",
    label: "Payment Received",
    desc: "Consulting fee confirmed — ticket is now queued",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    status: "assigned",
    label: "Engineer Assigned",
    desc: "A verified specialist has accepted your ticket",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    status: "in_progress",
    label: "Work Started",
    desc: "Engineer is actively diagnosing and resolving the issue",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    status: "waiting_customer",
    label: "Waiting for Your Response",
    desc: "The engineer needs your input or additional access",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    status: "resolved",
    label: "Resolved",
    desc: "Issue fixed — please confirm resolution and rate your experience",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    status: "closed",
    label: "Closed",
    desc: "Ticket closed — invoice available in Billing",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
];

// Role-aware overrides for the 3 ambiguous steps
const ROLE_LABEL_OVERRIDES = {
  assigned: {
    freelancer: { label: "Assigned to You",                    desc: "This ticket has been assigned to you" },
    admin:      { label: "Engineer Assigned",                   desc: "A specialist has been assigned to this ticket" },
  },
  in_progress: {
    customer:   { label: "Engineer Working",                    desc: "Your engineer is actively resolving the issue" },
    admin:      { label: "In Progress",                         desc: "Engineer is actively working on this issue" },
  },
  waiting_customer: {
    freelancer: { label: "Waiting for Customer Response",       desc: "Waiting for the customer to provide input or access" },
    admin:      { label: "Waiting for Customer",                desc: "Waiting for the customer to provide input or access" },
  },
};

function getLifecycle(role) {
  const r = role === "freelancer" ? "freelancer"
          : (role === "admin" || role === "support_agent") ? "admin"
          : "customer";
  return LIFECYCLE.map((step) => {
    const override = ROLE_LABEL_OVERRIDES[step.status]?.[r];
    return override ? { ...step, ...override } : step;
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function TicketStatusTracker({ status, ticket, role, isPendingPayment = false }) {
  const lifecycle = getLifecycle(role);
  const currentIdx = lifecycle.findIndex((s) => s.status === status);

  // Map statuses to ticket timestamps where available
  const timestamps = {
    pending_payment: ticket?.created_at,
    open:             ticket?.payment_confirmed_at ?? (ticket?.status !== "pending_payment" ? ticket?.created_at : null),
    assigned:         ticket?.first_response_at,
    in_progress:      ticket?.first_response_at,
    resolved:         ticket?.resolved_at,
    closed:           ticket?.resolved_at,
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Ticket Progress
        </p>
        {(status === "resolved" || status === "closed") && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700
                           bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Complete
          </span>
        )}
        {status !== "resolved" && status !== "closed" && currentIdx >= 0 && (
          <span className="text-[11px] text-slate-500 font-medium">
            Step {currentIdx + 1} of {lifecycle.length}
          </span>
        )}
      </div>

      {/* Vertical timeline */}
      <div className="space-y-0">
        {lifecycle.map((step, idx) => {
          const done    = idx < currentIdx;
          const current = idx === currentIdx;
          const isLast  = idx === lifecycle.length - 1;
          const ts      = timestamps[step.status];
          // In pending-payment state: step 1 is "next up", steps 2+ are locked/far future
          const isNextStep = isPendingPayment && idx === 1;
          const isLocked   = isPendingPayment && idx > 1;

          return (
            <div key={step.status}
                 className={`flex gap-3 transition-opacity duration-200
                   ${isLocked ? "opacity-40" : ""}`}>
              {/* Icon column */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                    ${current
                      ? "bg-indigo-600 shadow-md shadow-indigo-200 ring-4 ring-indigo-50"
                      : done
                      ? "bg-emerald-500"
                      : "bg-white border-2 border-slate-200"
                    }`}
                >
                  {done ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className={current ? "text-white" : "text-slate-500"}>
                      {step.icon}
                    </span>
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[20px] transition-colors duration-300
                    ${done ? "bg-emerald-300" : "bg-slate-150"}`}
                    style={{ backgroundColor: done ? "#6ee7b7" : "#f1f5f9" }}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 flex-1 min-w-0 ${isLast ? "pb-0" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold leading-tight
                      ${current ? "text-indigo-700" : done ? "text-slate-800" : "text-slate-500"}`}>
                      {step.label}
                    </p>
                    {(current || done) && (
                      <p className={`text-xs mt-0.5 leading-relaxed
                        ${current ? "text-slate-500" : "text-slate-500"}`}>
                        {step.desc}
                      </p>
                    )}
                  </div>
                  {ts && (done || current) && (
                    <span className="text-[10px] text-slate-500 shrink-0 pt-0.5 whitespace-nowrap">
                      {formatShortDate(ts)}
                    </span>
                  )}
                </div>
                {current && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-600">Active now</span>
                  </div>
                )}
                {isNextStep && (
                  <p className="text-[10px] font-medium text-amber-600 mt-1 leading-snug">
                    Unlocks after payment above
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Engineer Trust Card ───────────────────────────────────────────
function EngineerTrustCard({ assignedTo }) {
  if (!assignedTo?.email) return null;

  const firstName = (assignedTo.first_name ?? "").trim();
  const lastName  = (assignedTo.last_name  ?? "").trim();
  const name      = firstName && lastName
    ? `${firstName} ${lastName}`
    : firstName || assignedTo.email.split("@")[0];
  const initials  = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
        Your Assigned Engineer
      </p>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 text-sm font-bold
                          flex items-center justify-center select-none">
            {initials}
          </div>
        </div>

        {/* Name + verified badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-slate-900 leading-tight">{name}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                             bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Verified
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">IT Support Engineer</p>
          <p className="text-xs text-slate-500 mt-0.5">{assignedTo.email}</p>
        </div>
      </div>
    </div>
  );
}

function humanize(str) {
  if (!str) return "";
  return str.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TABS = [
  { id: "comments", label: "Comments",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
  },
  { id: "attachments", label: "Files",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
  },
  { id: "activity", label: "Activity",
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
  },
];

function MetaItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

// ── SLA response-time copy keyed by ticket severity ───────────────
const SLA_MESSAGE = {
  critical: "A Support Agent will contact you within 30 minutes.",
  high:     "A Support Agent will contact you within 1 hour.",
  medium:   "A Support Agent will contact you within 2 hours.",
  low:      "A Support Agent will contact you within 4 hours.",
};

const SLA_TIME = {
  critical: "30 minutes",
  high:     "1 hour",
  medium:   "2 hours",
  low:      "4 hours",
};

const COMM_OPTIONS = [
  {
    value: "phone",
    label: "Phone Call",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
  {
    value: "chat",
    label: "Live Chat",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
];

const LANG_OPTIONS = [
  { value: "english", label: "English" },
  { value: "hindi",   label: "Hindi" },
  { value: "marathi", label: "Marathi" },
];

const COMM_LABEL = { phone: "Phone Call", chat: "Live Chat" };
const LANG_LABEL = { english: "English", hindi: "Hindi", marathi: "Marathi" };

// ── Post-payment preferences card ─────────────────────────────────
// Shown when status = "open" (payment confirmed, awaiting engineer assignment).
// Mode 1 (form): !saved || editing — shows communication + language selectors.
// Mode 2 (summary): saved && !editing — compact confirmation; "Edit Preferences" re-enters form.
function PostPaymentCard({ ticket, onUpdate }) {
  const [commPref, setCommPref] = useState(ticket.communication_preference || "");
  const [language, setLanguage] = useState(ticket.preferred_language || "english");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(
    !!(ticket.communication_preference && ticket.preferred_language),
  );
  const [editing,  setEditing]  = useState(false);
  const [error,    setError]    = useState(null);

  const slaMsg  = SLA_MESSAGE[ticket.severity] ?? SLA_MESSAGE.medium;
  const slaTime = SLA_TIME[ticket.severity]    ?? SLA_TIME.medium;

  const handleSave = async () => {
    if (!commPref) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await updateTicket(ticket.id, {
        communication_preference: commPref,
        preferred_language:       language,
      });
      setSaved(true);
      setEditing(false);
      onUpdate(data);
    } catch {
      setError("Could not save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setCommPref(ticket.communication_preference || "");
    setLanguage(ticket.preferred_language || "english");
    setError(null);
    setEditing(false);
  };

  // ── Mode 2: confirmation summary ───────────────────────────────
  if (saved && !editing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />

        <div className="p-5">
          {/* Success header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">You're all set!</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Your preferences have been saved successfully.
              </p>
            </div>
          </div>

          {/* Estimated first response */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Estimated first response
            </p>
            <p className="text-sm font-bold text-slate-900">Within {slaTime}</p>
          </div>

          {/* Saved preferences summary */}
          <dl className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <dt className="text-xs font-medium text-slate-500 mb-0.5">Communication</dt>
              <dd className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                {commPref === "phone" ? (
                  <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                ) : commPref === "chat" ? (
                  <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ) : null}
                {COMM_LABEL[commPref] || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 mb-0.5">Language</dt>
              <dd className="text-sm font-semibold text-slate-800">
                {LANG_LABEL[language] || "—"}
              </dd>
            </div>
          </dl>

          {/* Edit button */}
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600
                       border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300
                       transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit Preferences
          </button>
        </div>
      </div>
    );
  }

  // ── Mode 1: editable form ──────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">You're all set!</h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{slaMsg}</p>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              A Support Agent will review your request and contact you using your preferred
              communication method.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 mb-5" />

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Contact Preferences
        </p>

        {/* Communication method */}
        <div className="mb-5">
          <p className="text-sm font-medium text-slate-700 mb-2.5">
            How should our Support Agent contact you?
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {COMM_OPTIONS.map((opt) => {
              const selected = commPref === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCommPref(opt.value)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm
                              font-medium transition-all duration-150 text-left
                    ${selected
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                >
                  <span className={selected ? "text-indigo-500" : "text-slate-400"}>
                    {opt.icon}
                  </span>
                  {opt.label}
                  {selected && (
                    <svg className="w-3.5 h-3.5 ml-auto text-indigo-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" clipRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred language */}
        <div className="mb-5">
          <p className="text-sm font-medium text-slate-700 mb-2.5">Preferred language</p>
          <div className="flex flex-wrap gap-2">
            {LANG_OPTIONS.map((opt) => {
              const selected = language === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium
                              transition-all duration-150
                    ${selected
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl
                          px-3 py-2.5 text-xs text-rose-700 mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Save / Cancel row */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !commPref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white
                       text-sm font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm
                       shadow-indigo-200"
          >
            {saving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Saving…
              </>
            ) : (
              "Save Preferences"
            )}
          </button>

          {editing && (
            <button
              onClick={handleCancelEdit}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Engineer assigned info card ───────────────────────────────────
// Replaces PostPaymentCard once ticket.assigned_to is set.
function EngineerAssignedInfoCard({ ticket, onOpenChat }) {
  const { assigned_to, communication_preference, preferred_language, assigned_at } = ticket;

  const firstName = (assigned_to.first_name ?? "").trim();
  const lastName  = (assigned_to.last_name  ?? "").trim();
  const name      = firstName && lastName
    ? `${firstName} ${lastName}`
    : firstName || assigned_to.email.split("@")[0];
  const initials  = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const skills = assigned_to.skills
    ? assigned_to.skills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const specialization = skills.length > 0
    ? skills.slice(0, 3).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      {/* Indigo accent bar */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />

      <div className="p-5">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Engineer Assigned
        </p>

        {/* ── Engineer identity ────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 text-sm font-bold
                          flex items-center justify-center shrink-0 select-none">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900 leading-tight">{name}</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                               bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">IT Support Engineer</p>
            {specialization && (
              <p className="text-xs text-indigo-600 font-medium mt-0.5">{specialization}</p>
            )}
          </div>
        </div>

        {/* ── Details grid ────────────────────────────────── */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4 mb-4">
          <div>
            <dt className="text-xs font-medium text-slate-500 mb-1">Communication</dt>
            <dd className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              {communication_preference === "phone" ? (
                <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              ) : communication_preference === "chat" ? (
                <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              ) : null}
              {COMM_LABEL[communication_preference] || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 mb-1">Language</dt>
            <dd className="text-sm font-semibold text-slate-800">
              {LANG_LABEL[preferred_language] || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 mb-1">Assigned at</dt>
            <dd className="text-sm font-semibold text-slate-800">
              {assigned_at
                ? new Date(assigned_at).toLocaleString("en-IN", {
                    day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "—"}
            </dd>
          </div>
        </dl>

        {/* ── CTA ──────────────────────────────────────────── */}
        {communication_preference === "chat" ? (
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white
                       text-sm font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800
                       transition-colors shadow-sm shadow-indigo-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Open Chat
          </button>
        ) : communication_preference === "phone" ? (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl
                          px-3.5 py-2.5">
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Your engineer will call you</span>
              {" "}— keep your phone available
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TicketDetail({ ticket, onUpdate, role = "customer" }) {
  const [activeTab, setActiveTab] = useState("comments");
  const user = useAuthStore((s) => s.user);
  const handleUpdate = onUpdate ?? (() => {});

  if (!ticket) return null;

  const isPendingPayment = role === "customer" && ticket.status === "pending_payment";

  return (
    <div className="space-y-4">
      {/* ── Payment card — FIRST when pending (primary next action) ── */}
      {isPendingPayment && (
        <PaymentGateway ticket={ticket} onPaymentSuccess={handleUpdate} />
      )}

      {/* ── Contact / next steps card — FIRST after payment ── */}
      {/* status=open: payment confirmed, waiting for engineer  */}
      {role === "customer" && ticket.status === "open" && (
        <PostPaymentCard ticket={ticket} onUpdate={handleUpdate} />
      )}

      {/* ── Engineer assigned info card ───────────────────── */}
      {/* Replaces PostPaymentCard once an engineer is set    */}
      {role === "customer" && ticket.assigned_to &&
       !["pending_payment", "open"].includes(ticket.status) && (
        <EngineerAssignedInfoCard ticket={ticket} onOpenChat={() => setActiveTab("comments")} />
      )}

      {/* ── Status tracker ────────────────────────────────── */}
      <TicketStatusTracker
        status={ticket.status}
        ticket={ticket}
        role={role}
        isPendingPayment={isPendingPayment}
      />

      {/* ── Ticket header card ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        {/* Top accent bar */}
        <div className="h-1 bg-brand-gradient" />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono font-medium text-slate-500">{ticket.ticket_number}</span>
              <h1 className="text-lg font-semibold text-slate-900 mt-1 leading-snug">
                {ticket.title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
              <Badge label={ticket.status} dot />
              <Badge label={ticket.severity} />
            </div>
          </div>

          {ticket.description && (
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap
                          bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
              {ticket.description}
            </p>
          )}

          {/* Metadata grid */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-5">
            {ticket.customer && role !== "customer" && (
              <MetaItem label="Customer">
                <span className="block">{ticket.customer.name}</span>
                {ticket.customer.company && (
                  <span className="block text-xs text-slate-500 font-normal">{ticket.customer.company}</span>
                )}
                <span className="block text-xs text-slate-500 font-normal">{ticket.customer.email}</span>
              </MetaItem>
            )}
            <MetaItem label="Service">
              {humanize(ticket.service_type)}
            </MetaItem>
            <MetaItem label="Assigned to">
              {ticket.assigned_to?.email ?? (
                <span className="text-slate-500 font-normal italic">Unassigned</span>
              )}
            </MetaItem>
            <MetaItem label="Opened">
              {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </MetaItem>
            {ticket.first_response_at && (
              <MetaItem label="First response">
                {new Date(ticket.first_response_at).toLocaleString("en-IN", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </MetaItem>
            )}
            {ticket.resolved_at && (
              <MetaItem label="Resolved">
                {new Date(ticket.resolved_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </MetaItem>
            )}
            {ticket.first_response_due_at && (
              <div>
                <dt className="text-xs font-medium text-slate-500 mb-0.5">Consultation deadline</dt>
                <dd className={`text-sm font-medium ${
                  new Date(ticket.first_response_due_at) < new Date() && !["resolved", "closed"].includes(ticket.status)
                    ? "text-rose-600"
                    : "text-slate-800"
                }`}>
                  {new Date(ticket.first_response_due_at).toLocaleString("en-IN", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
          </dl>

          {ticket.remote_session_url && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-xs text-indigo-600 font-semibold mb-1">Remote session link</p>
              <a
                href={ticket.remote_session_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-700 hover:text-indigo-900 hover:underline break-all"
              >
                {ticket.remote_session_url}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Engineer trust card ───────────────────────────── */}
      {ticket.assigned_to && role !== "freelancer" && (
        <EngineerTrustCard assignedTo={ticket.assigned_to} />
      )}

      {/* ── Role-specific action panels ──────────────────── */}
      {role === "admin" && (
        <AdminTicketActions ticket={ticket} onUpdate={handleUpdate} />
      )}
      {role === "freelancer" && (
        <FreelancerTicketActions ticket={ticket} onUpdate={handleUpdate} />
      )}
      {role === "customer" && (
        <>
          <CustomerResolutionActions ticket={ticket} onUpdate={handleUpdate} />
          <CSATWidget ticket={ticket} onUpdate={handleUpdate} />
        </>
      )}

      {/* ── Tab navigation ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        <div className="flex border-b border-slate-100 px-2 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                          rounded-lg mb-1 transition-all duration-150
                ${activeTab === tab.id
                  ? "text-indigo-700 bg-indigo-50"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div key={activeTab} className="p-5 animate-fade-in">
          {activeTab === "comments" && (
            <CommentSection ticketId={ticket.id} />
          )}
          {activeTab === "attachments" && (
            <AttachmentSection
              ticketId={ticket.id}
              userEmail={user?.email}
              isStaff={user?.is_staff}
            />
          )}
          {activeTab === "activity" && (
            <ActivityTimeline ticketId={ticket.id} />
          )}
        </div>
      </div>
    </div>
  );
}
