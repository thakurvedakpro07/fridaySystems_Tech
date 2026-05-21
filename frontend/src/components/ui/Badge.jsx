const COLOUR_MAP = {
  // Ticket status
  pending_payment:  "bg-amber-50 text-amber-700 border-amber-200",
  open:             "bg-blue-50 text-blue-700 border-blue-200",
  assigned:         "bg-violet-50 text-violet-700 border-violet-200",
  in_progress:      "bg-indigo-50 text-indigo-700 border-indigo-200",
  waiting_customer: "bg-pink-50 text-pink-700 border-pink-200",
  resolved:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:           "bg-slate-100 text-slate-600 border-slate-200",

  // Severity
  low:      "bg-slate-100 text-slate-600 border-slate-200",
  medium:   "bg-amber-50 text-amber-700 border-amber-200",
  high:     "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",

  // Priority
  urgent: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",

  // Freelancer onboarding
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  approved:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspended: "bg-rose-50 text-rose-700 border-rose-200",
};

const DOT_MAP = {
  open:             "bg-blue-500",
  in_progress:      "bg-indigo-500",
  assigned:         "bg-violet-500",
  waiting_customer: "bg-pink-500",
  resolved:         "bg-emerald-500",
  closed:           "bg-slate-400",
  pending_payment:  "bg-amber-500",
  critical:         "bg-rose-500",
  high:             "bg-orange-500",
  urgent:           "bg-rose-500",
  approved:         "bg-emerald-500",
  suspended:        "bg-rose-500",
};

const LABEL_MAP = {
  pending_payment:  "Pending Payment",
  in_progress:      "In Progress",
  waiting_customer: "Waiting",
};

export default function Badge({ label, dot = false }) {
  if (!label) return null;
  const colours = COLOUR_MAP[label] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const display = LABEL_MAP[label] ?? label.replaceAll("_", " ");
  const dotColor = DOT_MAP[label];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${colours}`}>
      {(dot || dotColor) && dotColor && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      )}
      {display}
    </span>
  );
}
