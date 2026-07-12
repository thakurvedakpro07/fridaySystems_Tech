const DOT_TONE = {
  slate:   "bg-slate-400",
  blue:    "bg-blue-500",
  indigo:  "bg-indigo-500",
  violet:  "bg-violet-500",
  amber:   "bg-amber-500",
  orange:  "bg-orange-500",
  emerald: "bg-emerald-500",
  rose:    "bg-rose-500",
};

const PING_TONE = {
  slate:   "bg-slate-400",
  blue:    "bg-blue-400",
  indigo:  "bg-indigo-400",
  violet:  "bg-violet-400",
  amber:   "bg-amber-400",
  orange:  "bg-orange-400",
  emerald: "bg-emerald-400",
  rose:    "bg-rose-400",
};

const SIZES = {
  xs: "h-1.5 w-1.5",
  sm: "h-2.5 w-2.5",
};

// Animated "ping" status dot — replaces the same double-span markup that was
// independently hand-rolled in SLABadge (overdue), TicketDetail's
// TicketStatusTracker (current step), and its PostPaymentCard-adjacent
// "Support Engineer Response" card.
export default function LiveDot({ tone = "rose", size = "xs", className = "" }) {
  const dotClass = DOT_TONE[tone] ?? DOT_TONE.rose;
  const pingClass = PING_TONE[tone] ?? PING_TONE.rose;
  const sizeClass = SIZES[size] ?? SIZES.xs;

  return (
    <span className={`relative inline-flex shrink-0 ${sizeClass} ${className}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pingClass}`} />
      <span className={`relative inline-flex rounded-full h-full w-full ${dotClass}`} />
    </span>
  );
}
