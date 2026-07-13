// Shared page shell for the onboarding wizards — gradient background, logo
// lockup, and the card wrapper (byte-identical box-shadow was previously
// copy-pasted between CustomerOnboarding.jsx and FreelancerOnboarding.jsx).
// `bgAccentClassName` and `logoGradient` carry the one real difference
// between the two flows (indigo vs violet theming); `belowCard` renders
// content after the card but still inside the centered column, used by
// CustomerOnboarding's "what happens next" note.
export default function OnboardingShell({ bgAccentClassName, logoGradient, belowCard, children }) {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white ${bgAccentClassName} flex flex-col items-center justify-center px-4 py-12`}>
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: logoGradient }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-900">ResolveHQ</span>
        </div>

        <div
          className="bg-white border border-slate-200 rounded-2xl p-8"
          style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.1), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
        >
          {children}
        </div>

        {belowCard}
      </div>
    </div>
  );
}
