import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";

const PERKS = [
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Pay per resolution",
    body: "Only pay when your issue is actually fixed — zero risk.",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Priority Consultation",
    body: "A Support Agent contacts you within your chosen response window (30 min – 4 hrs).",
  },
  {
    icon: (
      <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: "Transparent billing",
    body: "Full payment history and billing records available from your dashboard.",
  },
];

const AVATARS = [
  { initials: "R", bg: "#818cf8" },
  { initials: "A", bg: "#a78bfa" },
  { initials: "S", bg: "#60a5fa" },
];

export default function Register() {
  usePageTitle("Create Account");
  const navigate = useNavigate();
  const { registerUser, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", password2: "", company: "", phone: "" });
  const [errors, setErrors] = useState([]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    if (form.password !== form.password2) {
      setErrors(["Passwords do not match."]);
      return;
    }
    const result = await registerUser(form.email, form.password, form.password2, form.company, form.phone);
    if (result.success) {
      navigate("/dashboard");
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
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-medium text-indigo-100 mb-8 w-fit">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Free to join · No subscription required
            </div>

            <h2 className="text-[2.6rem] font-bold text-white leading-[1.12] tracking-tight mb-4">
              IT support that<br />works like magic.
            </h2>
            <p className="text-indigo-200 text-[15px] leading-relaxed mb-10 max-w-[290px]">
              Get expert IT support for your business — no contracts, no retainers.
            </p>

            {/* Perks */}
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
              Verified engineers · Transparent fixed pricing · Priority consultation (30 min – 4 hrs)
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-y-auto">
        <div className="w-full max-w-[400px] my-auto">

          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-gradient rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Create your account</h1>
              <p className="text-sm text-slate-500">Start resolving IT issues today. Free to join.</p>
            </div>

            {errors.length > 0 && (
              <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  {errors.length === 1 ? errors[0] : (
                    <ul className="list-disc list-inside space-y-0.5">
                      {errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Work email <span className="text-rose-500">*</span>
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
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                  <span className="ml-1.5 text-slate-400 font-normal">(min 10 chars)</span>
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
                  Confirm password <span className="text-rose-500">*</span>
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
              <div>
                <label htmlFor="reg-company" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Company name
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
                <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone
                </label>
                <input
                  id="reg-phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="input-auth"
                />
              </div>
              <div className="pt-1">
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? "Creating account…" : "Create free account →"}
                </Button>
              </div>
            </form>

            <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
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
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs text-slate-400">256-bit SSL encryption · SOC 2 compliant</p>
          </div>

        </div>
      </div>
    </div>
  );
}
