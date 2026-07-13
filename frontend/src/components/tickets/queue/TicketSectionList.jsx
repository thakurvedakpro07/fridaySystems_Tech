import TicketCard from "../TicketCard";
import RowCheckbox from "../../ui/RowCheckbox";

// Shared row renderer for the Engineer Workspace's triage sections
// (Requires Immediate Attention, Today's Work, Waiting on Customer,
// Waiting on Internal Team, Ready to Resolve, Recently Updated) — avoids
// duplicating the checkbox+card row markup six times.
export default function TicketSectionList({
  tickets,
  emptyMessage = "Nothing here right now.",
  selectable = false,
  selectedIds,
  onToggle,
  reasonFor,
}) {
  if (!tickets.length) {
    return <p className="text-sm text-slate-500 py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2.5">
      {tickets.map((t) => (
        <div key={t.id} className="flex items-start gap-2.5">
          {selectable && (
            <div className="pt-4">
              <RowCheckbox
                checked={selectedIds?.has(t.id) ?? false}
                onChange={() => onToggle?.(t.id)}
                ariaLabel={`Select ${t.ticket_number}`}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <TicketCard ticket={t} reasonLabel={reasonFor?.(t)} />
          </div>
        </div>
      ))}
    </div>
  );
}
