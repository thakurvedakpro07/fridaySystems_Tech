import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import ActivityTimeline from "./ActivityTimeline";
import AttachmentSection from "./AttachmentSection";
import CommentSection from "./CommentSection";
import AdminTicketActions from "./AdminTicketActions";
import FreelancerTicketActions from "./FreelancerTicketActions";
import PaymentGateway from "./PaymentGateway";
import CSATWidget from "./CSATWidget";
import Badge from "../ui/Badge";

// ── Ticket Status Tracker ─────────────────────────────────────────
const LIFECYCLE = [
  { status: "pending_payment",  label: "Payment",    short: "Pay"       },
  { status: "open",             label: "Queued",     short: "Queue"     },
  { status: "assigned",         label: "Assigned",   short: "Assigned"  },
  { status: "in_progress",      label: "In Progress",short: "Progress"  },
  { status: "waiting_customer", label: "Your Action",short: "Action"    },
  { status: "resolved",         label: "Resolved",   short: "Resolved"  },
  { status: "closed",           label: "Closed",     short: "Closed"    },
];

function TicketStatusTracker({ status }) {
  const currentIdx = LIFECYCLE.findIndex((s) => s.status === status);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-0"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Ticket Progress
      </p>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-3.5 left-3.5 right-3.5 h-px bg-slate-200" aria-hidden="true" />
        <div
          className="absolute top-3.5 left-3.5 h-px bg-indigo-400 transition-all duration-500"
          style={{
            width: currentIdx <= 0
              ? "0"
              : `calc(${(currentIdx / (LIFECYCLE.length - 1)) * 100}% - 7px)`,
          }}
          aria-hidden="true"
        />
        {/* Steps */}
        <div className="relative flex justify-between">
          {LIFECYCLE.map((step, idx) => {
            const done    = idx < currentIdx;
            const current = idx === currentIdx;
            return (
              <div key={step.status} className="flex flex-col items-center gap-1.5 flex-1 first:items-start last:items-end">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                    ${current
                      ? "bg-indigo-600 shadow-sm shadow-indigo-200 ring-2 ring-indigo-100"
                      : done
                      ? "bg-indigo-500"
                      : "bg-white border-2 border-slate-200"
                    }`}
                >
                  {done ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : current ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : (
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight max-w-[48px]
                  ${current ? "text-indigo-600" : done ? "text-slate-500" : "text-slate-300"}`}>
                  {step.short}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Current status label */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          {LIFECYCLE[currentIdx]?.label ?? status}
        </span>
        {currentIdx >= 0 && currentIdx < LIFECYCLE.length - 1 && (
          <span className="text-[11px] text-slate-400">
            Step {currentIdx + 1} of {LIFECYCLE.length}
          </span>
        )}
        {status === "resolved" || status === "closed" ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Complete
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Engineer Trust Card ───────────────────────────────────────────
function StarRating({ rating }) {
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= full ? "text-amber-400" : "text-slate-200"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ))}
      <span className="text-xs font-semibold text-slate-600 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

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

  // Placeholder data for trust signals — replace with real API data when available
  const TRUST = {
    role:           "IT Support Engineer",
    specialization: "Systems & Infrastructure",
    yearsExp:       5,
    ticketsSolved:  142,
    rating:         4.8,
    responseTime:   "< 30 min",
    status:         "online",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Your Assigned Engineer
      </p>

      <div className="flex items-start gap-4">
        {/* Avatar + online badge */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 text-sm font-bold
                          flex items-center justify-center select-none">
            {initials}
          </div>
          {TRUST.status === "online" && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white
                             rounded-full" title="Online" />
          )}
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
          <p className="text-xs text-slate-500 mt-0.5">{TRUST.role}</p>
          <div className="mt-1.5">
            <StarRating rating={TRUST.rating} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
        <div className="text-center">
          <p className="text-lg font-black text-slate-900">{TRUST.yearsExp}+</p>
          <p className="text-[10px] text-slate-400 font-medium leading-tight">yrs experience</p>
        </div>
        <div className="text-center border-x border-slate-100">
          <p className="text-lg font-black text-slate-900">{TRUST.ticketsSolved}</p>
          <p className="text-[10px] text-slate-400 font-medium leading-tight">tickets solved</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-slate-900">{TRUST.responseTime}</p>
          <p className="text-[10px] text-slate-400 font-medium leading-tight">avg response</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <p className="text-xs text-slate-500">
          <span className="text-emerald-600 font-semibold">Online now</span>
          {" · "}{TRUST.specialization}
        </p>
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
      <TicketStatusTracker status={ticket.status} />

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
              {ticket.priority && <Badge label={ticket.priority} />}
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
        <CSATWidget ticket={ticket} onUpdate={handleUpdate} />
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
