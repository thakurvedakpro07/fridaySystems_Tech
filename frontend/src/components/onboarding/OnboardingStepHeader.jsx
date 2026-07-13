// Shared per-step header (eyebrow label + title + description) for the
// onboarding wizards — extracted from identical blocks repeated per step
// in CustomerOnboarding.jsx and FreelancerOnboarding.jsx.
export default function OnboardingStepHeader({ eyebrow, title, description, accentClassName }) {
  return (
    <div className="mb-6">
      <p className={`text-xs font-semibold ${accentClassName} uppercase tracking-widest mb-2`}>{eyebrow}</p>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}
