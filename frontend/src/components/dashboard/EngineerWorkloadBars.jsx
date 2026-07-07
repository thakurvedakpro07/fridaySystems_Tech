// "How is the system performing" widget for Ops Manager / Super Admin —
// surfaces GET /api/ops/freelancers/'s active_ticket_count, which the
// backend already computes and sorts by workload but which no dashboard
// consumed until now.
import BarRow from "./charts/BarRow";

export default function EngineerWorkloadBars({ freelancers, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => <div key={n} className="h-6 shimmer rounded-lg" />)}
      </div>
    );
  }

  if (!freelancers?.length) {
    return <p className="text-sm text-slate-500 text-center py-6">No active engineers yet.</p>;
  }

  const data = [...freelancers]
    .sort((a, b) => (b.active_tickets ?? 0) - (a.active_tickets ?? 0))
    .slice(0, 6)
    .map((f) => ({ label: f.name, value: f.active_tickets ?? 0 }));

  return <BarRow data={data} color="#7c3aed" valueFormatter={(v) => `${v} active`} />;
}
