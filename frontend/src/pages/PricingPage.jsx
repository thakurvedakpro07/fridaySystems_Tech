import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { CONTACT } from "../config/contact";

const PLANS = [
  {
    name: "Pay-Per-Ticket",
    badge: "Most Popular",
    highlight: true,
    price: "₹299",
    priceSub: "consulting fee per ticket",
    desc: "No subscription. Pay only when you need IT help.",
    features: [
      { text: "2-hour first response SLA",            included: true },
      { text: "Verified specialist assigned",          included: true },
      { text: "Real-time ticket tracking",             included: true },
      { text: "GST-compliant PDF invoice",             included: true },
      { text: "Automatic refund if unaccepted",        included: true },
      { text: "Resolution fee: ₹499–₹1,999",          included: true, note: "charged only after fix" },
      { text: "Comments & file attachments",           included: true },
      { text: "Multi-user team access",                included: false },
      { text: "Priority queue",                        included: false },
      { text: "Dedicated account manager",             included: false },
    ],
    cta: "Create a Ticket",
    ctaHref: "/register/customer",
    internal: true,
  },
  {
    name: "Enterprise",
    badge: "Contact Sales",
    highlight: false,
    price: "Custom",
    priceSub: "volume-based pricing",
    desc: "For businesses with 10+ tickets per month or dedicated support needs.",
    features: [
      { text: "2-hour first response SLA",            included: true },
      { text: "Verified specialist assigned",          included: true },
      { text: "Real-time ticket tracking",             included: true },
      { text: "GST-compliant PDF invoice",             included: true },
      { text: "Automatic refund if unaccepted",        included: true },
      { text: "Volume-discounted resolution fees",     included: true },
      { text: "Comments & file attachments",           included: true },
      { text: "Multi-user team access",                included: true },
      { text: "Priority queue",                        included: true },
      { text: "Dedicated account manager",             included: true },
    ],
    cta: "Contact Sales",
    ctaHref: CONTACT.salesMailto,
    internal: false,
  },
];

const FAQS = [
  {
    q: "What does ₹299 cover?",
    a: "The ₹299 consulting fee activates your ticket and guarantees a first response within 2 hours. It covers the ticket intake and initial diagnosis by the assigned engineer.",
  },
  {
    q: "When is the resolution fee charged?",
    a: "The resolution fee (₹499–₹1,999 depending on issue complexity) is charged only after your issue is fully fixed and you confirm resolution. You are never billed for incomplete work.",
  },
  {
    q: "What if no engineer accepts my ticket?",
    a: "If no engineer accepts within 24 hours, the ₹299 consulting fee is automatically refunded to your original payment method within 5–7 business days. No action required.",
  },
  {
    q: "Are all prices GST-inclusive?",
    a: "Yes. All prices shown are GST-inclusive (18% GST). A GST-compliant PDF invoice is generated for every payment and available from your Billing page.",
  },
  {
    q: "How does Enterprise pricing work?",
    a: "Enterprise pricing is volume-based. If you raise 10+ tickets per month, contact our sales team at hello@resolvehq.in for a custom rate that can reduce per-ticket costs significantly.",
  },
  {
    q: "Can I get a refund if I'm not satisfied?",
    a: "If you believe your issue was not resolved, raise a dispute within 48 hours. Our team reviews every dispute and issues refunds on valid cases. See our Refund Policy for full details.",
  },
];

function FaqItem({ q, a }) {
  return (
    <details className="border border-slate-200 rounded-xl overflow-hidden group">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none
                          bg-white hover:bg-slate-50 transition-colors">
        <span className="text-sm font-semibold text-slate-800 pr-4">{q}</span>
        <svg className="w-4 h-4 text-slate-400 shrink-0 group-open:rotate-180 transition-transform duration-200"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>
      <div className="px-5 pb-4 bg-white border-t border-slate-100">
        <p className="text-sm text-slate-500 leading-relaxed pt-3">{a}</p>
      </div>
    </details>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                           text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-5">
            Transparent Pricing
          </span>
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
            Pay only when your
            <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              {" "}issue is fixed
            </span>
          </h1>
          <p className="text-slate-500 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            No subscription. No retainer. No surprise invoice.
            ₹299 to open a ticket — refunded automatically if no engineer accepts.
          </p>
        </div>
      </section>

      {/* Price cards */}
      <section className="py-10 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl overflow-hidden
                  ${plan.highlight
                    ? "border-2 border-indigo-500 shadow-xl shadow-indigo-500/10"
                    : "border border-slate-200 shadow-md"
                  }`}
              >
                {plan.highlight && (
                  <div className="bg-indigo-600 text-white text-center text-xs font-bold py-2 tracking-widest uppercase">
                    {plan.badge}
                  </div>
                )}
                {!plan.highlight && (
                  <div className="bg-slate-100 text-slate-500 text-center text-xs font-bold py-2 tracking-widest uppercase">
                    {plan.badge}
                  </div>
                )}
                <div className="bg-white p-7">
                  <h2 className="text-xl font-black text-slate-900 mb-1">{plan.name}</h2>
                  <p className="text-sm text-slate-500 mb-5 leading-relaxed">{plan.desc}</p>

                  <div className="mb-6">
                    <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-sm text-slate-400 ml-2">{plan.priceSub}</span>
                  </div>

                  {plan.internal ? (
                    <Link to={plan.ctaHref}
                          className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-colors
                            ${plan.highlight
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}>
                      {plan.cta}
                    </Link>
                  ) : (
                    <a href={plan.ctaHref}
                       className="block w-full text-center py-3 rounded-xl font-bold text-sm
                                  bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                      {plan.cta}
                    </a>
                  )}

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f.text} className="flex items-start gap-3">
                        <span className={`mt-0.5 shrink-0 ${f.included ? "text-emerald-500" : "text-slate-300"}`}>
                          {f.included ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-sm ${f.included ? "text-slate-700" : "text-slate-400"}`}>
                          {f.text}
                          {f.note && (
                            <span className="text-[11px] text-slate-400 ml-1">({f.note})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resolution fee breakdown */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              Resolution fee breakdown
            </h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto">
              The resolution fee depends on issue complexity and is shown upfront before you confirm.
            </p>
          </div>
          <div className="overflow-hidden border border-slate-200 rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Type</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Examples</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee (incl. GST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { type: "Simple", examples: "Password reset, settings config, email routing", fee: "₹499" },
                  { type: "Standard", examples: "Server errors, VPN setup, Office 365 sync", fee: "₹999" },
                  { type: "Complex", examples: "AD failures, database tuning, security incidents", fee: "₹1,499" },
                  { type: "Critical", examples: "Multi-system outages, ransomware, cloud migration", fee: "₹1,999" },
                ].map((row, i) => (
                  <tr key={row.type} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-4 font-semibold text-slate-800">{row.type}</td>
                    <td className="px-5 py-4 text-slate-500">{row.examples}</td>
                    <td className="px-5 py-4 text-right font-black text-indigo-600">{row.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            All fees include 18% GST. Charged only after you confirm issue resolution.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Pricing FAQs</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(79,70,229,0.2), transparent 60%)" }} />
        <div className="max-w-xl mx-auto text-center relative">
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
            No credit card required to start
          </h2>
          <p className="text-slate-400 text-base mb-8 leading-relaxed">
            Create a free account, then pay ₹299 only when you open your first ticket.
          </p>
          <Link to="/register/customer"
                className="inline-flex items-center justify-center gap-2 bg-indigo-500 text-white
                           font-bold px-8 py-4 rounded-2xl hover:bg-indigo-400 transition-colors text-base">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Free Account
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
