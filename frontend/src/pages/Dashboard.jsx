import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getAnalytics } from "../api/analytics";
import { getProfile } from "../api/settings";
import AppShell from "../components/layout/AppShell";
import TicketCard from "../components/tickets/TicketCard";
import { SkeletonCard } from "../components/ui/Spinner";
import { useAuthStore } from "../store/authStore";
import { useTickets } from "../hooks/useTickets";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../context/ToastContext";
import { getDisplayName } from "../utils/displayName";
import { CONTACT } from "../config/contact";

const STATUS_OPTIONS = [
  { value: "",                 label: "All statuses" },
  { value: "open",             label: "Open" },
  { value: "assigned",         label: "Assigned" },
  { value: "in_progress",      label: "In Progress" },
  { value: "waiting_customer", label: "Waiting on You" },
  { value: "resolved",         label: "Resolved" },
  { value: "closed",           label: "Closed" },
];

function salutation(name) {
  const h = new Date().getHours();
  const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : base;
}

// ── KPI card ─────────────────────────────────────────────────────
const KPI_STYLES = {
  indigo:  { num: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100" },
  blue:    { num: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100" },
  amber:   { num: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
  emerald: { num: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
};

function KpiCard({ label, value, sub, color = "indigo", loading }) {
  const s = KPI_STYLES[color] ?? KPI_STYLES.indigo;
  return (
    <div
      className={`bg-white border ${s.border} rounded-2xl px-6 py-5
                 hover:-translate-y-0.5 transition-all duration-200 cursor-default`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.07), 0 0 0 1px rgb(0 0 0 / 0.02)" }}
    >
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      {loading ? (
        <div className="h-10 w-16 shimmer rounded-lg mb-1" />
      ) : (
        <p className={`text-4xl font-black ${s.num} leading-none`}>{value ?? "—"}</p>
      )}
      {sub && !loading && (
        <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>
      )}
    </div>
  );
}

// ── Right info panel ──────────────────────────────────────────────
function InfoPanel() {
  const isMobile = useIsMobile();
  const addToast = useToast();
  return (
    <div className="space-y-4">
      {/* System status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Platform Status
        </p>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-slate-900">All systems operational</span>
        </div>
        <div className="space-y-2">
          {[
            ["Ticket routing",        "operational"],
            ["Payment processing",    "operational"],
            ["Email notifications",   "operational"],
          ].map(([label, status]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs font-semibold text-emerald-600 capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Consultation response */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Consultation Response
        </p>
        <div className="space-y-3.5">
          {[
            { label: "Critical",  value: "30 min", pct: 100, color: "bg-rose-500" },
            { label: "High",      value: "1 hr",   pct: 100, color: "bg-amber-500" },
            { label: "Medium",    value: "2 hrs",  pct: 100, color: "bg-indigo-500" },
            { label: "Low",       value: "4 hrs",  pct: 100, color: "bg-slate-400" },
          ].map(({ label, value, pct, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <span className="text-xs font-bold text-slate-700">{value}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-3 leading-snug">
          Priority sets how quickly a Support Agent contacts you — not resolution speed.
        </p>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Quick Actions
        </p>
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
            <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Analytics
          </Link>
        </div>
      </div>

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
          <p className="text-[11px] text-slate-400 pl-[1.625rem]">{CONTACT.businessHours}</p>
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
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
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
function TicketsEmptyState({ hasFilters }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-slate-800 font-semibold text-base mb-2">No tickets match your filters</p>
        <p className="text-slate-400 text-sm max-w-xs">
          Try adjusting your search or selecting a different status.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {/* Illustration */}
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center">
          <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-100 rounded-xl flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      </div>
      <p className="text-slate-900 font-bold text-lg mb-2">No support tickets yet</p>
      <p className="text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
        When you need IT help, create a ticket and a Support Agent will contact you within your chosen response window.
      </p>
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
      <p className="text-xs text-slate-400 mt-4">
        ₹299 consulting fee · Priority consultation response · No resolution fee until your issue is fixed
      </p>
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
  const debounceRef                   = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 400);
  };

  const clearSearch = () => { setSearchInput(""); setSearch(""); };

  const filters = {};
  if (search) filters.search = search;
  if (status) filters.status = status;

  const { tickets, loading, error } = useTickets(filters);

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
  const hasFilters = !!(search || status);

  return (
    <AppShell>
      {/* ── Greeting ───────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
          {salutation(name)}
        </h1>
        <p className="text-base text-slate-500 mt-1.5">
          Here&apos;s your support overview for today.
        </p>
      </div>

      {/* ── Trust bar ──────────────────────────────────────────── */}
      <TrustBar />

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total"       value={stats.total}      sub="all time"           color="indigo"  loading={statsLoading} />
        <KpiCard label="Open"        value={stats.open}       sub="awaiting engineer"  color="blue"    loading={statsLoading} />
        <KpiCard label="In Progress" value={stats.inProgress} sub="being worked on"    color="amber"   loading={statsLoading} />
        <KpiCard label="Resolved"    value={stats.resolved}   sub="successfully fixed" color="emerald" loading={statsLoading} />
      </div>

      {/* ── Getting started — zero-ticket accounts ──────────── */}
      {!statsLoading && stats.total === 0 && <GettingStarted />}

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8 items-start">

        {/* ── Left: ticket list ─────────────────────────────── */}
        <div className="min-w-0">
          {/* Section header + filters */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">My Tickets</h2>
          </div>

          <div className="flex flex-wrap gap-2.5 mb-5">
            <div className="relative flex-1 min-w-[160px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search tickets…"
                value={searchInput}
                onChange={handleSearchChange}
                className={`input-base pl-9 ${searchInput ? "pr-8" : ""}`}
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-base w-auto"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700
                            text-sm rounded-xl px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Failed to load tickets. Please refresh.
            </div>
          )}

          {!loading && !error && tickets.length === 0 && (
            <TicketsEmptyState hasFilters={hasFilters} />
          )}

          {!loading && !error && tickets.length > 0 && (
            <div className="space-y-2.5">
              {tickets.map((ticket, i) => (
                <div
                  key={ticket.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <TicketCard ticket={ticket} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: info panel ─────────────────────────────── */}
        <div className="shrink-0 space-y-4">
          <ProfileCompletion profile={profile} />
          <InfoPanel />
        </div>
      </div>
    </AppShell>
  );
}
