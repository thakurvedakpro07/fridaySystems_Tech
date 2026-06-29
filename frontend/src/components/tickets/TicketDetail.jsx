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

function TicketStatusTracker({ status, ticket, role }) {
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
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
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
          <span className="text-[11px] text-slate-400 font-medium">
            Step {currentIdx + 1} of {lifecycle.length}
          </span>
        )}
      </div>

      {/* Vertical timeline */}
      <div className="space-y-0">
        {lifecycle.map((step, idx) => {
          const done    = idx < currentIdx;
          const current = idx === currentIdx;
          const future  = idx > currentIdx;
          const isLast  = idx === lifecycle.length - 1;
          const ts      = timestamps[step.status];

          return (
            <div key={step.status} className="flex gap-3">
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
                    <span className={current ? "text-white" : "text-slate-300"}>
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
                      ${current ? "text-indigo-700" : done ? "text-slate-800" : "text-slate-300"}`}>
                      {step.label}
                    </p>
                    {(current || done) && (
                      <p className={`text-xs mt-0.5 leading-relaxed
                        ${current ? "text-slate-500" : "text-slate-400"}`}>
                        {step.desc}
                      </p>
                    )}
                  </div>
                  {ts && (done || current) && (
                    <span className="text-[10px] text-slate-400 shrink-0 pt-0.5 whitespace-nowrap">
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
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
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
          <p className="text-xs text-slate-400 mt-0.5">{assignedTo.email}</p>
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
      <dt className="text-xs font-medium text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

export default function TicketDetail({ ticket, onUpdate, role = "customer" }) {
  const [activeTab, setActiveTab] = useState("comments");
  const user = useAuthStore((s) => s.user);
  const handleUpdate = onUpdate ?? (() => {});

  if (!ticket) return null;

  return (
    <div className="space-y-4">
      {/* ── Status tracker ────────────────────────────────── */}
      <TicketStatusTracker status={ticket.status} ticket={ticket} role={role} />

      {/* ── Ticket header card ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        {/* Top accent bar */}
        <div className="h-1 bg-brand-gradient" />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono font-medium text-slate-400">{ticket.ticket_number}</span>
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
                <span className="block text-xs text-slate-400 font-normal">{ticket.customer.email}</span>
              </MetaItem>
            )}
            <MetaItem label="Service">
              {humanize(ticket.service_type)}
            </MetaItem>
            <MetaItem label="Assigned to">
              {ticket.assigned_to?.email ?? (
                <span className="text-slate-400 font-normal italic">Unassigned</span>
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
            {ticket.due_at && (
              <div>
                <dt className="text-xs font-medium text-slate-400 mb-0.5">SLA due</dt>
                <dd className={`text-sm font-medium ${
                  new Date(ticket.due_at) < new Date() && !["resolved", "closed"].includes(ticket.status)
                    ? "text-rose-600"
                    : "text-slate-800"
                }`}>
                  {new Date(ticket.due_at).toLocaleString("en-IN", {
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

      {/* ── Payment gateway (customer, pending_payment only) ─ */}
      {role === "customer" && ticket.status === "pending_payment" && (
        <PaymentGateway ticket={ticket} onPaymentSuccess={handleUpdate} />
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
