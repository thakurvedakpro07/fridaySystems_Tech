import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getAnalytics } from "../api/analytics";
import { getProfile } from "../api/settings";
import AppShell from "../components/layout/AppShell";
import TicketCard from "../components/tickets/TicketCard";
import TicketSectionList from "../components/tickets/queue/TicketSectionList";
import { SkeletonCard } from "../components/ui/Spinner";
import Alert from "../components/ui/Alert";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import KpiRow from "../components/dashboard/KpiRow";
import FilterBar from "../components/filters/FilterBar";
import QuickViews from "../components/filters/QuickViews";
import { useAuthStore } from "../store/authStore";
import { useTickets } from "../hooks/useTickets";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSavedFilters } from "../hooks/useSavedFilters";
import { useToast } from "../context/ToastContext";
import { getDisplayName } from "../utils/displayName";
import { bucketCustomerTickets } from "../utils/customerTicketPriority";
import { CONTACT } from "../config/contact";

const STATUS_OPTIONS = [
  { value: "",                 label: "All statuses" },
  { value: "open",             label: "Open" },
  { value: "assigned",         label: "Ready to Start" },
  { value: "in_progress",      label: "Work Started" },
  { value: "resolved",         label: "Resolved" },
  { value: "closed",           label: "Closed" },
];

// "newest"/"oldest" map straight to the backend's already-supported
// `ordering` param (TicketListCreateView allows created_at/-created_at —
// zero backend changes needed). The backend's severity ordering is a plain
// alphabetical `.order_by("severity")`, which does NOT produce a meaningful
// critical→low order, so priority sort is done client-side against a real
// severity rank instead of relying on that param.
const SORT_OPTIONS = [
  { value: "newest",        label: "Sort: Newest first" },
  { value: "oldest",        label: "Sort: Oldest first" },
  { value: "severity_desc", label: "Sort: Priority high→low" },
  { value: "severity_asc",  label: "Sort: Priority low→high" },
];
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

// Fetches every non-closed ticket in one page so the triage sections below
// can bucket/sort client-side — same "fetch-all-once" strategy as the
// Engineer Workspace's freelancerListActiveTickets(). Module-level constant
// so useTickets's JSON.stringify(filters) dependency sees a stable value.
const ACTIVE_TICKETS_PARAMS = { exclude_status: "closed", page_size: 100 };

const TRIAGE_SECTION_DEFS = [
  {
    key: "needsYourAction",
    header: "Needs Your Attention",
    description: "Payment or resolution confirmation only you can complete.",
    emptyMessage: "Nothing needs your action right now.",
  },
  {
    key: "overdue",
    header: "Overdue",
    description: "Past the promised response or resolution window.",
    emptyMessage: "No overdue tickets.",
  },
  {
    key: "waitingOnYou",
    header: "Waiting On You",
    description: "The engineer replied — your turn to respond.",
    emptyMessage: "Nothing waiting on your reply.",
  },
  {
    key: "withEngineer",
    header: "With Engineer",
    description: "Your support engineer is working on these.",
    emptyMessage: "Nothing currently with an engineer.",
  },
  {
    key: "recentlyUpdated",
    header: "Recently Updated",
    description: "Freshest activity across your tickets.",
    emptyMessage: "No recent activity.",
  },
];

const TRIAGE_REASON_BY_SECTION = {
  needsYourAction: (t) => (t.status === "pending_payment" ? "Payment pending" : "Confirm & rate"),
  overdue: () => "SLA overdue",
  waitingOnYou: () => "Awaiting your reply",
};

function salutation(name) {
  const h = new Date().getHours();
  const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : base;
}

