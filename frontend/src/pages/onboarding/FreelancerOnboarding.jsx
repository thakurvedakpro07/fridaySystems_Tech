import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useAuthStore } from "../../store/authStore";
import { updateProfile } from "../../api/settings";
import { getDisplayName } from "../../utils/displayName";
import OnboardingShell from "../../components/onboarding/OnboardingShell";
import OnboardingStepHeader from "../../components/onboarding/OnboardingStepHeader";
import OnboardingFooterNav from "../../components/onboarding/OnboardingFooterNav";

const STEPS = ["Skills", "Experience", "Availability", "Profile Check", "Welcome"];

const SKILL_OPTIONS = [
  "Laptop / Desktop Support", "Server Administration Support", "AWS Support", "Azure Support",
  "Kubernetes Support", "Database Support", "DevOps CI/CD Support", "Infrastructure Platform Automation Support",
];

// Maps each option's display label to the short skill tag Freelancer.skills
// stores elsewhere in the app (service_catalog.SERVICE_CATALOG's `key`s —
// these 8 options were deliberately written to mirror that catalog 1:1).
const SKILL_TAG_MAP = {
  "Laptop / Desktop Support": "laptop_desktop",
  "Server Administration Support": "server_admin",
  "AWS Support": "aws",
  "Azure Support": "azure",
  "Kubernetes Support": "kubernetes",
  "Database Support": "database",
  "DevOps CI/CD Support": "devops_cicd",
  "Infrastructure Platform Automation Support": "infra_automation",
};

const EXPERIENCE_OPTIONS = [
  { value: "1-2", label: "1–2 years", desc: "Junior engineer, learning the ropes" },
  { value: "3-5", label: "3–5 years", desc: "Mid-level, comfortable with most tasks" },
  { value: "6-10", label: "6–10 years", desc: "Senior engineer, deep domain expertise" },
  { value: "10+", label: "10+ years", desc: "Expert — architect-level knowledge" },
];

const AVAILABILITY_OPTIONS = [
  { value: "full_time", label: "Full time", desc: "40+ hours / week" },
  { value: "part_time", label: "Part time", desc: "10–20 hours / week" },
  { value: "ad_hoc", label: "Ad hoc", desc: "Available as tickets come in" },
];

