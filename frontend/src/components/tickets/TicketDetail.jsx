/**
 * TicketDetail — full view of a single ticket with tabs for
 * comments (the live conversation thread) and activity (the event log).
 *
 * Renders role-specific action panels below the header:
 *   Admin     → AdminTicketActions  (assign, status change, unassign)
 *   Freelancer → FreelancerTicketActions (status updates)
 *   Customer  → CSATWidget on resolved/closed tickets
 *
 * Props:
 *   ticket   — the full ticket object
 *   onUpdate — optional callback to refetch ticket after an action
 *   role     — "admin" | "freelancer" | "customer"  (default: "customer")
 */
import { useState } from "react";
import ActivityTimeline from "./ActivityTimeline";
import CommentSection from "./CommentSection";
import AdminTicketActions from "./AdminTicketActions";
import FreelancerTicketActions from "./FreelancerTicketActions";
import CSATWidget from "./CSATWidget";
import Badge from "../ui/Badge";

const TABS = [
  { id: "comments", label: "Comments" },
  { id: "activity", label: "Activity" },
];

export default function TicketDetail({ ticket, onUpdate, role = "customer" }) {
  const [activeTab, setActiveTab] = useState("comments");
  const handleUpdate = onUpdate ?? (() => {});

  if (!ticket) return null;

  return (
    <div className="space-y-4">
      {/* ── Ticket header ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-mono">{ticket.ticket_number}</p>
            <h1 className="text-xl font-semibold text-gray-900 mt-1 leading-snug">
              {ticket.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            <Badge label={ticket.status} />
            <Badge label={ticket.priority} />
            <Badge label={ticket.severity} />
          </div>
        </div>

        {ticket.description && (
          <p className="text-gray-600 text-sm mt-3 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        )}

        {/* Metadata grid */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-5 text-sm">
          <div>
            <dt className="text-gray-400 text-xs">Service</dt>
            <dd className="font-medium text-gray-800 capitalize">{ticket.service_type}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs">Assigned to</dt>
            <dd className="font-medium text-gray-800">
              {ticket.assigned_to?.email ?? (
                <span className="text-gray-400 font-normal italic">Unassigned</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs">Opened</dt>
            <dd className="font-medium text-gray-800">
              {new Date(ticket.created_at).toLocaleString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </dd>
          </div>
          {ticket.first_response_at && (
            <div>
              <dt className="text-gray-400 text-xs">First response</dt>
              <dd className="font-medium text-gray-800">
                {new Date(ticket.first_response_at).toLocaleString("en-IN", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </dd>
            </div>
          )}
          {ticket.resolved_at && (
            <div>
              <dt className="text-gray-400 text-xs">Resolved</dt>
              <dd className="font-medium text-gray-800">
                {new Date(ticket.resolved_at).toLocaleString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </dd>
            </div>
          )}
          {ticket.due_at && (
            <div>
              <dt className="text-gray-400 text-xs">SLA due</dt>
              <dd className={`font-medium ${
                new Date(ticket.due_at) < new Date() && ticket.status !== "resolved" && ticket.status !== "closed"
                  ? "text-red-600"
                  : "text-gray-800"
              }`}>
                {new Date(ticket.due_at).toLocaleString("en-IN", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </dd>
            </div>
          )}
        </dl>

        {ticket.remote_session_url && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-medium mb-1">Remote session link</p>
            <a
              href={ticket.remote_session_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-700 hover:underline break-all"
            >
              {ticket.remote_session_url}
            </a>
          </div>
        )}
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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Tab headers */}
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                  : "text-gray-500 hover:text-gray-800"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
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
