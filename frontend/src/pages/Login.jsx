// Temporary placeholder contact information. Replace before production launch.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../context/ToastContext";
import { CONTACT } from "../config/contact";

const TRUST_POINTS = [
  "Bank-grade encryption on all data",
  "Average 2-hour first response",
  "Transparent fixed pricing, no hidden fees",
];

const AVATARS = [
  { initials: "R", bg: "#818cf8" },
  { initials: "A", bg: "#a78bfa" },
  { initials: "S", bg: "#60a5fa" },
];

export default function Login() {
  usePageTitle("Sign In");
  const navigate  = useNavigate();
  const { loginUser, loading } = useAuth();
  const isMobile  = useIsMobile();
  const addToast  = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(CONTACT.tollFree);
      addToast("Phone number copied.", "success");
    } catch {
      addToast("Could not copy — please dial manually.", "warning");
    }
  }
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("session_expired") === "1";

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const result = await loginUser(form.email, form.password);
    if (result.success) {
      const staffRoles = ["admin", "operations_manager", "finance_manager", "support_agent"];
      if (staffRoles.includes(result.role)) {
        navigate("/operations");
      } else if (result.role === "freelancer") {
        navigate("/freelancer");
      } else {
        navigate("/dashboard");
      }
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT — brand panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #312e81 0%, #4338ca 30%, #5b21b6 65%, #7c3aed 100%)" }}
      >
        {/* Glow orbs + dot grid */}
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
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group w-fit">
            <div className="w-9 h-9 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/22 transition-colors duration-200">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">ResolveHQ</span>
          </Link>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center pb-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-medium text-indigo-100 mb-8 w-fit">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live support · avg 2hr response
            </div>

            <h2 className="text-[2.6rem] font-bold text-white leading-[1.12] tracking-tight mb-4">
              Enterprise IT support,<br />at startup prices.
            </h2>
            <p className="text-indigo-200 text-[15px] leading-relaxed mb-10 max-w-[290px]">
              Pay only when your issue is resolved. No subscriptions, no hidden fees.
            </p>

            {/* Trust points */}
            <div className="space-y-3.5">
              {TRUST_POINTS.map((text) => (
                <div key={text} className="flex items-center gap-3.5">
                  <div className="w-7 h-7 bg-white/10 border border-white/15 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-sm text-indigo-100 font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer — social proof */}
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
              Verified engineers · Transparent fixed pricing · 2-hr SLA
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-gradient rounded-xl flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900">ResolveHQ</span>
          </Link>

          {/* Form card */}
          <div
            className="bg-white border border-slate-200/80 rounded-2xl p-8 animate-fade-in"
            style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)" }}
          >
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Welcome back</h1>
              <p className="text-sm text-slate-500">Sign in to your ResolveHQ account</p>
            </div>

            {sessionExpired && !error && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                Your session expired. Please sign in again.
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="login-email"
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
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="input-auth"
                />
              </div>
              <div className="pt-1">
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? "Signing in…" : "Sign in →"}
                </Button>
              </div>
            </form>

            <p className="text-sm text-center text-slate-500 mt-6">
              No account?{" "}
              <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
                Create one free
              </Link>
            </p>
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs text-slate-400">256-bit SSL encryption · SOC 2 compliant</p>
          </div>

          {/* Help footer */}
          <p className="text-xs text-center text-slate-400 mt-4">
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
