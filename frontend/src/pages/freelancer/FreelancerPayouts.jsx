/**
 * FreelancerPayouts — an engineer's own payout/earnings history.
 *
 * Modeled on pages/BillingPage.jsx (the customer-side analogue): stat tiles
 * + a Card wrapping a divide-y payout list. Fetches all of "my" payouts in
 * one page (?page_size=100), the same fetch-all-mine idiom EngineerWorkspace
 * already uses for active tickets — revisit with a dedicated summary
 * endpoint if a freelancer ever exceeds 100 payouts.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { freelancerListPayouts } from "../../api/freelancer";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, colour }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colour}`}>{icon}</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}

// ── Payout row ────────────────────────────────────────────────────
function PayoutRow({ payout }) {
  const created = new Date(payout.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const processed = payout.processed_at
    ? new Date(payout.processed_at).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors">
      <span className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {payout.ticket_number && (
            <Link
              to={`/tickets/${payout.ticket}`}
              className="text-sm font-medium text-slate-800 hover:text-indigo-600 hover:underline"
            >
              {payout.ticket_number}
            </Link>
          )}
          {payout.utr_number && (
            <span className="text-[11px] font-mono text-slate-500">UTR {payout.utr_number}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-slate-500">
          <span>Resolution fee ₹{payout.resolution_fee}</span>
          {Number(payout.severity_surcharge) > 0 && (
            <span>+ ₹{payout.severity_surcharge} surcharge</span>
          )}
          <span>Paid {created}</span>
          {processed && <span>· Processed {processed}</span>}
        </div>
      </div>

      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-semibold text-slate-900">₹{payout.engineer_share}</p>
        <Badge domain="payoutStatus" label={payout.status} />
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-4 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="h-3 bg-slate-200 rounded w-12" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function FreelancerPayouts() {
  usePageTitle("Payouts");

  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    freelancerListPayouts({ page_size: 100 })
      .then(({ data }) => setPayouts(data.results ?? data))
      .catch(() => setError("Could not load payout history."))
      .finally(() => setLoading(false));
  }, []);

  const totalEarned = payouts
    .filter((p) => p.status === "processed")
    .reduce((sum, p) => sum + Number(p.engineer_share), 0);
  const totalPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.engineer_share), 0);
  const ticketsPaid = payouts.filter((p) => p.status === "processed").length;

  return (
    <AppShell maxWidth="max-w-3xl">
      <div className="mb-6">
        <PageHeader title="Payouts" description="Your earnings from resolved tickets." />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Total Earned"
          value={`₹${totalEarned.toLocaleString("en-IN")}`}
          sub="processed payouts"
          colour="bg-emerald-50"
        />
        <StatCard
          icon={
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Pending Payout"
          value={`₹${totalPending.toLocaleString("en-IN")}`}
          sub="awaiting transfer"
          colour="bg-amber-50"
        />
        <StatCard
          icon={
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Tickets Paid"
          value={ticketsPaid}
          colour="bg-indigo-50"
        />
      </div>

      <Card header="Payout history" padded={false}>
        {loading && (
          <div className="divide-y divide-slate-50">
            <SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 px-5 py-4 text-sm text-rose-600">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {!loading && !error && payouts.length === 0 && (
          <EmptyState
            icon={
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No payouts yet"
            description="Payouts appear here once a customer pays the resolution fee for a ticket you've resolved."
            action={
              <Link
                to="/freelancer"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                           px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Go to My Assignments
              </Link>
            }
          />
        )}

        {!loading && !error && payouts.length > 0 && (
          <div className="divide-y divide-slate-50">
            {payouts.map((p) => <PayoutRow key={p.id} payout={p} />)}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
