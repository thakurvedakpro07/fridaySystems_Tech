/**
 * TicketCard — a summary row in the ticket list.
 */
import { Link } from "react-router-dom";
import Badge from "../ui/Badge";

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
          <p className="text-sm text-gray-500 mt-1">{ticket.service_type}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge label={ticket.status} />
          <Badge label={ticket.severity} />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">Opened {createdAt}</p>
    </Link>
  );
}
