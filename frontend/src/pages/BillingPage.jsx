/**
 * BillingPage — customer payment history and billing overview.
 *
 * Shows:
 *  - Summary stats: total paid, pending, failed
 *  - Paginated payment history with status badges
 *  - Invoice download button (placeholder until Phase 5)
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMyPayments } from "../api/payments";
import MainLayout from "../components/layouts/MainLayout";
import { usePageTitle } from "../hooks/usePageTitle";

// ── Status badge ──────────────────────────────────────────────────
const STATUS_STYLES = {
  completed: "bg-emerald-100 text-emerald-700",
  pending:   "bg-amber-100 text-amber-700",
  failed:    "bg-rose-100 text-rose-700",
  refunded:  "bg-violet-100 text-violet-700",
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, colour }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${colour}`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Payment row ───────────────────────────────────────────────────
function PaymentRow({ payment }) {
  const date = new Date(payment.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const typeLabel = payment.payment_type.replace("_", " ");

  return (
    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors">
      {/* Icon */}
      <span className="w-9 h-9 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-base shrink-0">
        💳
      </span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 capitalize">{typeLabel}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {payment.invoice_number && (
            <span className="text-[11px] font-mono text-slate-400">{payment.invoice_number}</span>
          )}
          {payment.ticket_number && (
            <Link
              to={`/tickets/${payment.ticket}`}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline"
            >
              {payment.ticket_number}
            </Link>
          )}
          <span className="text-[11px] text-slate-400">{date}</span>
        </div>
      </div>

      {/* Amount + status */}
      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-semibold text-slate-900">₹{payment.total_amount}</p>
        <StatusBadge status={payment.status} />
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
        <div className="h-2.5 bg-slate-100 rounded w-1/4" />
      </div>
      <div className="h-3 bg-slate-200 rounded w-12" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function BillingPage() {
  usePageTitle("Billing");

  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    listMyPayments()
      .then(({ data }) => setPayments(data.results ?? data))
      .catch(() => setError("Could not load billing history."))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived stats ────────────────────────────────────────────────
  const totalPaid    = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.total_amount, 0);
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const failedCount  = payments.filter((p) => p.status === "failed").length;

  return (
    <MainLayout maxWidth="max-w-3xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500 mt-0.5">Payment history and invoices for your account.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon="✅" label="Total paid"      value={`₹${totalPaid}`}    colour="bg-emerald-50" />
        <StatCard icon="⏳" label="Pending"         value={pendingCount}         colour="bg-amber-50"   />
        <StatCard icon="❌" label="Failed"          value={failedCount}          colour="bg-rose-50"    />
      </div>

      {/* Payment list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Payment history</h2>
        </div>

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

        {!loading && !error && payments.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 px-5">
            <span className="text-3xl select-none" aria-hidden="true">🧾</span>
            <p className="text-sm text-slate-500 font-medium">No payments yet</p>
            <p className="text-xs text-slate-400 text-center">
              Payments will appear here once you raise a support ticket.
            </p>
            <Link
              to="/tickets/new"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600
                         hover:text-indigo-800 hover:underline"
            >
              Open a ticket →
            </Link>
          </div>
        )}

        {!loading && !error && payments.length > 0 && (
          <div className="divide-y divide-slate-50">
            {payments.map((p) => <PaymentRow key={p.id} payment={p} />)}
          </div>
        )}
      </div>

      {/* GST note */}
      {payments.length > 0 && (
        <p className="text-xs text-slate-400 mt-3 text-center">
          All amounts inclusive of 18% GST. Contact{" "}
          <a href="mailto:billing@supportmitra.in" className="text-indigo-500 hover:underline">
            billing@supportmitra.in
          </a>{" "}
          for invoice queries.
        </p>
      )}
    </MainLayout>
  );
}
