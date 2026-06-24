import { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRoles } from "../../hooks/useRoles";
import { useToast } from "../../context/ToastContext";
import { getOpsAnalytics } from "../../api/ops";
import { extractErrorMessage } from "../../utils/apiError";

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-700">{title}</h2>
      {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
    </div>
  );
}

export default function OpsAnalytics() {
  usePageTitle("Analytics — ResolveHQ");
  const { isSuperAdmin, isOpsManager, isFinanceManager } = useRoles();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOpsAnalytics()
      .then((res) => setData(res.data))
      .catch((err) => showToast(extractErrorMessage(err, "Failed to load analytics."), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading analytics…</div>
      </AppShell>
    );
  }

  const showOperational = isSuperAdmin || isOpsManager;
  const showFinancial   = isSuperAdmin || isFinanceManager;

  const ops = data?.operational;
  const fin = data?.financial;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin ? "Full platform overview." : isFinanceManager ? "Financial metrics." : "Operational metrics."}
          </p>
        </div>

        {/* Operational section */}
        {showOperational && ops && (
          <section>
            <SectionHeader title="Operational Overview" description="Ticket activity over the last 30 days." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total (30d)"  value={ops.total_last_30_days} />
              <StatCard label="Open"         value={ops.by_status?.open ?? 0} />
              <StatCard label="In Progress"  value={(ops.by_status?.in_progress ?? 0) + (ops.by_status?.assigned ?? 0)} />
              <StatCard label="Avg Resolution" value={ops.avg_resolution_hours != null ? `${ops.avg_resolution_hours}h` : "—"} sub="Mean time to resolve" />
            </div>
            {ops.by_status && (
              <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Tickets by Status</p>
                <div className="space-y-2">
                  {Object.entries(ops.by_status).map(([s, n]) => (
                    <div key={s} className="flex items-center gap-3">
                      <span className="w-36 text-sm text-slate-600 capitalize">{s.replace(/_/g, " ")}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (n / (ops.total_last_30_days || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-8 text-right">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Financial section */}
        {showFinancial && fin && (
          <section>
            <SectionHeader title="Financial Overview" description="Revenue and payment metrics." />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Total Revenue"    value={`₹${fin.total_revenue?.toLocaleString("en-IN")}`} />
              <StatCard label="Refund Count"     value={fin.refund_count} />
              <StatCard label="Monthly Periods"  value={fin.monthly_revenue?.length} sub="Months with revenue" />
            </div>
            {fin.monthly_revenue?.length > 0 && (
              <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Monthly Revenue</p>
                <div className="space-y-2">
                  {fin.monthly_revenue.map((row) => {
                    const maxRevenue = Math.max(...fin.monthly_revenue.map((r) => r.total), 1);
                    return (
                      <div key={row.month} className="flex items-center gap-3">
                        <span className="w-20 text-sm text-slate-600">{row.month}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full"
                            style={{ width: `${(row.total / maxRevenue) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-24 text-right">
                          ₹{row.total.toLocaleString("en-IN")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {!showOperational && !showFinancial && (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
            No analytics available for your role.
          </div>
        )}
      </div>
    </AppShell>
  );
}
