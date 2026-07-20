/**
 * NotificationBell — header badge + dropdown notification centre.
 *
 * Features:
 *  - Lightweight count polling (30 s) — not the full list
 *  - Full list fetched lazily on first open
 *  - Date-grouped: Today / Yesterday / Earlier
 *  - Relative timestamps ("5m ago") with absolute on hover
 *  - Animated badge (scale-in) and dropdown (slide-up)
 *  - Click notification → navigate to its ticket
 *  - Optimistic mark-as-read (no spinner wait)
 *  - Skeleton loading state
 *  - Rich empty state
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../hooks/useNotifications";
import { formatAbsoluteTime, formatRelativeTime, groupByDate } from "../../utils/time";
import { CATEGORY_META, DEFAULT_CATEGORY_META } from "./notificationCategoryMeta";
import { BellIcon } from "../tickets/ActionIcons";

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 bg-slate-200 rounded w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

// ── Single notification row ──────────────────────────────────────────────────
function NotificationRow({ n, onMarkRead, onNavigate }) {
  const meta = CATEGORY_META[n.category] ?? DEFAULT_CATEGORY_META;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(n)}
      onKeyDown={(e) => e.key === "Enter" && onNavigate(n)}
      className={[
        "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400",
        n.is_read
          ? "hover:bg-slate-50"
          : "bg-indigo-50/50 hover:bg-indigo-50",
      ].join(" ")}
    >
      {/* Category icon */}
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ring-1 ${meta.colour} ${meta.ring}`}
      >
        <meta.Icon className="w-4 h-4" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${n.is_read ? "text-slate-500" : "text-slate-900 font-medium"}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</p>
        )}
        <p
          className="text-[11px] text-slate-500 mt-1"
          title={formatAbsoluteTime(n.created_at)}
        >
          {formatRelativeTime(n.created_at)}
        </p>
      </div>

      {/* Unread dot + mark-read button */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
        {!n.is_read && (
          <>
            <span className="w-2 h-2 rounded-full bg-indigo-500" aria-label="unread" />
            <button
              onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
              title="Mark as read"
              className="p-1.5 -m-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 leading-none"
              aria-label="Mark as read"
            >
              ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function NotificationBell() {
  const { unreadCount, notifications, listLoading, listFetched, listError, fetchList, markOne, markAll } =
    useNotifications();
  const [open, setOpen]           = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [badgeAnimate, setBadgeAnimate] = useState(false);
  const dropdownRef = useRef(null);
  const toast       = useToast();
  const navigate    = useNavigate();

  // Animate badge when count increases
  useEffect(() => {
    if (unreadCount > prevCount) setBadgeAnimate(true);
    setPrevCount(unreadCount);
    const t = setTimeout(() => setBadgeAnimate(false), 400);
    return () => clearTimeout(t);
  }, [unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-fetch full list on first open
  useEffect(() => {
    if (open && !listFetched) fetchList();
  }, [open, listFetched, fetchList]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkOne = async (id) => {
    await markOne(id);
  };

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
    if (n.ticket) {
      setOpen(false);
      navigate(`/tickets/${n.ticket}`);
    }
  };

  // Date-grouped display (max 20 shown)
  const grouped = groupByDate(notifications.slice(0, 20), (n) => n.created_at);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Bell button ─────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Bell SVG */}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className={[
              "absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[9px] font-bold",
              "rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 leading-none",
              "ring-2 ring-white",
              badgeAnimate ? "animate-scale-in" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ────────────────────────────────────── */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-[22rem] bg-white rounded-2xl border border-slate-200
                     shadow-dropdown z-50 overflow-hidden animate-slide-up"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[26rem] overflow-y-auto scrollbar-thin divide-y divide-slate-50">

            {/* Skeleton state */}
            {listLoading && !listFetched && (
              <>
                <SkeletonRow /><SkeletonRow /><SkeletonRow />
              </>
            )}

            {/* Error state — previously a failed fetch rendered nothing at
                all here (listFetched stayed false, so neither the empty-
                state nor the grouped-list branch matched), silently
                showing an empty dropdown with no indication anything had
                gone wrong. */}
            {!listLoading && listFetched && listError && (
              <div className="flex flex-col items-center gap-2 py-10 px-4">
                <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-slate-600 font-medium text-center">Couldn't load notifications</p>
                <button onClick={fetchList} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  Try again
                </button>
              </div>
            )}

            {/* Empty state — genuinely zero notifications, not a failed fetch */}
            {!listLoading && listFetched && !listError && notifications.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 px-4">
                <BellIcon className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-500 font-medium text-center">You're all caught up!</p>
                <p className="text-xs text-slate-500 text-center">New notifications will appear here.</p>
              </div>
            )}

            {/* Grouped notifications */}
            {!listLoading && !listError && grouped.map(([label, items]) => (
              <div key={label}>
                <div className="px-4 py-1.5 bg-slate-50/80 sticky top-0 z-10">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {label}
                  </span>
                </div>
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onMarkRead={handleMarkOne}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Footer — view all link */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            {notifications.length > 20 ? (
              <span className="text-xs text-slate-500">
                Showing 20 of {notifications.length}
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={() => { setOpen(false); navigate("/notifications"); }}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