// ── Recent Tickets widget ────────────────────────────────────────
// Previously windowed to "created in the last 24h" (RecentActivity), which
// meant the card simply didn't render most of the time for any established
// account — the customer ticket-list serializer has no `updated_at`, so
// this still can't reflect status changes, but showing the N most-recently
// *created* tickets regardless of age makes the widget actually useful on
// every visit instead of only the day a ticket happens to be opened.
function RecentTickets({ tickets }) {
  const recent = useMemo(() => (
    [...tickets]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
  ), [tickets]);

  if (recent.length === 0) return null;

  return (
    <Card title="Recent Tickets" className="mb-6">
      <div className="space-y-1">
        {recent.map((t) => (
          <Link
            key={t.id}
            to={`/tickets/${t.id}`}
            className="flex items-center gap-3 py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span className="font-mono text-xs text-slate-500 shrink-0">{t.ticket_number}</span>
            <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{t.title}</span>
            <Badge label={t.status} domain="ticketStatus" dot />
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── Right info panel ──────────────────────────────────────────────
function InfoPanel() {
  const isMobile = useIsMobile();
  const addToast = useToast();
  return (
    <div className="space-y-4">
      {/* Consultation response — static SLA reference, not a progress meter:
          every row previously rendered a "progress" bar hardcoded to 100%
          regardless of any real data, which read as broken/confusing on
          close inspection. Reuses Badge's severity domain (the single
          source of truth for severity colors) instead of a bespoke bar. */}
      <Card title="Consultation Response">
        <dl className="space-y-2.5">
          {[
            { severity: "critical", value: "30 min" },
            { severity: "high",     value: "1 hr" },
            { severity: "medium",   value: "2 hrs" },
            { severity: "low",      value: "4 hrs" },
          ].map(({ severity, value }) => (
            <div key={severity} className="flex items-center justify-between">
              <Badge label={severity} domain="severity" />
              <span className="text-xs font-bold text-slate-700">{value}</span>
            </div>
          ))}
        </dl>
        <p className="text-[10px] text-slate-500 mt-3 leading-snug">
          Priority sets how quickly a Support Agent contacts you — not resolution speed.
        </p>
      </Card>

      {/* Quick actions */}
      <Card title="Quick Actions">
        <div className="space-y-2">
          <Link
            to="/tickets/new"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-600 text-white
                       text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New Ticket
          </Link>
          <Link
            to="/billing"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700
                       text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            View Billing
          </Link>
          <Link
            to="/analytics"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700
                       text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Analytics
          </Link>
        </div>
      </Card>

      {/* Support contact */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-3">
          Need Help?
        </p>
        <div className="space-y-2.5">
          <a
            href={CONTACT.supportMailto}
            className="flex items-center gap-2.5 text-xs font-medium text-slate-700
                       hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            {CONTACT.supportEmail}
          </a>
          {isMobile ? (
            <a
              href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
              aria-label={`Call support: ${CONTACT.tollFree}`}
              className="flex items-center gap-2.5 text-xs font-medium text-slate-700
                         hover:text-indigo-600 transition-colors focus:outline-none
                         focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
            >
              <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {CONTACT.tollFree}
            </a>
          ) : (
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <div>
                <span className="text-xs font-medium text-slate-700">{CONTACT.tollFree}</span>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(CONTACT.tollFree);
                      addToast("Phone number copied.", "success");
                    } catch {
                      addToast("Could not copy — please dial manually.", "warning");
                    }
                  }}
                  aria-label="Copy phone number to clipboard"
                  className="ml-2 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800
                             underline-offset-2 hover:underline transition-colors
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
                >
                  Copy Number
                </button>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-500 pl-[1.625rem]">{CONTACT.businessHours}</p>
        </div>
      </div>
    </div>
  );
}

// ── Trust bar ─────────────────────────────────────────────────────
function TrustBar() {
  const items = [
    { icon: (
        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ), label: "Verified IT Specialists" },
    { icon: (
        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ), label: "Secure Payment Processing" },
    { icon: (
        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ), label: "Priority Consultation" },
    { icon: (
        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      ), label: "Real-Time Ticket Tracking" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-7 py-3 px-4
                    bg-white border border-slate-100 rounded-2xl"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
      {items.map(({ icon, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Profile completion ─────────────────────────────────────────────
function ProfileCompletion({ profile }) {
  if (!profile) return null;

  const fields = [
    { key: "first_name", label: "First name",    done: !!profile.first_name },
    { key: "last_name",  label: "Last name",     done: !!profile.last_name  },
    { key: "company",    label: "Company",       done: !!profile.company    },
    { key: "phone",      label: "Phone number",  done: !!profile.phone      },
    { key: "gstin",      label: "GSTIN",         done: !!profile.gstin      },
  ];

  const done = fields.filter((f) => f.done).length;
  const pct  = Math.round((done / fields.length) * 100);
  if (pct === 100) return null;

  const missing = fields.filter((f) => !f.done);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Profile Completion
        </p>
        <span className="text-sm font-black text-indigo-600">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mb-2.5 leading-relaxed">
        Complete your profile for accurate invoicing.
      </p>
      <div className="space-y-1.5">
        {missing.slice(0, 3).map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-xs text-slate-500">{f.label} missing</span>
          </div>
        ))}
      </div>
      <Link
        to="/settings"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold
                   text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        Complete profile
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}

// ── Getting Started (zero state) ─────────────────────────────────
function GettingStarted() {
  return (
    <div
      className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600
                 rounded-2xl p-7 mb-7 text-white"
      style={{ boxShadow: "0 4px 24px -4px rgb(79 70 229 / 0.4)" }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-16 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-2">
            Quick start
          </p>
          <h3 className="text-xl font-bold mb-2 leading-snug">
            Ready to resolve your first IT issue?
          </h3>
          <p className="text-sm text-indigo-200 leading-relaxed max-w-md">
            Describe your problem and a Support Agent contacts you within your chosen response window.
            Pay ₹299 consulting fee upfront — refunded if consultation doesn't begin within 4 hours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link
            to="/tickets/new"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 text-sm font-bold
                       px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Ticket
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/80
                       border border-white/25 hover:bg-white/10 px-5 py-2.5 rounded-xl transition-colors"
          >
            Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Rich empty state ──────────────────────────────────────────────
// Consolidated onto the shared EmptyState primitive (previously hand-rolled
// here, duplicating its wrapper/title/description structure). The zero-
// ticket illustration keeps its distinctive indigo icon-box + emerald
// "plus" badge overlay via EmptyState's iconBoxClassName escape hatch —
// visually unchanged, just no longer duplicating shared chrome.
function TicketsEmptyState({ hasFilters }) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        }
        title="No tickets match your filters"
        description="Try adjusting your search or selecting a different status."
      />
    );
  }

  return (
    <EmptyState
      iconBoxClassName="relative w-20 h-20 bg-indigo-50 rounded-3xl mb-6"
      icon={
        <>
          <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
          </svg>
          <span className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
        </>
      }
      title="No support tickets yet"
      description="When you need IT help, create a ticket and a Support Agent will contact you within your chosen response window."
      action={
        <>
          <Link
            to="/tickets/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                       px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Open your first ticket
          </Link>
          <p className="text-xs text-slate-500 mt-4">
            ₹299 consulting fee · Priority consultation response · No resolution fee until your issue is fixed
          </p>
        </>
      }
    />
  );
}

// ── Ticket triage sections — Needs Your Attention / Overdue / Waiting On
// You / With Engineer / Recently Updated, from the customer's point of view.
// Mirrors the Engineer Workspace's Card+TicketSectionList triage layout
// (see pages/freelancer/EngineerWorkspace.jsx) — same components, different
// bucketing (utils/customerTicketPriority.js).
function CustomerTicketSections({ tickets }) {
  const buckets = useMemo(() => bucketCustomerTickets(tickets), [tickets]);

  return (
    <div className="space-y-6">
      {TRIAGE_SECTION_DEFS.map((section) => {
        const sectionTickets = buckets[section.key];
        if (section.key === "recentlyUpdated" && sectionTickets.length === 0) return null;
        return (
          <Card key={section.key} header={section.header} description={section.description}>
            <TicketSectionList
              tickets={sectionTickets}
              emptyMessage={section.emptyMessage}
              reasonFor={TRIAGE_REASON_BY_SECTION[section.key]}
            />
          </Card>
        );
      })}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const STAFF_ROLES = ["admin", "operations_manager", "finance_manager", "support_agent"];
  if (STAFF_ROLES.includes(user?.role)) return <Navigate to="/operations" replace />;
  if (user?.role === "freelancer") return <Navigate to="/freelancer" replace />;
  return <CustomerDashboard />;
}

// ── Customer Dashboard ────────────────────────────────────────────
function CustomerDashboard() {
  usePageTitle("Dashboard");
  const user    = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const addToast = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [status, setStatus]           = useState("");
  const [sort, setSort]               = useState("newest");
  const debounceRef                   = useRef(null);

  const { views: savedViews, saveView, removeView } = useSavedFilters();
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 400);
  };

  const clearFilters = () => {
    setSearchInput(""); setSearch(""); setStatus(""); setSort("newest");
  };

  const applyFilters = (f) => {
    setSearchInput(f.search ?? ""); setSearch(f.search ?? "");
    setStatus(f.status ?? ""); setSort(f.sort ?? "newest");
  };

  const activeSavedKey = savedViews.find((v) =>
    (v.filters.search ?? "") === search &&
    (v.filters.status ?? "") === status &&
    (v.filters.sort ?? "newest") === sort
  )?.key;

  const handleSaveFilter = () => {
    saveView(saveFilterName, { search, status, sort });
    setSaveFilterName("");
    setSaveFilterOpen(false);
    addToast("Filter saved.", "success");
  };

  // Only "newest"/"oldest" map to the backend's supported `ordering` param —
  // priority sort is re-applied client-side below (see SORT_OPTIONS note).
  const filters = {};
  if (search) filters.search = search;
  if (status) filters.status = status;
  if (sort === "oldest") filters.ordering = "created_at";

  const { tickets: fetchedTickets, loading, error } = useTickets(filters);
  const tickets = useMemo(() => {
    if (sort === "severity_desc") {
      return [...fetchedTickets].sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0));
    }
    if (sort === "severity_asc") {
      return [...fetchedTickets].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 0) - (SEVERITY_RANK[b.severity] ?? 0));
    }
    return fetchedTickets;
  }, [fetchedTickets, sort]);

  // Unfiltered triage view: all active (non-closed) tickets in one page,
  // bucketed/sorted client-side — kept separate from `tickets` above so
  // RecentTickets's data source/trigger conditions are untouched.
  const { tickets: activeTickets, loading: activeLoading, error: activeError } =
    useTickets(ACTIVE_TICKETS_PARAMS);

  const [stats, setStats]               = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [profile, setProfile]           = useState(null);

  useEffect(() => {
    getAnalytics()
      .then(({ data }) => setStats({
        total:      data.total,
        open:       data.open,
        inProgress: data.in_progress,
        resolved:   data.resolved,
      }))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    getProfile().then(({ data }) => setProfile(data)).catch(() => {});
  }, []);

  const name = getDisplayName(user);
  const hasFilters = !!(search || status || sort !== "newest");

  return (
    <AppShell>
      {/* ── Greeting ───────────────────────────────────────────── */}
      <div className="mb-6">
        <PageHeader title={salutation(name)} description="Here's your support overview for today." />
      </div>

      {/* ── Trust bar ──────────────────────────────────────────── */}
      <TrustBar />

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <KpiRow
        className="mb-8"
        items={[
          { label: "Total",        value: stats.total,      sub: "all time",           color: "indigo",  loading: statsLoading },
          { label: "Open",         value: stats.open,       sub: "awaiting engineer",  color: "blue",    loading: statsLoading },
          { label: "Work Started", value: stats.inProgress, sub: "being worked on",    color: "amber",   loading: statsLoading },
          { label: "Resolved",     value: stats.resolved,   sub: "successfully fixed", color: "emerald", loading: statsLoading },
        ]}
      />

      {/* ── Getting started — zero-ticket accounts ──────────── */}
      {!statsLoading && stats.total === 0 && <GettingStarted />}

      {/* ── Recent tickets — unfiltered view only ─────────────── */}
      {!hasFilters && !loading && !error && <RecentTickets tickets={tickets} />}

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8 items-start">

        {/* ── Left: ticket list ─────────────────────────────── */}
        <div className="min-w-0">
          {/* Section header + filters */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section-title">My Tickets</h2>
          </div>

          <FilterBar
            search={searchInput}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search tickets…"
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_OPTIONS}
            extraFilters={[
              { key: "sort", value: sort, onChange: setSort, options: SORT_OPTIONS, ariaLabel: "Sort tickets" },
            ]}
            onClear={clearFilters}
          />

          {/* Saved filters — user-defined, persisted per-browser (see
              hooks/useSavedFilters.js). "Save this filter" only shows once
              there's something meaningful to save. */}
          {(savedViews.length > 0 || hasFilters) && (
            <div className="flex flex-wrap items-center gap-2.5 mt-3 mb-1">
              {savedViews.length > 0 && (
                <QuickViews
                  views={savedViews}
                  activeKey={activeSavedKey}
                  onSelect={(v) => applyFilters(v.filters)}
                  onRemove={(v) => removeView(v.key)}
                />
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => setSaveFilterOpen(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  + Save this filter
                </button>
              )}
            </div>
          )}

          <div className="mb-5" />

          {/* Content */}
          {hasFilters ? (
            <>
              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                </div>
              )}
              {error && <Alert severity="error">Failed to load tickets. Please refresh.</Alert>}
              {!loading && !error && tickets.length === 0 && (
                <TicketsEmptyState hasFilters={hasFilters} />
              )}
              {!loading && !error && tickets.length > 0 && (
                <div className="space-y-2.5">
                  {tickets.map((ticket, i) => (
                    <div key={ticket.id} className="animate-fade-in" style={{ animationDelay: `${i * 35}ms` }}>
                      <TicketCard ticket={ticket} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {activeLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                </div>
              )}
              {activeError && <Alert severity="error">Failed to load tickets. Please refresh.</Alert>}
              {!activeLoading && !activeError && activeTickets.length === 0 && (
                <TicketsEmptyState hasFilters={false} />
              )}
              {!activeLoading && !activeError && activeTickets.length > 0 && (
                <CustomerTicketSections tickets={activeTickets} />
              )}
            </>
          )}
        </div>

        {/* ── Right: info panel ─────────────────────────────── */}
        <div className="shrink-0 space-y-4">
          <ProfileCompletion profile={profile} />
          <InfoPanel />
        </div>
      </div>

      <Modal
        isOpen={saveFilterOpen}
        onClose={() => setSaveFilterOpen(false)}
        title="Save this filter"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setSaveFilterOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>Save</Button>
          </div>
        }
      >
        <label htmlFor="save-filter-name" className="block text-sm font-medium text-slate-700 mb-1.5">
          Name
        </label>
        <Input
          id="save-filter-name"
          value={saveFilterName}
          onChange={(e) => setSaveFilterName(e.target.value)}
          placeholder="e.g. Overdue critical tickets"
          className="w-full"
          autoFocus
        />
      </Modal>
    </AppShell>
  );
}
