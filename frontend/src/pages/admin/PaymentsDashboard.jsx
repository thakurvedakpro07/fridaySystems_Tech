/**
 * PaymentsDashboard — admin payment controls.
 *
 * Features:
 *  - Revenue summary: total collected, pending, failed
 *  - Filterable payment list (by status)
 *  - "Confirm" button for pending payments (manual override)
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminConfirmPayment, downloadInvoice, listAdminPayments } from "../../api/payments";
import MainLayout from "../../components/layouts/MainLayout";
import { useToast } from "../../context/ToastContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";

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
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Filter tab ────────────────────────────────────────────────────
const FILTER_TABS = [
  { label: "All",       value: "" },
  { label: "Pending",   value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Failed",    value: "failed" },
];

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
function PaymentRow({ payment, onConfirm, confirming }) {
  const [downloading, setDownloading] = useState(false);
  const date = new Date(payment.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_auto] items-center
                    gap-x-4 gap-y-1 px-5 py-4 hover:bg-slate-50/60 transition-colors">
      {/* Customer + invoice */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{payment.customer_email}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {payment.invoice_number && (
            <span className="text-[11px] font-mono text-slate-500">{payment.invoice_number}</span>
          )}
          {payment.ticket_number && (
            <Link
              to={`/tickets/${payment.ticket}`}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline"
            >
              {payment.ticket_number}
            </Link>
          )}
          <span className="text-[11px] text-slate-500">{date}</span>
        </div>
      </div>

      {/* Amount — hidden on xs */}
      <p className="hidden sm:block text-sm font-semibold text-slate-900 text-right">
        ₹{payment.total_amount}
      </p>

      {/* Status — hidden on xs */}
      <div className="hidden sm:flex justify-end">
        <Badge domain="paymentStatus" label={payment.status} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        {/* Mobile: show status + amount inline */}
        <div className="sm:hidden text-right">
          <p className="text-sm font-semibold text-slate-900">₹{payment.total_amount}</p>
          <Badge domain="paymentStatus" label={payment.status} />
        </div>
        {payment.status === "completed" && (
          <button
            onClick={async () => {
              setDownloading(true);
              try { await triggerInvoiceDownload(payment.id, payment.invoice_number); }
              finally { setDownloading(false); }
            }}
            disabled={downloading}
            title="Download PDF Invoice"
            className="text-xs font-medium text-indigo-600 border border-indigo-200
                       hover:bg-indigo-50 disabled:opacity-50 px-2.5 py-1 rounded-lg
                       transition-colors shrink-0 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {downloading ? "…" : "PDF"}
          </button>
        )}
        {payment.status === "pending" && (
          <button
            onClick={() => onConfirm(payment.id)}
            disabled={confirming === payment.id}
            className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700
                       disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors shrink-0"
          >
            {confirming === payment.id ? "Confirming…" : "Confirm"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-2.5 bg-slate-100 rounded w-1/4" />
      </div>
      <div className="h-3 bg-slate-200 rounded w-12" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function PaymentsDashboard() {
  usePageTitle("Payments");

  const toast = useToast();
  const [payments,   setPayments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [statusTab,  setStatusTab]  = useState("");
  const [confirming, setConfirming] = useState(null);

  const fetchPayments = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = statusTab ? { status: statusTab } : {};
    listAdminPayments(params)
      .then(({ data }) => setPayments(data.results ?? data))
      .catch(() => setError("Could not load payments."))
      .finally(() => setLoading(false));
  }, [statusTab]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleConfirm = async (paymentId) => {
    setConfirming(paymentId);
    try {
      const { data: updated } = await adminConfirmPayment(paymentId);
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)));
      toast("Payment confirmed and ticket opened.", "success");
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not confirm payment.", "error");
    } finally {
      setConfirming(null);
    }
  };

  // ── Derived stats from full list ─────────────────────────────────
  const allPayments = payments;
  const totalCollected = allPayments.filter((p) => p.status === "completed")
    .reduce((s, p) => s + p.total_amount, 0);
  const pendingCount = allPayments.filter((p) => p.status === "pending").length;
  const failedCount  = allPayments.filter((p) => p.status === "failed").length;

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <PageHeader title="Payments" description="All customer payments and manual controls." />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon="💰" label="Total collected" value={`₹${totalCollected}`}  colour="bg-emerald-50" />
        <StatCard icon="⏳" label="Pending"          value={pendingCount}           colour="bg-amber-50"   />
        <StatCard icon="❌" label="Failed"           value={failedCount}            colour="bg-rose-50"    />
      </div>

      {/* Payment list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>

        {/* Header + filter tabs */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">All payments</h2>
          <div className="flex gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
                  ${statusTab === tab.value
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="divide-y divide-slate-50">
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
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
            <p className="text-sm text-slate-500 font-medium">No payments found</p>
            <p className="text-xs text-slate-500 text-center">
              {statusTab ? `No ${statusTab} payments at this time.` : "Payments will appear here once customers submit tickets."}
            </p>
          </div>
        )}

        {!loading && !error && payments.length > 0 && (
          <div className="divide-y divide-slate-50">
            {payments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onConfirm={handleConfirm}
                confirming={confirming}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-3 text-center">
        Use "Confirm" to manually open a ticket when Razorpay webhook delivery fails.
      </p>
    </MainLayout>
  );
}
