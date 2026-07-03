// Temporary placeholder contact information. Replace before production launch.
import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../context/ToastContext";
import { CONTACT } from "../config/contact";

const CUSTOMER_BENEFITS = [
  "Create support tickets in under 2 minutes",
  "Real-time ticket tracking and updates",
  "Secure payments — pay only on resolution",
  "Dedicated vetted IT experts",
];

const FREELANCER_BENEFITS = [
  "Work remotely on your own schedule",
  "Receive ticket assignments from businesses",
  "Build ratings and professional reputation",
  "Earn from every completed support ticket",
];

export default function RegisterRole() {
  usePageTitle("Get Started — ResolveHQ");
  const isMobile = useIsMobile();
  const addToast = useToast();

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(CONTACT.tollFree);
      addToast("Phone number copied.", "success");
    } catch {
      addToast("Could not copy — please dial manually.", "warning");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 flex flex-col">

      {/* Top nav */}
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">ResolveHQ</span>
        </Link>
        <p className="text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
            Sign in
          </Link>
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl">

          {/* Heading */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100
                            text-indigo-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Free to join · No subscription required
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              How would you like to use ResolveHQ?
            </h1>
            <p className="text-slate-500 text-base max-w-md mx-auto leading-relaxed">
              Choose the experience that best matches your needs.{" "}
              <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">Contact us</a> if you're unsure.
            </p>
          </div>

          {/* Role cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Customer card */}
            <Link
              to="/register/customer"
              className="group relative bg-white border-2 border-slate-200 rounded-2xl p-7 flex flex-col
                         hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.08)" }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5
                              group-hover:bg-indigo-100 transition-colors">
                <span className="text-2xl">🏢</span>
              </div>

              {/* Role label */}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">
                Customer
              </span>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Get IT Support</h2>

              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Create support tickets and connect with qualified IT professionals to solve technical issues quickly.
              </p>

              {/* Benefits */}
              <ul className="space-y-2.5 mb-7 flex-1">
                {CUSTOMER_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                  Continue as Customer
                </span>
                <svg className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>

            {/* Freelancer card */}
            <Link
              to="/register/freelancer"
              className="group relative bg-white border-2 border-slate-200 rounded-2xl p-7 flex flex-col
                         hover:border-violet-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.08)" }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-5
                              group-hover:bg-violet-100 transition-colors">
                <span className="text-2xl">👨‍💻</span>
              </div>

              {/* Role label */}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 uppercase tracking-widest mb-2">
                Freelancer
              </span>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Become a Freelancer</h2>

              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Help businesses solve technical problems, build your reputation, and earn money remotely.
              </p>

              {/* Benefits */}
              <ul className="space-y-2.5 mb-7 flex-1">
                {FREELANCER_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <span className="text-sm font-semibold text-violet-600 group-hover:text-violet-700 transition-colors">
                  Continue as Freelancer
                </span>
                <svg className="w-4 h-4 text-violet-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>
          </div>

          {/* FAQ strip */}
          <div className="mt-8 p-5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-4 sm:gap-8">
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700 mb-1">Who should choose Customer?</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Businesses and IT managers who need fast, affordable technical support without hiring in-house.
              </p>
            </div>
            <div className="hidden sm:block w-px bg-slate-100" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700 mb-1">Who should choose Freelancer?</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Experienced IT professionals who want to earn by solving real-world business tech problems remotely.
              </p>
            </div>
            <div className="hidden sm:block w-px bg-slate-100" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700 mb-1">Can I change later?</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your account type is permanent. To change roles, email{" "}
                <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a>.
              </p>
            </div>
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-1.5 mt-6">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs text-slate-500">256-bit SSL encryption · Your data is always secure</p>
          </div>

          {/* Help footer */}
          <p className="text-xs text-center text-slate-500 mt-3">
            Questions?{" "}
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
      </main>
    </div>
  );
}
