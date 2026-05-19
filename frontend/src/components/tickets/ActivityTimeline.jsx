/**
 * ActivityTimeline — the chronological event log for a ticket.
 *
 * Shows every status change, assignment, comment, and system event
 * in a vertical timeline. This is the "history" view.
 *
 * Data comes from GET /api/tickets/{id}/activity/
 */
import { useEffect, useState } from "react";
import { listActivityLog } from "../../api/tickets";

const ACTION_ICONS = {
  created:          { icon: "🎫", colour: "bg-blue-100 text-blue-700" },
  status_changed:   { icon: "🔄", colour: "bg-yellow-100 text-yellow-700" },
  assigned:         { icon: "👤", colour: "bg-purple-100 text-purple-700" },
  reassigned:       { icon: "↔️", colour: "bg-purple-100 text-purple-700" },
  unassigned:       { icon: "👤", colour: "bg-gray-100 text-gray-600" },
  comment_added:    { icon: "💬", colour: "bg-gray-100 text-gray-600" },
  resolved:         { icon: "✅", colour: "bg-green-100 text-green-700" },
  closed:           { icon: "🔒", colour: "bg-gray-100 text-gray-700" },
  priority_changed: { icon: "⚡", colour: "bg-orange-100 text-orange-700" },
  severity_changed: { icon: "📊", colour: "bg-red-100 text-red-700" },
  sla_breached:     { icon: "⚠️", colour: "bg-red-100 text-red-700" },
};

function TimelineEntry({ entry, isLast }) {
  const meta = ACTION_ICONS[entry.action] ?? { icon: "•", colour: "bg-gray-100 text-gray-600" };

  const timeLabel = new Date(entry.created_at).toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  // Build a human-readable description of what changed
  let detail = null;
  if (entry.from_value && entry.to_value) {
    detail = (
      <span>
        <span className="text-gray-400 line-through">{entry.from_value.replaceAll("_", " ")}</span>
        {" → "}
        <span className="font-medium text-gray-800">{entry.to_value.replaceAll("_", " ")}</span>
      </span>
    );
  } else if (entry.to_value) {
    detail = <span className="font-medium text-gray-800">{entry.to_value.replaceAll("_", " ")}</span>;
  }

  return (
    <div className="flex gap-3">
      {/* Icon + vertical line */}
      <div className="flex flex-col items-center">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${meta.colour}`}>
          {meta.icon}
        </span>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Content */}
      <div className={`pb-4 ${isLast ? "" : ""}`}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-gray-800">
            {entry.action_display}
          </span>
          {entry.actor_email && (
            <span className="text-xs text-gray-400">by {entry.actor_email}</span>
          )}
          {!entry.actor_email && (
            <span className="text-xs text-gray-400 italic">system</span>
          )}
        </div>

        {detail && <div className="text-sm mt-0.5">{detail}</div>}

        {entry.note && (
          <p className="text-xs text-gray-500 mt-0.5 italic">"{entry.note}"</p>
        )}

        <p className="text-xs text-gray-400 mt-1">{timeLabel}</p>
      </div>
    </div>
  );
}

export default function ActivityTimeline({ ticketId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;

    listActivityLog(ticketId)
      .then(({ data }) => {
        if (!cancelled) setEntries(data.results ?? data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load activity log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticketId]);

  if (loading) return <p className="text-gray-400 text-sm py-4">Loading activity…</p>;
  if (error)   return <p className="text-red-500 text-sm py-4">{error}</p>;

  return (
    <div className="mt-1">
      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm">No activity yet.</p>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={i === entries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
