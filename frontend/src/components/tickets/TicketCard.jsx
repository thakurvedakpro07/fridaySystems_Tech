import { Link } from "react-router-dom";
import Badge from "../ui/Badge";

function humanize(str) {
  if (!str) return "";
  return str.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PRIORITY_DOT = {
  urgent: "bg-rose-500",
  high:   "bg-orange-400",
  medium: "bg-amber-400",
  low:    "bg-slate-300",
};

export default function TicketCard({ ticket }) {
  const createdAt = new Date(ticket.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const priorityDot = PRIORITY_DOT[ticket.priority];

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="group block bg-white border border-slate-200 rounded-xl p-4
                 hover:border-indigo-300 hover:shadow-card-hover transition-all duration-200
                 hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Ticket number + priority dot */}
          <div className="flex items-center gap-2 mb-1">
            {priorityDot && (
              <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot}`} title={`${ticket.priority} priority`} />
            )}
            <span className="text-xs font-mono text-slate-400 font-medium">{ticket.ticket_number}</span>
          </div>

          {/* Title */}
          <p className="font-semibold text-slate-900 text-sm leading-snug truncate
                        group-hover:text-indigo-700 transition-colors duration-150">
            {ticket.title}
          </p>

          {/* Service type */}
          <p className="text-xs text-slate-500 mt-1">{humanize(ticket.service_type)}</p>

          {/* Assigned to */}
          {ticket.assigned_to && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {ticket.assigned_to.email ?? ticket.assigned_to}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge label={ticket.status} dot />
          {ticket.severity && <Badge label={ticket.severity} />}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          Opened {createdAt}
        </span>
        <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}
