import Card from "../ui/Card";
import Donut from "./charts/Donut";

const STATUS_COLORS = {
  open: "#3b82f6",
  assigned: "#8b5cf6",
  in_progress: "#4f46e5",
  resolved: "#10b981",
};

const STATUS_LABELS = {
  open: "Open",
  assigned: "Ready to Start",
  in_progress: "Work Started",
  resolved: "Resolved",
};

// Client-computed status breakdown of the engineer's own currently-fetched
// active ticket set — a single-engineer view, unlike EngineerWorkloadBars
// (which compares active-ticket counts *across* engineers for ops
// managers and is the wrong shape for this).
export default function WorkloadSummaryPanel({ tickets }) {
  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const segments = Object.entries(STATUS_LABELS)
    .filter(([key]) => counts[key])
    .map(([key, label]) => ({ label, value: counts[key], color: STATUS_COLORS[key] }));

  return (
    <Card title="WORKLOAD SUMMARY">
      <Donut segments={segments} />
    </Card>
  );
}
