// "Which engineers are overloaded" widget — wraps the same BarRow
// primitive EngineerWorkloadBars.jsx uses, but reads
// ops_command_center_service.get_engineer_capacity()'s richer per-engineer
// payload (active_ticket_count + utilization_pct) directly, rather than
// reusing EngineerWorkloadBars itself: that component reads a different
// field name (`active_tickets`, from GET /ops/freelancers/) and has no
// utilization display at all.
import BarRow from "./charts/BarRow";

export default function EngineerCapacityBoard({ engineers, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => <div key={n} className="h-6 shimmer rounded-lg" />)}
      </div>
    );
  }

  if (!engineers?.length) {
    return <p className="text-sm text-slate-500 text-center py-6">No active engineers yet.</p>;
  }

  const data = engineers.slice(0, 8).map((e) => ({
    label: e.name,
    value: e.active_ticket_count,
    utilizationPct: e.utilization_pct,
  }));

  return (
    <BarRow
      data={data}
      color="#7c3aed"
      valueFormatter={(v, row) =>
        row?.utilizationPct != null ? `${v} active · ${row.utilizationPct}% util` : `${v} active`
      }
    />
  );
}
