import { Link } from "react-router-dom";

// Vertical activity-log timeline (connecting line + icon-per-entry keyed
// on action-name substring) — extracted from pages/ops/OpsAssignments.jsx's
// page-local HistoryDrawer + ActivityIcon so the Operations Command
// Center's cross-ticket Activity Timeline and the per-ticket Assignment
// History drawer share one implementation instead of two divergent copies.
// `showTicketRef` renders a ticket link per row for the cross-ticket case;
// OpsAssignments.jsx passes false since its drawer header already shows
// the one ticket every row belongs to.

function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function ActivityIcon({ action }) {
  const label = (action ?? "").toLowerCase();
  if (label.includes("escalat")) {
    return (
      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
    );
  }
  if (label.includes("assign") && !label.includes("unassign")) {
    return (
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      </div>
    );
  }
  if (label.includes("unassign") || label.includes("remove")) {
    return (
      <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      </div>
    );
  }
  if (label.includes("status")) {
    return (
      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </div>
  );
}

export default function ActivityTimeline({ entries, loading, showTicketRef = true }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!entries?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-4 w-px bg-slate-100" />
      <div className="space-y-5">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 relative">
            <ActivityIcon action={entry.action} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-slate-800 capitalize">
                {entry.action_display ?? String(entry.action ?? "").replace(/_/g, " ")}
              </p>
              {showTicketRef && entry.ticket_number && (
                <Link
                  to={`/operations/tickets?highlight=${entry.ticket_id}`}
                  className="text-xs font-mono text-indigo-600 hover:text-indigo-800 truncate block"
                >
                  {entry.ticket_number} · {entry.ticket_title}
                </Link>
              )}
              {entry.note && <p className="text-xs text-slate-500 mt-0.5">{entry.note}</p>}
              <p className="text-[11px] text-slate-500 mt-1">
                {fmtDate(entry.created_at)}
                {entry.actor_email && (
                  <span className="ml-2">by <span className="font-medium">{entry.actor_email}</span></span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
