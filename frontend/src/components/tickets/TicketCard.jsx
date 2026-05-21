import { Link } from "react-router-dom";
import Badge from "../ui/Badge";

function humanize(str) {
  if (!str) return "";
  return str.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TicketCard({ ticket }) {
  const createdAt = new Date(ticket.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-1">{ticket.ticket_number}</p>
          <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
          <p className="text-sm text-gray-500 mt-1">{humanize(ticket.service_type)}</p>
          {ticket.assigned_to && (
            <p className="text-xs text-gray-400 mt-0.5">
              Assigned: {ticket.assigned_to.email ?? ticket.assigned_to}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[140px]">
          <Badge label={ticket.status} />
          <Badge label={ticket.severity} />
          {ticket.priority && <Badge label={ticket.priority} />}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">Opened {createdAt}</p>
    </Link>
  );
}