function StepIndicator({ current, total, labels }) {
  return (
    <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5 shrink-0">
          <div className={`flex items-center gap-1.5 ${i < total - 1 ? "mr-1" : ""}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < current
                  ? "bg-violet-600 text-white"
                  : i === current
                  ? "bg-violet-600 text-white ring-2 ring-violet-200"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {i < current ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? "text-slate-700" : "text-slate-500"}`}>
              {label}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`h-px w-4 shrink-0 ${i < current ? "bg-violet-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function FreelancerOnboarding() {
  usePageTitle("Set Up Your Profile — ResolveHQ");
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    skills: [],
    experience: "",
    availability: "",
  });

  const next = () => setStep((s) => s + 1);
  const skip = () => navigate("/freelancer");

  const saveAndContinue = async () => {
    setSaving(true);
    try {
      const payload = {};
      const skillTags = data.skills.map((label) => SKILL_TAG_MAP[label]).filter(Boolean);
      if (skillTags.length > 0) payload.skills = skillTags.join(",");
      if (data.availability) payload.availability = data.availability;
      if (Object.keys(payload).length > 0) {
        await updateProfile(payload);
      }
    } catch {
      // Non-blocking: onboarding save failure doesn't block progress
    } finally {
      setSaving(false);
      next();
    }
  };

  const toggleSkill = (skill) => {
    setData((d) => ({
      ...d,
      skills: d.skills.includes(skill)
        ? d.skills.filter((s) => s !== skill)
        : [...d.skills, skill],
    }));
  };

  return (
    <OnboardingShell
      bgAccentClassName="to-violet-50/20"
      logoGradient="linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)"
    >
      <StepIndicator current={step} total={STEPS.length} labels={STEPS} />

      {/* ── Step 0: Skills ── */}
      {step === 0 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[0]}
            title="Confirm your skills"
            description="Select all skill areas you can confidently handle. We use this to match you to relevant tickets."
            accentClassName="text-violet-600"
          />
          <div className="flex flex-wrap gap-2">
            {SKILL_OPTIONS.map((skill) => {
              const active = data.skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    active
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700"
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
          <OnboardingFooterNav onSkip={skip} onContinue={next} accentClassName="bg-violet-600 hover:bg-violet-700" />
        </div>
      )}

      {/* ── Step 1: Experience ── */}
      {step === 1 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[1]}
            title="How much experience do you have?"
            description="This helps us calibrate the complexity of tickets assigned to you."
            accentClassName="text-violet-600"
          />
          <div className="space-y-2.5">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setData((d) => ({ ...d, experience: opt.value }))}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                  data.experience === opt.value
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-violet-300"
                }`}
              >
                <p className={`text-sm font-semibold ${data.experience === opt.value ? "text-white" : "text-slate-900"}`}>
                  {opt.label}
                </p>
                <p className={`text-xs mt-0.5 ${data.experience === opt.value ? "text-violet-200" : "text-slate-500"}`}>
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
          <OnboardingFooterNav onSkip={skip} onContinue={next} accentClassName="bg-violet-600 hover:bg-violet-700" />
        </div>
      )}

      {/* ── Step 2: Availability ── */}
      {step === 2 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[2]}
            title="What's your availability?"
            description="You can change this any time from your profile settings."
            accentClassName="text-violet-600"
          />
          <div className="space-y-2.5">
            {AVAILABILITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setData((d) => ({ ...d, availability: opt.value }))}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                  data.availability === opt.value
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-violet-300"
                }`}
              >
                <p className={`text-sm font-semibold ${data.availability === opt.value ? "text-white" : "text-slate-900"}`}>
                  {opt.label}
                </p>
                <p className={`text-xs mt-0.5 ${data.availability === opt.value ? "text-violet-200" : "text-slate-500"}`}>
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
          <OnboardingFooterNav onSkip={skip} onContinue={next} accentClassName="bg-violet-600 hover:bg-violet-700" />
        </div>
      )}

      {/* ── Step 3: Profile Check ── */}
      {step === 3 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[3]}
            title="Your profile looks great"
            description="Here's a summary of what you've set up. Our admin team will review and approve your account."
            accentClassName="text-violet-600"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-500">Skills</span>
              <span className="text-sm font-medium text-slate-800 text-right max-w-[200px] truncate">
                {data.skills.length > 0 ? data.skills.join(", ") : "Not specified"}
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-500">Experience</span>
              <span className="text-sm font-medium text-slate-800">
                {EXPERIENCE_OPTIONS.find((o) => o.value === data.experience)?.label || "Not specified"}
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-500">Availability</span>
              <span className="text-sm font-medium text-slate-800">
                {AVAILABILITY_OPTIONS.find((o) => o.value === data.availability)?.label || "Not specified"}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              Admin review typically takes under 24 hours. You'll receive an email once approved and ready to receive tickets.
            </p>
          </div>

          <OnboardingFooterNav
            onSkip={skip}
            skipLabel="Skip to dashboard"
            onContinue={saveAndContinue}
            continueLabel="Looks good"
            loading={saving}
            accentClassName="bg-violet-600 hover:bg-violet-700"
          />
        </div>
      )}

      {/* ── Step 4: Welcome ── */}
      {step === 4 && (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-violet-50 border border-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            {(() => {
              const name = getDisplayName(user);
              return name ? `Application submitted, ${name}!` : "Application submitted!";
            })()}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            Your freelancer profile has been submitted for review. While you wait, explore your dashboard and get familiar with the platform.
          </p>

          <div className="space-y-3 text-left mb-8">
            {[
              { step: "Now", text: "Your profile is under admin review" },
              { step: "~24h", text: "Account approved — you're live on the platform" },
              { step: "Then", text: "Tickets matching your skills get assigned to you" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div className="w-12 shrink-0">
                  <span className="text-xs font-bold text-violet-600">{item.step}</span>
                </div>
                <span className="text-sm text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/freelancer")}
            className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700
                       text-white font-semibold text-sm py-3 px-6 rounded-xl transition-colors"
          >
            Go to Dashboard
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}
