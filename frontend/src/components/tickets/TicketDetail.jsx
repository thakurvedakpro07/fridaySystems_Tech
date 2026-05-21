import { useState } from "react";
import ActivityTimeline from "./ActivityTimeline";
import CommentSection from "./CommentSection";
import AdminTicketActions from "./AdminTicketActions";
import FreelancerTicketActions from "./FreelancerTicketActions";
import CSATWidget from "./CSATWidget";
import Badge from "../ui/Badge";

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
  const handleUpdate = onUpdate ?? (() => {});

  if (!ticket) return null;

  return (
    <div className="space-y-4">
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
          {activeTab === "activity" && (
            <ActivityTimeline ticketId={ticket.id} />
          )}
        </div>
      </div>
    </div>
  );
}
