// Shared "Skip setup" + colored "Continue →" footer button pair, repeated
// per step in CustomerOnboarding.jsx and FreelancerOnboarding.jsx.
// `loading` covers the one step (CustomerOnboarding's company-info save)
// that swaps the label and hides the arrow while an API call is in flight.
export default function OnboardingFooterNav({
  onSkip, skipLabel = "Skip setup",
  onContinue, continueLabel = "Continue",
  loading = false, loadingLabel = "Saving…",
  accentClassName,
}) {
  return (
    <div className="flex items-center justify-between mt-8">
      <button onClick={onSkip} className="text-sm text-slate-500 hover:text-slate-600 transition-colors">
        {skipLabel}
      </button>
      <button
        onClick={onContinue}
        disabled={loading}
        className={`inline-flex items-center gap-2 ${accentClassName} text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60`}
      >
        {loading ? loadingLabel : continueLabel}
        {!loading && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        )}
      </button>
    </div>
  );
}
