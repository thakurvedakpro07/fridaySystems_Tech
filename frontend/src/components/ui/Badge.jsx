/**
 * Badge — small coloured pill for ticket status, severity, and priority labels.
 */
const COLOUR_MAP = {
  // Ticket status
  pending_payment:  "bg-yellow-100 text-yellow-800",
  open:             "bg-blue-100 text-blue-800",
  assigned:         "bg-purple-100 text-purple-800",
  in_progress:      "bg-orange-100 text-orange-800",
  waiting_customer: "bg-pink-100 text-pink-800",
  resolved:         "bg-green-100 text-green-800",
  closed:           "bg-gray-100 text-gray-700",

  // Severity
  low:      "bg-gray-100 text-gray-700",
  medium:   "bg-yellow-100 text-yellow-800",
  high:     "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",

  // Priority
  urgent: "bg-red-100 text-red-800 font-semibold",

  // Freelancer onboarding
  pending:   "bg-yellow-100 text-yellow-800",
  approved:  "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
};

const LABEL_MAP = {
  pending_payment:  "Pending Payment",
  in_progress:      "In Progress",
  waiting_customer: "Waiting Customer",
};

export default function Badge({ label }) {
  const colours = COLOUR_MAP[label] ?? "bg-gray-100 text-gray-700";
  const display = LABEL_MAP[label] ?? label.replaceAll("_", " ");

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colours}`}>
      {display}
    </span>
  );
}
