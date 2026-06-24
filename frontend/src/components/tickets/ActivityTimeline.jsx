/**
 * ActivityTimeline — chronological event log for a ticket.
 *
 * Improvements over v1:
 *  - Relative timestamps ("3h ago") with absolute time on hover
 *  - Role-aware actor label: "You", "Admin", freelancer email, or "System"
 *  - Stagger-in animation on initial load
 *  - Distinct status-change visuals (before → after pill)
 *  - Better empty and error states
 *  - Accessible landmark structure
 */
import { useEffect, useState } from "react";
import { listActivityLog } from "../../api/tickets";
import { useAuthStore } from "../../store/authStore";
import { formatAbsoluteTime, formatRelativeTime } from "../../utils/time";

// ── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
  created:          { icon: "🎫", bg: "bg-blue-100",    text: "text-blue-700",   ring: "ring-blue-200" },
  status_changed:   { icon: "🔄", bg: "bg-amber-100",   text: "text-amber-700",  ring: "ring-amber-200" },
  severity_changed: { icon: "📊", bg: "bg-rose-100",    text: "text-rose-700",   ring: "ring-rose-200" },
  assigned:         { icon: "👤", bg: "bg-violet-100",  text: "text-violet-700", ring: "ring-violet-200" },
  reassigned:       { icon: "↔️", bg: "bg-violet-100",  text: "text-violet-700", ring: "ring-violet-200" },
  unassigned:       { icon: "👤", bg: "bg-slate-100",   text: "text-slate-500",  ring: "ring-slate-200" },
  comment_added:    { icon: "💬", bg: "bg-slate-100",   text: "text-slate-600",  ring: "ring-slate-200" },
  resolved:         { icon: "✅", bg: "bg-emerald-100", text: "text-emerald-700",ring: "ring-emerald-200" },
  closed:           { icon: "🔒", bg: "bg-slate-100",   text: "text-slate-700",  ring: "ring-slate-200" },
  reopened:         { icon: "🔓", bg: "bg-blue-100",    text: "text-blue-700",   ring: "ring-blue-200" },
  sla_breached:     { icon: "⚠️", bg: "bg-red-100",     text: "text-red-700",    ring: "ring-red-200" },
};
const DEFAULT_META = { icon: "•", bg: "bg-slate-100", text: "text-slate-500", ring: "ring-slate-200" };

// ── Status pill colours ──────────────────────────────────────────────────────
const STATUS_COLOURS = {
  open:             "bg-sky-100 text-sky-700",
  in_progress:      "bg-indigo-100 text-indigo-700",
  waiting_customer: "bg-amber-100 text-amber-700",
  resolved:         "bg-emerald-100 text-emerald-700",
  closed:           "bg-slate-100 text-slate-600",
  assigned:         "bg-violet-100 text-violet-700",
  pending_payment:  "bg-yellow-100 text-yellow-700",
};

function statusPill(value) {
  if (!value) return null;
  const colour = STATUS_COLOURS[value] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${colour}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

// ── Role-aware actor label ───────────────────────────────────────────────────
function actorLabel(actorEmail, currentUser) {
  if (!actorEmail) return <span className="text-slate-400 italic text-xs">system</span>;
  if (actorEmail === currentUser?.email) return <span className="text-indigo-600 text-xs font-medium">you</span>;
  if (currentUser?.role !== "admin" && currentUser?.is_staff) {
    return <span className="text-xs text-slate-500">Admin</span>;
  }
  return <span className="text-xs text-slate-500">{actorEmail}</span>;
}

// ── Single timeline entry ────────────────────────────────────────────────────
function TimelineEntry({ entry, isLast, index, currentUser }) {
  const meta = ACTION_META[entry.action] ?? DEFAULT_META;

  const hasTransition = entry.from_value && entry.to_value;
  const hasToOnly     = !entry.from_value && entry.to_value;

  return (
    <div
      className="flex gap-3 animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0
                      ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}
        >
          {meta.icon}
        </span>
        {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1.5 mb-0" />}
      </div>

      {/* Content */}
      <div className={`pb-5 min-w-0 ${isLast ? "pb-1" : ""}`}>
        {/* Action label + actor */}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-sm font-medium text-slate-800">
            {entry.action_display}
          </span>
          <span className="text-xs text-slate-400">by</span>
          {actorLabel(entry.actor_email, currentUser)}
        </div>

        {/* Status change: before → after pills */}
        {hasTransition && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {statusPill(entry.from_value)}
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5l6 6m0 0l-6 6m6-6H4.5" />
            </svg>
            {statusPill(entry.to_value)}
          </div>
        )}
        {hasToOnly && !hasTransition && (
          <div className="mt-1">{statusPill(entry.to_value)}</div>
        )}

        {/* Note */}
        {entry.note && (
          <p className="text-xs text-slate-500 mt-1 italic bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
            "{entry.note}"
          </p>
        )}

        {/* Timestamp */}
        <p
          className="text-[11px] text-slate-400 mt-1.5 cursor-default"
          title={formatAbsoluteTime(entry.created_at)}
        >
          {formatRelativeTime(entry.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ActivityTimeline({ ticketId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

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

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 mt-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="h-2.5 bg-slate-100 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 mt-1 text-sm text-red-600 bg-red-50
                      border border-red-100 rounded-lg px-4 py-3">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 mt-1">
        <span className="text-2xl select-none" aria-hidden="true">📭</span>
        <p className="text-sm text-slate-400">No activity yet on this ticket.</p>
      </div>
    );
  }

  return (
    <div className="mt-1" role="list" aria-label="Ticket activity">
      {entries.map((entry, i) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          isLast={i === entries.length - 1}
          index={i}
          currentUser={currentUser}
        />
      ))}
    </div>
  );
}
