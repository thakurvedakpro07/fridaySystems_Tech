import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useAuthStore } from "../../store/authStore";
import apiClient from "../../api/client";
import { getDisplayName } from "../../utils/displayName";
import OnboardingShell from "../../components/onboarding/OnboardingShell";
import OnboardingStepHeader from "../../components/onboarding/OnboardingStepHeader";
import OnboardingFooterNav from "../../components/onboarding/OnboardingFooterNav";

const INDUSTRIES = [
  "Manufacturing", "Retail & E-Commerce", "Finance & CA Firm",
  "Healthcare", "IT & Software", "Education",
  "Logistics & Supply Chain", "Real Estate", "Other",
];

const EMPLOYEE_RANGES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "500+", label: "500+ employees" },
];

const STEPS = ["Company Info", "Industry", "Team Size", "Welcome"];

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i < current
                ? "bg-indigo-600"
                : i === current
                ? "w-6 bg-indigo-600"
                : "bg-slate-200"
            }`}
          />
        </div>
      ))}
      <span className="text-xs text-slate-500 ml-1">Step {current + 1} of {total}</span>
    </div>
  );
}

export default function CustomerOnboarding() {
  usePageTitle("Set Up Your Account — ResolveHQ");
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    company: "",
    industry: "",
    employee_range: "",
  });

  const next = () => setStep((s) => s + 1);
  const skip = () => navigate("/dashboard");

  const saveAndContinue = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (data.company) payload.company = data.company;
      if (Object.keys(payload).length > 0) {
        await apiClient.patch("/customers/me/", payload);
      }
    } catch {
      // Non-blocking: onboarding save failure doesn't block progress
    } finally {
      setSaving(false);
      next();
    }
  };

  const belowCard = step < 3 && (
    <div className="mt-5 flex items-center gap-2 justify-center">
      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      <p className="text-xs text-slate-500">
        After setup you'll go directly to your dashboard to create tickets.
      </p>
    </div>
  );

  return (
    <OnboardingShell
      bgAccentClassName="to-indigo-50/30"
      logoGradient="linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
      belowCard={belowCard}
    >
      <StepIndicator current={step} total={STEPS.length} />

      {/* ── Step 0: Company Info ── */}
      {step === 0 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[0]}
            title="Tell us about your company"
            description="This helps our engineers understand your business context when resolving tickets."
            accentClassName="text-indigo-600"
          />
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                value={data.company}
                onChange={(e) => setData((d) => ({ ...d, company: e.target.value }))}
                placeholder="Acme Technologies Pvt. Ltd."
                className="input-base"
              />
            </div>
          </div>
          <OnboardingFooterNav
            onSkip={skip}
            onContinue={saveAndContinue}
            loading={saving}
            accentClassName="bg-indigo-600 hover:bg-indigo-700"
          />
        </div>
      )}

      {/* ── Step 1: Industry ── */}
      {step === 1 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[1]}
            title="What industry are you in?"
            description="We'll match you with engineers who have relevant experience in your domain."
            accentClassName="text-indigo-600"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => setData((d) => ({ ...d, industry: ind }))}
                className={`text-sm font-medium px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  data.industry === ind
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
          <OnboardingFooterNav onSkip={skip} onContinue={next} accentClassName="bg-indigo-600 hover:bg-indigo-700" />
        </div>
      )}

      {/* ── Step 2: Employee Count ── */}
      {step === 2 && (
        <div>
          <OnboardingStepHeader
            eyebrow={STEPS[2]}
            title="How large is your team?"
            description="This helps us prioritize and scope tickets appropriately."
            accentClassName="text-indigo-600"
          />
          <div className="space-y-2.5">
            {EMPLOYEE_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setData((d) => ({ ...d, employee_range: r.value }))}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  data.employee_range === r.value
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <OnboardingFooterNav onSkip={skip} onContinue={next} accentClassName="bg-indigo-600 hover:bg-indigo-700" />
        </div>
      )}

      {/* ── Step 3: Welcome ── */}
      {step === 3 && (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            {(() => {
              const name = getDisplayName(user);
              return name ? `You're all set, ${name}!` : "You're all set!";
            })()}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            Your customer account is ready. Create your first support ticket and a Support Agent will contact you within your chosen response window to begin the consultation.
          </p>

          <div className="space-y-3 text-left mb-8">
            {[
              "Create your first support ticket",
              "Track progress in real-time",
              "Pay only when your issue is resolved",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                </div>
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700
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
