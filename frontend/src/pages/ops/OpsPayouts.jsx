import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRoles } from "../../hooks/useRoles";
import { useToast } from "../../context/ToastContext";
import {
  getOpsPayouts,
  getOpsPayoutSummary,
  opsProcessPayout,
} from "../../api/ops";
import { extractErrorMessage } from "../../utils/apiError";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/dashboard/StatTile";
import Skeleton from "../../components/ui/Skeleton";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

// ── Process Payout modal — collects the bank/UPI UTR reference number
// finance receives after completing the transfer outside the platform. ──
function ProcessPayoutModal({ payout, onClose, onConfirm, loading, error }) {
  const [utrNumber, setUtrNumber] = useState("");

  useEffect(() => {
    if (payout) setUtrNumber("");
  }, [payout]);

  const canSubmit = utrNumber.trim().length > 0;

  return (
    <Modal
      isOpen={!!payout}
      onClose={onClose}
      title="Process Payout"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={() => onConfirm(utrNumber.trim())}
            disabled={loading || !canSubmit}
            loading={loading}
          >
            Mark Processed
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert severity="error">{error}</Alert>}

        {payout && (
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              Engineer share <span className="font-semibold text-slate-900">₹{payout.engineer_share}</span>
              {" "}to <span className="font-medium text-slate-800">{payout.freelancer_name}</span>
            </p>
            {payout.ticket_number && <p className="text-xs text-slate-500">Ticket {payout.ticket_number}</p>}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Complete the bank/UPI transfer outside ResolveHQ first, then enter the transaction
          reference below to record it as paid. This cannot be undone.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            UTR / Transaction Reference <span className="text-rose-500">*</span>
          </label>
          <Input
            value={utrNumber}
            onChange={(e) => setUtrNumber(e.target.value)}
            placeholder="e.g. UTR2607220001"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}

export default function OpsPayouts() {
  usePageTitle("Payouts — ResolveHQ");
  const { isSuperAdmin, isFinanceManager } = useRoles();
  const showToast = useToast();
  const canWrite = isSuperAdmin || isFinanceManager;

  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const [processTarget, setProcessTarget] = useState(null);
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const [payoutsRes, summaryRes] = await Promise.all([
        getOpsPayouts(params),
        canWrite ? getOpsPayoutSummary() : Promise.resolve(null),
      ]);
      setPayouts(payoutsRes.data?.results ?? payoutsRes.data ?? []);
      if (summaryRes) setSummary(summaryRes.data);
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to load payouts."), "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, canWrite, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirmProcess = async (utrNumber) => {
    setProcessLoading(true);
    setProcessError(null);
    try {
      await opsProcessPayout(processTarget.id, utrNumber);
      showToast("Payout marked as processed.", "success");
      setProcessTarget(null);
      fetchData();
    } catch (err) {
      setProcessError(extractErrorMessage(err, "Failed to process payout."));
    } finally {
      setProcessLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader
          title="Payouts"
          description={canWrite ? "Review pending freelancer payouts and record completed transfers." : "Read-only view of freelancer payouts."}
        />

        {/* Summary cards — Finance Manager + Super Admin only */}
        {canWrite && summary && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatTile
              label="Pending Payouts"
              value={`₹${summary.pending_total?.toLocaleString("en-IN") ?? "—"}`}
              sub={`${summary.pending_count ?? 0} awaiting transfer`}
            />
            <StatTile
              label="Processed This Month"
              value={`₹${summary.processed_this_month_total?.toLocaleString("en-IN") ?? "—"}`}
              sub={`${summary.processed_this_month_count ?? 0} payouts`}
            />
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
          </select>
        </div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : payouts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No payouts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Ticket</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Freelancer</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Resolution Fee</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Engineer Share</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Platform Share</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                    {canWrite && <th className="text-left px-4 py-3 font-medium text-slate-500">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.ticket_number ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{p.freelancer_name}</div>
                        <div className="text-xs text-slate-500">{p.freelancer_email}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">₹{p.resolution_fee}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">₹{p.engineer_share}</td>
                      <td className="px-4 py-3 text-right text-slate-500">₹{p.platform_share}</td>
                      <td className="px-4 py-3">
                        <Badge domain="payoutStatus" label={p.status} />
                        {p.utr_number && <div className="text-[11px] font-mono text-slate-400 mt-0.5">UTR {p.utr_number}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          {p.status === "pending" && (
                            <button
                              onClick={() => { setProcessTarget(p); setProcessError(null); }}
                              className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            >
                              Process
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      <ProcessPayoutModal
        payout={processTarget}
        onClose={() => setProcessTarget(null)}
        onConfirm={handleConfirmProcess}
        loading={processLoading}
        error={processError}
      />
    </AppShell>
  );
}
