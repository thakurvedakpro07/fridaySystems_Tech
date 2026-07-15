import Badge from "../ui/Badge";

// "Which services are failing" widget. No live uptime/health signal exists
// anywhere in the backend — ops_command_center_service.get_service_health()
// derives a proxy status (healthy/degraded/critical) from open ticket
// volume + SLA breach rate per service_type. `status` has no matching
// Badge domain (it's not ticketStatus/severity/etc.), so tone is passed
// explicitly per Badge's supported override API rather than adding a
// one-off domain for a 3-value enum used only here.
const STATUS_TONE = {
  healthy:  "emerald",
  degraded: "amber",
  critical: "rose",
};

const STATUS_LABEL = {
  healthy:  "Healthy",
  degraded: "Degraded",
  critical: "Critical",
};

export default function ServiceHealthGrid({ services, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-20 shimmer rounded-xl" />)}
      </div>
    );
  }

  if (!services?.length) {
    return <p className="text-sm text-slate-500 text-center py-6">No service activity yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {services.map((s) => (
        <div key={s.service_type} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-900 leading-snug">{s.label}</p>
            <Badge tone={STATUS_TONE[s.status] ?? "slate"} label={STATUS_LABEL[s.status] ?? s.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span>{s.open_count} open</span>
            <span>{s.critical_high_count} critical/high</span>
            {s.breach_rate_pct != null && <span>{s.breach_rate_pct}% breach rate</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
