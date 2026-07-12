import { useEffect, useState, useCallback } from "react";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRoles } from "../../hooks/useRoles";
import { useToast } from "../../context/ToastContext";
import {
  getOpsPayments,
  getOpsPaymentSummary,
  opsConfirmPayment,
  opsRefundPayment,
} from "../../api/ops";
import { extractErrorMessage } from "../../utils/apiError";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function OpsPayments() {
  usePageTitle("Payments — ResolveHQ");
  const { isSuperAdmin, isFinanceManager } = useRoles();
  const showToast = useToast();
  const canWrite = isSuperAdmin || isFinanceManager;

  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filters, setFilters] = useState({ status: "", payment_type: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.payment_type) params.payment_type = filters.payment_type;
      const [paymentsRes, summaryRes] = await Promise.all([
        getOpsPayments(params),
        canWrite ? getOpsPaymentSummary() : Promise.resolve(null),
      ]);
      setPayments(paymentsRes.data?.results ?? paymentsRes.data ?? []);
      if (summaryRes) setSummary(summaryRes.data);
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to load payments."), "error");
    } finally {
      setLoading(false);
    }
  }, [filters, canWrite, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = async (paymentId) => {
    setActionLoading(paymentId + "_confirm");
    try {
      await opsConfirmPayment(paymentId);
      showToast("Payment confirmed.", "success");
      fetchData();
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to confirm payment."), "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (paymentId) => {
    if (!window.confirm("Refund this payment? This action cannot be undone.")) return;
    setActionLoading(paymentId + "_refund");
    try {
      await opsRefundPayment(paymentId);
      showToast("Payment refunded.", "success");
      fetchData();
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to refund payment."), "error");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader
          title="Payments"
          description={canWrite ? "Manage payments, confirm transactions, and issue refunds." : "Read-only view of all transactions."}
        />

        {/* Summary cards — Finance Manager + Super Admin only */}
        {canWrite && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Revenue" value={`₹${summary.total_revenue?.toLocaleString("en-IN") ?? "—"}`} />
            <SummaryCard label="Refunds" value={summary.refund_count ?? "—"} />
            <SummaryCard label="Payment Types" value={summary.by_type?.length ?? "—"} />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={filters.payment_type}
            onChange={(e) => setFilters((f) => ({ ...f, payment_type: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All types</option>
            <option value="consulting_fee">Consulting Fee</option>
            <option value="resolution_fee">Resolution Fee</option>
            <option value="subscription">Subscription</option>
            <option value="refund">Refund</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Loading payments…</div>
          ) : payments.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No payments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Invoice #</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                    {canWrite && <th className="text-left px-4 py-3 font-medium text-slate-500">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-700">{p.customer_email}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{p.payment_type?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">₹{p.total_amount?.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3"><Badge domain="paymentStatus" label={p.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {p.status === "pending" && (
                              <button
                                onClick={() => handleConfirm(p.id)}
                                disabled={actionLoading === p.id + "_confirm"}
                                className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {actionLoading === p.id + "_confirm" ? "…" : "Confirm"}
                              </button>
                            )}
                            {isSuperAdmin && p.refund_eligible && (
                              <button
                                onClick={() => handleRefund(p.id)}
                                disabled={actionLoading === p.id + "_refund"}
                                className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                {actionLoading === p.id + "_refund" ? "…" : "Refund"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
