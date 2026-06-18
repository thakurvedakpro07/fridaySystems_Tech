/**
 * BillingPage — customer payment history and billing overview.
 *
 * Shows:
 *  - Summary stats: total paid, pending, failed
 *  - Paginated payment history with status badges
 *  - Invoice download button (placeholder until Phase 5)
 */
// Temporary placeholder contact information. Replace before production launch.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { downloadInvoice, listMyPayments } from "../api/payments";
import MainLayout from "../components/layouts/MainLayout";
import { CONTACT } from "../config/contact";
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
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colour}`}>{icon}</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  );
}

// ── Invoice download helper ────────────────────────────────────────
async function triggerInvoiceDownload(paymentId, invoiceNumber) {
  const { data } = await downloadInvoice(paymentId);
  const url = window.URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice_${invoiceNumber || paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ── Payment row ───────────────────────────────────────────────────
function PaymentRow({ payment }) {
  const [downloading, setDownloading] = useState(false);
  const date = new Date(payment.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const typeLabel = payment.payment_type.replace("_", " ");

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await triggerInvoiceDownload(payment.id, payment.invoice_number);
    } finally {
      setDownloading(false);
    }
  };

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

      {/* Amount + status + download */}
      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-semibold text-slate-900">₹{payment.total_amount}</p>
        <StatusBadge status={payment.status} />
        {payment.status === "completed" && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1 text-[11px] font-medium text-indigo-600
                       hover:text-indigo-800 disabled:opacity-50 transition-colors mt-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {downloading ? "Downloading…" : "PDF Invoice"}
          </button>
        )}
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
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Billing</h1>
        <p className="text-sm text-slate-500 mt-1">Payment history and invoices for your account.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Total Paid"
          value={`₹${totalPaid.toLocaleString("en-IN")}`}
          colour="bg-emerald-50"
        />
        <StatCard
          icon={
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Pending"
          value={pendingCount}
          sub="awaiting confirmation"
          colour="bg-amber-50"
        />
        <StatCard
          icon={
            <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          }
          label="Failed"
          value={failedCount}
          sub="contact support"
          colour="bg-rose-50"
        />
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
          <div className="flex flex-col items-center gap-4 py-14 px-6 text-center">
            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">No payments yet</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs leading-relaxed">
                Payments appear here after you raise a support ticket. GST-compliant PDF invoices are generated automatically.
              </p>
            </div>
            <Link
              to="/tickets/new"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                         px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Open a support ticket
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
          <a href={CONTACT.billingMailto} className="text-indigo-500 hover:underline">
            {CONTACT.billingEmail}
          </a>{" "}
          for invoice queries. All completed payments include a downloadable PDF tax invoice.
        </p>
      )}
    </MainLayout>
  );
}
