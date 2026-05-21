import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { usePageTitle } from "../hooks/usePageTitle";

const PERKS = [
  { icon: "🎯", title: "Pay per resolution", body: "Only pay when your issue is actually fixed." },
  { icon: "⚡", title: "Fast SLA", body: "Vetted engineers respond within 2 hours." },
  { icon: "🧾", title: "GST invoices", body: "Every transaction includes a proper GST receipt." },
];

export default function Register() {
  usePageTitle("Create Account");
  const navigate = useNavigate();
  const { registerUser, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", company: "", phone: "" });
  const [errors, setErrors] = useState([]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    const result = await registerUser(form.email, form.password, form.company, form.phone);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setErrors(result.errors || [result.message]);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col bg-brand-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-12">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">SupportMitra</span>
          </div>

          <div className="mt-auto">
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              IT support that<br />works like magic.
            </h2>
            <p className="text-indigo-200 text-sm leading-relaxed mb-8">
              Join 500+ Indian SMBs who rely on SupportMitra for fast, affordable IT help.
            </p>

            <div className="space-y-4">
              {PERKS.map((p) => (
                <div key={p.title} className="flex items-start gap-3">
                  <span className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5">
                    {p.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-indigo-200 mt-0.5">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-10 text-xs text-indigo-300">Free to join · No subscription required</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-brand-gradient rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-900">SupportMitra</span>
          </Link>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 mb-7">Start resolving IT issues today. Free to join.</p>

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
                Work email *
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@company.com"
                className="input-base"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password * <span className="text-slate-400 font-normal">(min 10 characters)</span>
              </label>
              <input
                id="reg-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={10}
                className="input-base"
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
                className="input-base"
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
                className="input-base"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Creating account…" : "Create Account — It's Free"}
            </Button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-4">
            By registering you agree to our{" "}
            <a href="#" className="text-slate-600 hover:text-slate-900">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="text-slate-600 hover:text-slate-900">Privacy Policy</a>.
          </p>

          <p className="text-sm text-center text-slate-500 mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
