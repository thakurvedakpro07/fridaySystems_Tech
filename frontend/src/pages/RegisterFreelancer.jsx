// Temporary placeholder contact information. Replace before production launch.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../context/ToastContext";
import { CONTACT } from "../config/contact";

const PERKS = [
  {
    icon: (
      <svg className="w-4 h-4 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    title: "Work remotely",
    body: "Help businesses anywhere in India from your own workspace.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Receive ticket assignments",
    body: "Get matched to tickets that fit your exact skill set.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    title: "Build ratings & reputation",
    body: "Every completed ticket builds your professional profile.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Earn from completed work",
    body: "Get paid after each resolved ticket — no subscription fees.",
  },
];

const SKILL_OPTIONS = [
  "Laptop / Desktop Support", "Server Administration Support", "AWS Support", "Azure Support",
  "Kubernetes Support", "Database Support", "DevOps CI/CD Support", "Infrastructure Platform Automation Support",
];

const EXPERIENCE_OPTIONS = [
  { value: "1", label: "1–2 years" },
  { value: "3", label: "3–5 years" },
  { value: "6", label: "6–10 years" },
  { value: "10+", label: "10+ years" },
];

export default function RegisterFreelancer() {
  usePageTitle("Create Freelancer Account");
  const navigate  = useNavigate();
  const { registerUser, loading } = useAuth();
  const isMobile  = useIsMobile();
  const addToast  = useToast();
  const [form, setForm] = useState({
    name: "", email: "", experience: "", password: "", password2: "",
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState([]);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(CONTACT.tollFree);
      addToast("Phone number copied.", "success");
    } catch {
      addToast("Could not copy — please dial manually.", "warning");
    }
  }

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleSkill = (skill) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    if (form.password !== form.password2) {
      setErrors(["Passwords do not match."]);
      return;
    }
    if (!consent) {
      setErrors(["You must accept the Terms of Service and Privacy Policy to register."]);
      return;
    }
    const result = await registerUser({
      name: form.name,
      email: form.email,
      role: "freelancer",
      skills: selectedSkills.join(","),
      password: form.password,
      password2: form.password2,
      consent,
    });
    if (result.success) {
      navigate("/onboarding/freelancer");
    } else {
      setErrors(result.errors || [result.message]);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT — brand panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 30%, #6d28d9 65%, #7c3aed 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-400 rounded-full blur-[130px] opacity-20" />
          <div className="absolute -top-24 -left-16 w-80 h-80 bg-purple-400 rounded-full blur-[90px] opacity-15" />
          <div className="absolute -bottom-16 -right-8 w-72 h-72 bg-violet-700 rounded-full blur-[90px] opacity-25" />
          <div
            className="absolute inset-0 opacity-[0.055]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          <Link to="/" className="flex items-center gap-3 group w-fit">
            <div className="w-9 h-9 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/22 transition-colors duration-200">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">ResolveHQ</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center pb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-medium text-violet-100 mb-8 w-fit">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              For IT professionals
            </div>

            <h2 className="text-[2.4rem] font-bold text-white leading-[1.12] tracking-tight mb-4">
              Turn your IT expertise<br />into income.
            </h2>
            <p className="text-violet-200 text-[15px] leading-relaxed mb-10 max-w-[290px]">
              Join ResolveHQ's network of trusted IT professionals and help businesses solve real-world challenges.
            </p>

            <div className="space-y-5">
              {PERKS.map((p) => (
                <div key={p.title} className="flex items-start gap-3.5">
                  <div className="w-8 h-8 bg-white/10 border border-white/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    {p.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{p.title}</p>
                    <p className="text-xs text-violet-200 leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-xs text-violet-300 leading-relaxed">
              All freelancers are reviewed by our admin team before going live. Your account will be active within 24 hours of approval.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-br from-slate-50 via-white to-violet-50/20 overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">

          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)" }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900">ResolveHQ</span>
          </Link>

          {/* Back link */}
          <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to role selection
          </Link>

          {/* Form card */}
          <div
            className="bg-white border border-slate-200/80 rounded-2xl p-8 animate-fade-in"
            style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)" }}
          >
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                👨‍💻 Freelancer Account
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5">Become a freelancer</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                You'll be able to receive ticket assignments and earn from completed support work.
              </p>
            </div>

            {errors.length > 0 && (
              <Alert severity="error" className="mb-5">
                {errors.length === 1 ? errors[0] : (
                  <ul className="list-disc list-inside space-y-0.5">
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="fl-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="fl-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Suresh Joshi"
                  className="input-auth"
                />
              </div>
              <div>
                <label htmlFor="fl-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="fl-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="input-auth"
                />
              </div>

              {/* Skills selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Your Skills
                  <span className="ml-1.5 text-slate-500 font-normal">(select all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((skill) => {
                    const active = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
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
              </div>

              {/* Experience */}
              <div>
                <label htmlFor="fl-experience" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Years of Experience
                </label>
                <select
                  id="fl-experience"
                  name="experience"
                  value={form.experience}
                  onChange={handleChange}
                  className="input-auth"
                >
                  <option value="">Select experience level</option>
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="fl-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                  <span className="ml-1.5 text-slate-500 font-normal">(min 10 chars)</span>
                </label>
                <input
                  id="fl-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={10}
                  className="input-auth"
                />
              </div>
              <div>
                <label htmlFor="fl-password2" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="fl-password2"
                  name="password2"
                  type="password"
                  value={form.password2}
                  onChange={handleChange}
                  required
                  minLength={10}
                  className="input-auth"
                />
              </div>

              {/* Consent checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-slate-500 leading-relaxed">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer"
                     className="text-slate-600 hover:text-slate-800 underline underline-offset-2 transition-colors">
                    Terms of Service
                  </a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer"
                     className="text-slate-600 hover:text-slate-800 underline underline-offset-2 transition-colors">
                    Privacy Policy
                  </a>.
                </span>
              </label>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading || !consent}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold
                             text-sm py-3 px-5 transition-colors disabled:opacity-60
                             bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white"
                >
                  {loading ? "Creating account…" : "Create Freelancer Account →"}
                </button>
              </div>
            </form>

            {/* Approval notice */}
            <div className="mt-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-xs text-amber-700 leading-relaxed">
                Freelancer accounts are reviewed by our admin team. You'll receive an email within 24 hours once approved.
              </p>
            </div>

            <p className="text-sm text-center text-slate-500 mt-4">
              Already have an account?{" "}
              <Link to="/login" className="text-violet-600 font-semibold hover:text-violet-700 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs text-slate-500">256-bit SSL encryption · SOC 2 compliant</p>
          </div>

          <p className="text-xs text-center text-slate-500 mt-3">
            Questions about the program?{" "}
            <a href={CONTACT.salesMailto} className="text-indigo-500 hover:text-indigo-700 transition-colors">
              {CONTACT.salesEmail}
            </a>
            {" "}·{" "}
            {isMobile ? (
              <a href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
                 aria-label={`Call support: ${CONTACT.tollFree}`}
                 className="hover:text-slate-600 transition-colors">
                {CONTACT.tollFree}
              </a>
            ) : (
              <button onClick={copyNumber}
                      aria-label="Copy phone number to clipboard"
                      title={`${CONTACT.tollFree} — click to copy`}
                      className="hover:text-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400 rounded">
                {CONTACT.tollFree}
              </button>
            )}
          </p>

        </div>
      </div>
    </div>
  );
}
