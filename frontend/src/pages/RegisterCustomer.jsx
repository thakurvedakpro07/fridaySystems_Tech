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
import { googleLogin as googleLoginApi, updateMyProfile } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { GoogleLoginButton } from "../components/auth/GoogleLoginButton";

const PERKS = [
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Create support tickets",
    body: "Open tickets in under 2 minutes for any IT issue.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Real-time ticket tracking",
    body: "Status updates and engineer notes the moment they happen.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Secure payments",
    body: "Pay only when your issue is fully resolved. No hidden fees, no surprises.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Dedicated support experts",
    body: "A Support Agent contacts you within your chosen response window (30 min – 4 hrs).",
  },
];

const AVATARS = [
  { initials: "R", bg: "#818cf8" },
  { initials: "A", bg: "#a78bfa" },
  { initials: "S", bg: "#60a5fa" },
];

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function RegisterCustomer() {
  usePageTitle("Create Customer Account");
  const navigate  = useNavigate();
  const { registerUser, loading } = useAuth();
  const { setTokens, setUser } = useAuthStore();
  const isMobile  = useIsMobile();
  const addToast  = useToast();
  const [form, setForm] = useState({
    name: "", email: "", company: "", password: "", password2: "",
  });
  const [errors, setErrors] = useState([]);

  // Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [companyStep, setCompanyStep] = useState(false);
  const [googleCompany, setGoogleCompany] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);

  const handleGoogleSuccess = async (tokenResponse) => {
    setGoogleLoading(true);
    setErrors([]);
    try {
      const { data } = await googleLoginApi(tokenResponse.access_token);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      if (data.needs_company) {
        setCompanyStep(true);
      } else {
        addToast("Account created! Welcome to ResolveHQ.", "success");
        navigate("/onboarding/customer");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Google sign-in failed. Please try again.";
      setErrors([msg]);
      addToast(msg, "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setCompanyLoading(true);
    try {
      if (googleCompany.trim()) {
        await updateMyProfile({ company: googleCompany.trim() });
      }
    } catch {
      // Non-fatal — user can update company later
    } finally {
      setCompanyLoading(false);
    }
    addToast("Account created! Welcome to ResolveHQ.", "success");
    navigate("/onboarding/customer");
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    if (form.password !== form.password2) {
      setErrors(["Passwords do not match."]);
      return;
    }
    const result = await registerUser({
      name: form.name,
      email: form.email,
      role: "customer",
      company: form.company,
      password: form.password,
      password2: form.password2,
    });
    if (result.success) {
      navigate("/onboarding/customer");
    } else {
      setErrors(result.errors || [result.message]);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT — brand panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #312e81 0%, #4338ca 30%, #5b21b6 65%, #7c3aed 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500 rounded-full blur-[130px] opacity-20" />
          <div className="absolute -top-24 -left-16 w-80 h-80 bg-indigo-400 rounded-full blur-[90px] opacity-15" />
          <div className="absolute -bottom-16 -right-8 w-72 h-72 bg-purple-600 rounded-full blur-[90px] opacity-25" />
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
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-medium text-indigo-100 mb-8 w-fit">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              For businesses & IT teams
            </div>

            <h2 className="text-[2.4rem] font-bold text-white leading-[1.12] tracking-tight mb-4">
              IT support that pays<br />only on resolution.
            </h2>
            <p className="text-indigo-200 text-[15px] leading-relaxed mb-10 max-w-[290px]">
              Get expert IT support for your business — no contracts, no retainers.
            </p>

            <div className="space-y-5">
              {PERKS.map((p) => (
                <div key={p.title} className="flex items-start gap-3.5">
                  <div className="w-8 h-8 bg-white/10 border border-white/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    {p.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{p.title}</p>
                    <p className="text-xs text-indigo-200 leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {AVATARS.map(({ initials, bg }, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-indigo-700/60 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: bg }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-xs text-indigo-300">
              Verified engineers · Transparent fixed pricing · Priority consultation (30 min – 4 hrs)
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-y-auto">
        <div className="w-full max-w-[420px] my-auto">

          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
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
            {/* Company name step — shown after Google sign-in for new users */}
            {companyStep ? (
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                    ✓ Google account connected
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5">One last thing</h1>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    What company or organisation are you raising support tickets for?
                  </p>
                </div>
                <form onSubmit={handleCompanySubmit} className="space-y-4">
                  <div>
                    <label htmlFor="google-company" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Company Name
                    </label>
                    <input
                      id="google-company"
                      type="text"
                      value={googleCompany}
                      onChange={(e) => setGoogleCompany(e.target.value)}
                      placeholder="Acme Technologies"
                      className="input-auth"
                      autoFocus
                    />
                  </div>
                  <div className="pt-1 flex gap-3">
                    <Button type="submit" disabled={companyLoading} className="flex-1" size="lg">
                      {companyLoading ? "Saving…" : "Continue →"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { addToast("Welcome to ResolveHQ.", "success"); navigate("/onboarding/customer"); }}
                      className="text-sm text-slate-500 hover:text-slate-600 transition-colors px-2"
                    >
                      Skip
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                🏢 Customer Account
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5">Create your account</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                You'll be able to create support tickets and manage your company's support requests.
              </p>
            </div>

            {/* Google sign-in — only rendered when VITE_GOOGLE_CLIENT_ID is set */}
            {GOOGLE_ENABLED && (
              <div className="mb-5">
                <GoogleLoginButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => addToast("Google sign-in was cancelled or failed.", "warning")}
                  loading={googleLoading}
                />
                <div className="flex items-center gap-3 mt-5">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-500 font-medium">OR</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              </div>
            )}

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
                <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Rajesh Mehta"
                  className="input-auth"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Business Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@company.com"
                  className="input-auth"
                />
              </div>
              <div>
                <label htmlFor="reg-company" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Company Name
                </label>
                <input
                  id="reg-company"
                  name="company"
                  type="text"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="Acme Technologies"
                  className="input-auth"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                  <span className="ml-1.5 text-slate-500 font-normal">(min 10 chars)</span>
                </label>
                <input
                  id="reg-password"
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
                <label htmlFor="reg-password2" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-password2"
                  name="password2"
                  type="password"
                  value={form.password2}
                  onChange={handleChange}
                  required
                  minLength={10}
                  className="input-auth"
                />
              </div>
              <div className="pt-1">
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? "Creating account…" : "Create Customer Account →"}
                </Button>
              </div>
            </form>

            <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
              By registering you agree to our{" "}
              <a href="#" className="text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors">Privacy Policy</a>.
            </p>

            <p className="text-sm text-center text-slate-500 mt-4">
              Already have an account?{" "}
              <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
                Sign in
              </Link>
            </p>
            </>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs text-slate-500">256-bit SSL encryption · SOC 2 compliant</p>
          </div>

          <p className="text-xs text-center text-slate-500 mt-3">
            Need help?{" "}
            <a href={CONTACT.supportMailto} className="text-indigo-500 hover:text-indigo-700 transition-colors">
              {CONTACT.supportEmail}
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
