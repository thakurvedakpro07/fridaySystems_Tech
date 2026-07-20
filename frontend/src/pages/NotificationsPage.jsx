import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { usePageTitle } from "../hooks/usePageTitle";
import { useNotifications } from "../hooks/useNotifications";
import { useToast } from "../context/ToastContext";
import { formatAbsoluteTime, formatRelativeTime, groupByDate } from "../utils/time";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { CATEGORY_META, DEFAULT_CATEGORY_META } from "../components/ui/notificationCategoryMeta";
import { BellIcon } from "../components/tickets/ActionIcons";

// Filtered client-side over the already-fetched list — the notifications
// endpoint has no category query param, and the full list is small enough
// (customer-facing, capped by usage) that a server round-trip isn't needed.
const CATEGORY_FILTER_OPTIONS = [
  { value: "",                  label: "All categories" },
  { value: "ticket_assigned",   label: "Ticket assigned" },
  { value: "ticket_resolved",   label: "Ticket resolved" },
  { value: "comment_added",     label: "Comments" },
  { value: "status_changed",    label: "Status changes" },
  { value: "sla_breach",        label: "SLA breaches" },
  { value: "payment_confirmed", label: "Payments" },
];

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-5 py-4 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3.5 bg-slate-200 rounded w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function NotificationRow({ n, onMarkRead, onNavigate }) {
  const meta = CATEGORY_META[n.category] ?? DEFAULT_CATEGORY_META;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(n)}
      onKeyDown={(e) => e.key === "Enter" && onNavigate(n)}
      className={[
        "flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors duration-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400",
        n.is_read ? "hover:bg-slate-50" : "bg-indigo-50/50 hover:bg-indigo-50",
      ].join(" ")}
    >
      <span
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-1 ${meta.colour} ${meta.ring}`}
      >
        <meta.Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${n.is_read ? "text-slate-500" : "text-slate-900 font-medium"}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</p>
        )}
        <p className="text-[11px] text-slate-500 mt-1" title={formatAbsoluteTime(n.created_at)}>
          {formatRelativeTime(n.created_at)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
        {!n.is_read && (
          <>
            <span className="w-2 h-2 rounded-full bg-indigo-500" aria-label="unread" />
            <button
              onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
              title="Mark as read"
              aria-label="Mark as read"
              className="p-1.5 -m-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 leading-none"
            >
              ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  usePageTitle("Notifications");
  const navigate  = useNavigate();
  const toast     = useToast();
  const { unreadCount, notifications, listLoading, listFetched, listError, fetchList, markOne, markAll } =
    useNotifications();
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!listFetched) fetchList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkAll = async () => {
    try {
      await markAll();
      toast("All notifications marked as read", "success");
    } catch {
      toast("Could not update notifications", "error");
    }
  };

  const handleNavigate = (n) => {
    if (!n.is_read) markOne(n.id);
    if (n.ticket) navigate(`/tickets/${n.ticket}`);
  };

  const filtered = useMemo(
    () => (category ? notifications.filter((n) => n.category === category) : notifications),
    [notifications, category],
  );
  const grouped = groupByDate(filtered, (n) => n.created_at);

  return (
    <AppShell maxWidth="max-w-2xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Notifications"
          description={unreadCount > 0 ? (
            <span><span className="text-indigo-600 font-semibold">{unreadCount}</span> unread</span>
          ) : "You're all caught up"}
        />
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600
                       hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100
                       px-3 py-1.5 rounded-lg"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Mark all read
          </button>
        )}
      </div>

      {/* Category filter — client-side, see CATEGORY_FILTER_OPTIONS note above */}
      {notifications.length > 0 && (
        <div className="mb-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="input-base w-auto"
          >
            {CATEGORY_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>

        {(listLoading && !listFetched) && (
          <div className="divide-y divide-slate-50">
            {[1, 2, 3, 4, 5].map((n) => <SkeletonRow key={n} />)}
          </div>
        )}

        {/* Error state — see NotificationBell.jsx for why this branch matters:
            a failed fetch previously rendered as an indistinguishable empty
            inbox with no indication anything had gone wrong. */}
        {!listLoading && listFetched && listError && (
          <div className="p-5">
            <Alert severity="error">
              Couldn't load notifications.{" "}
              <button onClick={fetchList} className="font-semibold underline underline-offset-2">
                Try again
              </button>
            </Alert>
          </div>
        )}

        {!listLoading && listFetched && !listError && filtered.length === 0 && (
          <EmptyState
            icon={<BellIcon className="w-8 h-8 text-slate-500" />}
            title={category ? "No notifications in this category" : "You're all caught up!"}
            description={category
              ? "Try a different category, or clear the filter to see everything."
              : "Notifications appear here when tickets are updated, comments are added, or payments are confirmed."}
          />
        )}

        {!listLoading && !listError && grouped.map(([label, items]) => (
          <div key={label} className="border-b border-slate-100 last:border-0">
            <div className="px-5 py-2 bg-slate-50/80 sticky top-0 z-10 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {label}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onMarkRead={markOne}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-500 text-center mt-4">
          Showing {filtered.length}{category ? ` of ${notifications.length}` : ""} notification{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </AppShell>
  );
}
