import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConversationFeed } from "../../hooks/useConversationFeed";
import { useCountdown } from "../../hooks/useCountdown";
import ConversationFeed from "./ConversationFeed";
import TicketSLAPanel from "./TicketSLAPanel";
import ResolutionPanel from "./ResolutionPanel";
import ResolutionSummary from "./ResolutionSummary";
import AdminTicketActions from "./AdminTicketActions";
import FreelancerTicketActions from "./FreelancerTicketActions";
import PaymentGateway from "./PaymentGateway";
import CSATWidget from "./CSATWidget";
import CustomerResolutionActions from "./CustomerResolutionActions";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { updateTicket } from "../../api/tickets";
import { ChatBubbleIcon, PaperClipIcon } from "./ActionIcons";

const CONVERSATION_COMPOSER_ID = "conversation-composer";

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
    desc: "A verified engineer has been assigned — they haven't started work yet",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    status: "in_progress",
    label: "Engineer Working",
    desc: "Engineer is actively diagnosing and resolving the issue",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
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

// Role-aware description overrides — label stays "Ready to Start" / "Work Started"
// for every role so the badges, timeline, and queues all read the same way.
const ROLE_LABEL_OVERRIDES = {
  assigned: {
    freelancer: { desc: "This ticket is ready for you — click Start Working when you begin" },
    admin:      { desc: "An engineer has been assigned but hasn't started work yet" },
  },
  in_progress: {
    customer:   { desc: "Your engineer is actively resolving the issue — see the conversation below" },
    admin:      { desc: "Engineer is actively working on this issue" },
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

// Short labels for the compact tracker — scoped to this component only,
// doesn't touch Badge.jsx or any other status wording elsewhere.
const COMPACT_LABEL = {
  pending_payment: "Created",
  open:            "Payment",
  assigned:        "Assigned",
  in_progress:     "Working",
  resolved:        "Resolved",
  closed:          "Closed",
};

// Shared ETA calc — counts down to whichever SLA deadline hasn't been met
// yet (first response, then resolution). Used by both the hero header and
// the sidebar's Ticket Progress tracker so the two never disagree.
function useTicketETA(ticket) {
  const isTerminal = ticket?.status === "resolved" || ticket?.status === "closed";
  const etaTarget = !ticket?.first_response_at ? ticket?.first_response_due_at : ticket?.due_at;
  const etaKind = !ticket?.first_response_at ? "First response" : "Resolution";
  const { label, overdue } = useCountdown(!isTerminal ? etaTarget : null);
  return { label, overdue, kind: etaKind, target: etaTarget };
}

// Compact "Amazon order tracking"-style milestone list — no per-step
// descriptions or connector lines, just a marker + short label per stage,
// plus one ETA caption. Nested inside TicketSummarySidebar, so it has no
// card chrome of its own.
function TicketStatusTracker({ status, ticket, role, isPendingPayment = false }) {
  const lifecycle = getLifecycle(role);
  const currentIdx = lifecycle.findIndex((s) => s.status === status);
  const { label: etaLabel, overdue: etaOverdue, kind: etaKind, target: etaTarget } = useTicketETA(ticket);

  return (
    <div>
      {etaLabel && (
        <p className={`text-xs font-medium mb-2.5 ${etaOverdue ? "text-rose-600" : "text-slate-500"}`}
           title={etaTarget ? new Date(etaTarget).toLocaleString("en-IN") : undefined}>
          {etaKind} {etaLabel}
        </p>
      )}

      <ol className="space-y-1.5">
        {lifecycle.map((step, idx) => {
          const done    = idx < currentIdx;
          const current = idx === currentIdx;
          const isLocked = isPendingPayment && idx > 1;

          return (
            <li key={step.status}
                className={`flex items-center gap-2 transition-opacity duration-200 ${isLocked ? "opacity-40" : ""}`}>
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0
                  ${current
                    ? "bg-indigo-600 ring-2 ring-indigo-100"
                    : done
                    ? "bg-emerald-500"
                    : "bg-white border-2 border-slate-200"
                  }`}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </span>
              <span className={`text-xs ${current ? "font-semibold text-indigo-700" : done ? "font-medium text-slate-700" : "text-slate-400"}`}>
                {COMPACT_LABEL[step.status]}
              </span>
              {current && (
                <span className="relative flex h-1.5 w-1.5 shrink-0 ml-auto">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function humanize(str) {
  if (!str) return "";
  return str.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
          {/* Payment successful header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Payment Successful</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Your ticket has been created successfully and is now in our support queue.
              </p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                A Support Engineer will contact you within your selected response window.
              </p>
            </div>
          </div>

          {/* Support Engineer Response — the primary answer to "when will someone contact me?",
              so it's styled to stand out more than the ticket timeline that follows this card. */}
          <div className="rounded-xl p-4 mb-5 border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
            <div className="flex items-start gap-3">
              <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest mb-1">
                  Support Engineer Response
                </p>
                <p className="text-lg font-bold text-slate-900 leading-snug">
                  A Support Engineer will contact you within {slaTime}.
                </p>
              </div>
            </div>
          </div>

          {/* Contact preference summary */}
          <dl className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <dt className="text-xs font-medium text-slate-500 mb-1">Communication Method</dt>
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
              <dt className="text-xs font-medium text-slate-500 mb-1">Preferred Language</dt>
              <dd className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
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

// Small phone/chat icons, reused by both the Ticket Information "Communication"
// field and the phone-reminder note in Quick Actions.
function CommIcon({ method }) {
  if (method === "phone") {
    return (
      <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    );
  }
  if (method === "chat") {
    return (
      <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none"
           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    );
  }
  return null;
}

// ── Right sidebar — "Engineer Command Center": actions surface first,
// informational cards (status, SLA, customer, ticket facts) follow, so
// whoever opens the ticket sees what they can *do* before what they need
// to *read*. Five distinct cards (not one card with dividers) — matches
// how Jira Service Management / Zendesk / Freshservice lay out ticket
// sidebars, and each fact still appears exactly once across the stack.
function TicketSummarySidebar({
  ticket, role, isPendingPayment, onOpenChat, handleUpdate,
  draftMessage, onDraftChange, onFeedRefresh, composerId,
}) {
  const assignedTo = ticket.assigned_to;
  const showEngineer = !!assignedTo?.email && role !== "freelancer";
  const showCustomer = !!ticket.customer && role !== "customer";
  // "support_agent" is the role string TicketDetailPage.jsx's useRoleTicketFetcher
  // assigns to Ops Manager, Support Agent, AND Finance Manager alike (all three
  // collapse to one string at that layer) — AdminTicketActions itself narrows
  // further via useRoles().isTicketManagementStaff so Finance Manager still sees
  // no ticket-management actions despite sharing this string.
  const showQuickActions = role === "customer" || role === "freelancer" || role === "admin" || role === "support_agent";
  // Same condition that used to gate the standalone "Contact Preferences"
  // card: customer only, once an engineer is assigned and past the
  // pending-payment/open stages.
  const showContactInfo = role === "customer" && !!ticket.assigned_to &&
    !["pending_payment", "open"].includes(ticket.status);

  let engineerName, engineerInitials, specialization;
  if (showEngineer) {
    const firstName = (assignedTo.first_name ?? "").trim();
    const lastName  = (assignedTo.last_name  ?? "").trim();
    engineerName = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || assignedTo.email.split("@")[0];
    engineerInitials = firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : engineerName.slice(0, 2).toUpperCase();
    const skills = assignedTo.skills
      ? assignedTo.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    specialization = skills.length > 0
      ? skills.slice(0, 3).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")
      : null;
  }

  const slaTime = SLA_TIME[ticket.severity] ?? SLA_TIME.medium;

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-6">
      {/* CARD 1 — Quick Actions: highest priority, always the first thing visible. */}
      {showQuickActions && (
        <Card title="Quick Actions">
          {role === "customer" && (
            <div className="flex flex-col gap-2">
              <Button className="w-full mb-1" size="lg" onClick={onOpenChat}>
                <ChatBubbleIcon />
                Reply
              </Button>
              <Button className="w-full" variant="secondary" onClick={onOpenChat}>
                <PaperClipIcon />
                Add File
              </Button>
              {showContactInfo && ticket.communication_preference === "phone" && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 mt-1">
                  <CommIcon method="phone" />
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Your engineer will call you</span>
                    {" "}— keep your phone available
                  </p>
                </div>
              )}
            </div>
          )}
          {role === "freelancer" && (
            <FreelancerTicketActions
              ticket={ticket}
              onUpdate={handleUpdate}
              draftMessage={draftMessage}
              onDraftChange={onDraftChange}
              onFeedRefresh={onFeedRefresh}
              composerId={composerId}
            />
          )}
          {(role === "admin" || role === "support_agent") && (
            <AdminTicketActions ticket={ticket} onUpdate={handleUpdate} />
          )}
        </Card>
      )}

      {/* CARD 2 — Current Status: status, priority, assigned engineer, service,
          progress, created — the working state of the ticket at a glance. */}
      <Card title="Current Status">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge label={ticket.status} dot />
          <Badge label={ticket.severity} />
        </div>

        {showEngineer && (
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 text-sm font-bold
                            flex items-center justify-center shrink-0 select-none">
              {engineerInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-bold text-slate-900 leading-tight truncate">{engineerName}</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                                 bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-600 shrink-0">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{assignedTo.email}</p>
              {specialization && (
                <p className="text-xs text-indigo-600 font-medium mt-1">{specialization}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Responds within <span className="font-medium text-slate-700">{slaTime}</span>
              </p>
            </div>
          </div>
        )}

        <TicketStatusTracker
          status={ticket.status}
          ticket={ticket}
          role={role}
          isPendingPayment={isPendingPayment}
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-slate-100">
          <MetaItem label="Service">{humanize(ticket.service_type)}</MetaItem>
          <MetaItem label="Created">
            {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </MetaItem>
        </dl>
      </Card>

      {/* CARD 3 — SLA: response/resolution clocks, unchanged logic. */}
      <Card title="SLA">
        <TicketSLAPanel ticket={ticket} />
      </Card>

      {/* CARD 4 — Customer: essential contact info only. */}
      {showCustomer && (
        <Card title="Customer">
          <p className="text-sm font-semibold text-slate-800">{ticket.customer.name}</p>
          {ticket.customer.company && (
            <p className="text-xs text-slate-500 mt-0.5">{ticket.customer.company}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">{ticket.customer.email}</p>
        </Card>
      )}

      {/* CARD 5 — Ticket Information: remaining metadata, each fact once. */}
      <Card title="Ticket Information">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {showContactInfo && (
            <MetaItem label="Communication">
              <span className="flex items-center gap-1.5">
                <CommIcon method={ticket.communication_preference} />
                {COMM_LABEL[ticket.communication_preference] || "—"}
              </span>
            </MetaItem>
          )}
          {showContactInfo && (
            <MetaItem label="Language">{LANG_LABEL[ticket.preferred_language] || "—"}</MetaItem>
          )}
          {showContactInfo && (
            <MetaItem label="Assigned">
              {ticket.assigned_at
                ? new Date(ticket.assigned_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                : "—"}
            </MetaItem>
          )}
          {ticket.updated_at && (
            <MetaItem label="Updated">
              {new Date(ticket.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </MetaItem>
          )}
          <MetaItem label="Ticket ID">{ticket.ticket_number}</MetaItem>
        </dl>
      </Card>
    </div>
  );
}

// Inline "label / value" pair for the hero header's meta row — same visual
// weight as MetaItem but laid out horizontally, one line, small footprint.
function HeroMeta({ label, children }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{children}</span>
    </div>
  );
}

// Page-level back link — navigation, not ticket content, so it renders
// above the hero card rather than inside its chrome (GitHub Issues / Linear
// convention: the back link sits at the page level, aligned with the
// content container, not nested in the card it's leaving).
function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900
                 transition-colors group"
    >
      <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Back to Tickets
    </button>
  );
}

// ══ Section 1 — Hero Header ══════════════════════════════════════════
// Single card: ticket id/title/description, status/priority/service badges,
// and a compact metadata row (created, resolution remaining). Nothing else
// shares its chrome — everything an engineer needs to orient on the ticket
// in one glance. Priority and Service each appear once, as badges, rather
// than repeated in both a badge row and a label/value row.
function TicketHeroHeader({ ticket }) {
  const { label: etaLabel, overdue: etaOverdue, kind: etaKind } = useTicketETA(ticket);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
        {ticket.ticket_number}
      </span>
      <h1 className="text-4xl font-extrabold text-slate-900 mt-0.5 leading-[1.15] tracking-tight">
        {ticket.title}
      </h1>
      {ticket.description && (
        <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap mt-2.5">
          {ticket.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Badge label={ticket.status} dot />
        <Badge label={ticket.severity} />
        <Badge label={humanize(ticket.service_type)} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 pt-3 border-t border-slate-100">
        <HeroMeta label="Created">
          {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </HeroMeta>
        {etaLabel && (
          <HeroMeta label={etaKind}>
            <span className={etaOverdue ? "text-rose-600" : "text-slate-800"}>{etaLabel}</span>
          </HeroMeta>
        )}
      </div>
    </div>
  );
}

export default function TicketDetail({ ticket, onUpdate, role = "customer" }) {
  const [draftMessage, setDraftMessage] = useState("");
  const handleUpdate = onUpdate ?? (() => {});
  const feed = useConversationFeed(ticket?.id);

  if (!ticket) return null;

  const isPendingPayment = role === "customer" && ticket.status === "pending_payment";

  const focusComposer = () => {
    requestAnimationFrame(() => {
      document.getElementById(CONVERSATION_COMPOSER_ID)?.focus();
      document.getElementById(CONVERSATION_COMPOSER_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="space-y-4">
      {/* Back link sits above the hero card, aligned with the same content
          container — page navigation, not ticket content. */}
      <div className="space-y-2">
        <BackButton />
        {/* ══ Section 1 — Hero Header (see TicketHeroHeader above) ══ */}
        <TicketHeroHeader ticket={ticket} />
      </div>

      {/* ══ Resolution Summary — read-only, only renders once status === "resolved" ══ */}
      <ResolutionSummary ticket={ticket} feedItems={feed.items} role={role} />

      {/* ══ Section 2 — Two-column grid: conversation (left, ~72%) + sidebar (right, ~28%) ══
          .ticket-detail-grid (index.css) stretches both columns to equal
          height by default grid alignment — the sidebar card is h-full so
          it visually fills that stretched cell instead of leaving the
          conversation looking dramatically taller. */}
      <div className="ticket-detail-grid">
        <div className="ticket-grid-conversation space-y-4">
          {/* ══ Contextual action cards — real next-step moments (payment, ══
              resolution decision, CSAT), not decorative. They stack above
              the feed but stay inside the conversation column so the grid
              itself begins right under the header. */}
          {isPendingPayment && (
            <PaymentGateway ticket={ticket} onPaymentSuccess={handleUpdate} />
          )}

          {role === "customer" && ticket.status === "open" && (
            <PostPaymentCard ticket={ticket} onUpdate={handleUpdate} />
          )}

          {role === "customer" && (
            <>
              <CustomerResolutionActions ticket={ticket} onUpdate={handleUpdate} />
              <CSATWidget ticket={ticket} onUpdate={handleUpdate} />
            </>
          )}

          {ticket.remote_session_url && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
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

          <ResolutionPanel
            ticketId={ticket.id}
            feedItems={feed.items}
            onCaptured={feed.refetch}
            role={role}
          />

          <ConversationFeed
            ticketId={ticket.id}
            ticket={ticket}
            items={feed.items}
            loading={feed.loading}
            error={feed.error}
            refetch={feed.refetch}
            draftMessage={draftMessage}
            onDraftChange={setDraftMessage}
            role={role}
            composerId={CONVERSATION_COMPOSER_ID}
          />
        </div>

        <div className="ticket-grid-sidebar">
          <TicketSummarySidebar
            ticket={ticket}
            role={role}
            isPendingPayment={isPendingPayment}
            onOpenChat={focusComposer}
            handleUpdate={handleUpdate}
            draftMessage={draftMessage}
            onDraftChange={setDraftMessage}
            onFeedRefresh={feed.refetch}
            composerId={CONVERSATION_COMPOSER_ID}
          />
        </div>
      </div>
    </div>
  );
}
