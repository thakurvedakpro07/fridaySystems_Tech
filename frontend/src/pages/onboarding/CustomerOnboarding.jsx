import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useAuthStore } from "../../store/authStore";
import apiClient from "../../api/client";
import { getDisplayName } from "../../utils/displayName";

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
      <span className="text-xs text-slate-400 ml-1">Step {current + 1} of {total}</span>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
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
          <StepIndicator current={step} total={STEPS.length} />

          {/* ── Step 0: Company Info ── */}
          {step === 0 && (
            <div>
              <div className="mb-6">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">
                  {STEPS[0]}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Tell us about your company
                </h2>
                <p className="text-sm text-slate-500">
                  This helps our engineers understand your business context when resolving tickets.
                </p>
              </div>
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
              <div className="flex items-center justify-between mt-8">
                <button onClick={skip} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Skip setup
                </button>
                <button
                  onClick={saveAndContinue}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
                             font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Continue"}
                  {!saving && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Industry ── */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">
                  {STEPS[1]}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  What industry are you in?
                </h2>
                <p className="text-sm text-slate-500">
                  We'll match you with engineers who have relevant experience in your domain.
                </p>
              </div>
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
              <div className="flex items-center justify-between mt-8">
                <button onClick={skip} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Skip setup
                </button>
                <button
                  onClick={next}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
                             font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Employee Count ── */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">
                  {STEPS[2]}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  How large is your team?
                </h2>
                <p className="text-sm text-slate-500">
                  This helps us prioritize and scope tickets appropriately.
                </p>
              </div>
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
              <div className="flex items-center justify-between mt-8">
                <button onClick={skip} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Skip setup
                </button>
                <button
                  onClick={next}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
                             font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
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
        </div>

        {/* What happens next info */}
        {step < 3 && (
          <div className="mt-5 flex items-center gap-2 justify-center">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-xs text-slate-400">
              After setup you'll go directly to your dashboard to create tickets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
