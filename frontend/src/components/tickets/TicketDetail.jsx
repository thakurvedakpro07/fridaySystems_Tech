/**
 * TicketDetail — shows all information about a single ticket.
 */
import Badge from "../ui/Badge";

export default function TicketDetail({ ticket }) {
  if (!ticket) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{ticket.ticket_number}</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{ticket.title}</h1>
        </div>
        <div className="flex gap-2">
          <Badge label={ticket.status} />
          <Badge label={ticket.severity} />
        </div>
      </div>

      {ticket.description && (
        <p className="text-gray-700 text-sm whitespace-pre-wrap">{ticket.description}</p>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-400">Service</dt>
          <dd className="font-medium">{ticket.service_type}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Assigned to</dt>
          <dd className="font-medium">{ticket.assigned_to?.email ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Opened</dt>
          <dd className="font-medium">{new Date(ticket.created_at).toLocaleString("en-IN")}</dd>
        </div>
        {ticket.resolved_at && (
          <div>
            <dt className="text-gray-400">Resolved</dt>
            <dd className="font-medium">{new Date(ticket.resolved_at).toLocaleString("en-IN")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
