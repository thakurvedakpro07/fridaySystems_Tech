// Shared step-dot indicator for multi-step flows. Previously duplicated
// (and already drifted) as a local `StepIndicator` inside both
// CustomerOnboarding.jsx and FreelancerOnboarding.jsx — this is the one
// canonical version new multi-step flows (e.g. the ticket-creation wizard)
// should import instead of adding a third copy.
export default function StepIndicator({ current, total, labels }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full shrink-0 transition-all duration-300 ${
            i < current
              ? "w-6 bg-indigo-600"
              : i === current
              ? "w-8 bg-indigo-600"
              : "w-6 bg-slate-200"
          }`}
        />
      ))}
      {/* whitespace-nowrap keeps the label text itself intact, but the
          parent's flex-wrap still lets the whole label drop to its own
          line on narrow screens instead of overflowing/clipping — with 5
          dots + a label like "Step 4 of 5 — Attachments", the row can
          exceed a 375px viewport's content width. */}
      <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">
        Step {current + 1} of {total}{labels?.[current] ? ` — ${labels[current]}` : ""}
      </span>
    </div>
  );
}
