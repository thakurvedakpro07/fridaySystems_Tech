import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { CONTACT } from "../config/contact";
import { CONSULTING_FEE, SERVICE_FEES, calcResolutionFee, fmtINR } from "../data/pricing";

const HOW_IT_WORKS = [
  {
    step:  "01",
    title: "Pay ₹299 + GST to open a ticket",
    desc:  "Activates your SLA and guarantees a first response from a verified engineer. Refunded automatically if no engineer accepts within 24 hours.",
    color: "text-indigo-600",
    badge: "due now",
  },
  {
    step:  "02",
    title: "Engineer assigned & resolves your issue",
    desc:  "A verified specialist picks up your ticket within the SLA window, diagnoses the problem, and works to resolution.",
    color: "text-violet-600",
    badge: "in progress",
  },
  {
    step:  "03",
    title: "Confirm resolution — pay the resolution fee",
    desc:  "You confirm the issue is fixed. Only then is the resolution fee charged. You are never billed for unresolved work.",
    color: "text-emerald-600",
    badge: "on resolution",
  },
];

const FAQS = [
  {
    q: "What does the consultation fee cover?",
    a: `The ₹${CONSULTING_FEE} consultation fee (plus 18% GST, calculated and shown at checkout) activates your ticket and guarantees a first response from a verified engineer within the SLA window for your chosen priority. It covers initial ticket intake and diagnostic handoff.`,
  },
  {
    q: "When is the resolution fee charged?",
    a: "The resolution fee is charged only after your issue is fully resolved and you confirm it. If you reject the resolution, no resolution fee is charged. You are never billed for incomplete work.",
  },
  {
    q: "What if no engineer accepts my ticket?",
    a: `If no engineer accepts within 24 hours, the ₹${CONSULTING_FEE} consultation fee (including GST) is automatically refunded to your original payment method within 5–7 business days. No action required on your part.`,
  },
  {
    q: "What determines the final resolution fee?",
    a: "The base resolution fee depends on the service you select. When creating your ticket you also choose a priority level — higher priority adds a surcharge for a faster response SLA. The full fee breakdown is shown before you confirm payment.",
  },
  {
    q: "Are the displayed prices final?",
    a: "Yes. All prices shown include 18% GST and are all-inclusive. The resolution fee shown in the estimator is the base (lowest severity) price — no hidden fees, no upcharge beyond the priority surcharge you choose at ticket creation.",
  },
  {
    q: "How does Enterprise pricing work?",
    a: `Enterprise pricing is volume-based. For businesses raising 10+ tickets per month, contact our sales team at ${CONTACT.salesEmail} for a custom discounted rate and dedicated support.`,
  },
];

function CheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

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

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="pt-24 pb-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
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
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            ₹{CONSULTING_FEE} + GST to open a ticket. Resolution fee charged only after you confirm the fix.
            No subscription. No hidden charges.
          </p>
        </div>
      </section>

      {/* ── How payment works ─────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-8">
            How Payment Works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map(({ step, title, desc, color, badge }) => (
              <div key={step} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-4xl font-black ${color} tracking-tighter`}>{step}</p>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest
                                   border border-slate-200 px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mb-2 leading-snug">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Consultation Fee ──────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">Consultation Fee</h2>
                <p className="text-sm text-slate-500">Charged at ticket creation</p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-4xl font-black text-indigo-600">
                  ₹{CONSULTING_FEE}
                  <span className="text-xl font-bold text-indigo-400 ml-1.5">+ GST</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">GST calculated and shown at checkout</p>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                `₹${CONSULTING_FEE} consultation fee`,
                "GST added during payment",
                "Paid when ticket is created",
                "Refunded if no engineer accepts within SLA",
                "Separate from the final resolution fee",
              ].map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <CheckIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Resolution Cost Estimator ─────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                             text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">
              Estimated Resolution Cost
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              How much will my issue cost?
            </h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto">
              Prices below are the base resolution cost per service, including 18% GST.
              Charged only after you confirm resolution.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Service
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Base Resolution Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SERVICE_FEES.map((svc, i) => {
                  const { total } = calcResolutionFee(svc.baseFee, 0);
                  return (
                    <tr
                      key={svc.key}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                                  hover:bg-indigo-50/30 transition-colors`}
                    >
                      <td className="px-5 py-4 font-semibold text-slate-800">{svc.name}</td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-black text-slate-900 text-base">{fmtINR(total)}</span>
                        <span className="text-xs text-slate-400 font-medium ml-1.5">onwards</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            <div className="flex items-center gap-2">
              <CheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <p className="text-xs text-slate-500">All prices include 18% GST</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <p className="text-xs text-slate-500">Charged only after you confirm resolution</p>
            </div>
          </div>

          {/* Priority info box */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900 mb-2">Need faster resolution?</p>
            <p className="text-sm text-amber-800 mb-3">
              The final resolution fee may increase depending on:
            </p>
            <ul className="space-y-1.5 mb-4">
              {[
                "Issue severity",
                "Required response time",
                "Complexity of the work",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-amber-700 leading-relaxed">
              During ticket creation you can choose the priority that best matches your business needs.
              Higher priority receives faster engineer assignment and response.
            </p>
          </div>
        </div>
      </section>

      {/* ── Enterprise ────────────────────────────────────────── */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10
                          flex flex-col sm:flex-row gap-8 items-start justify-between shadow-card">
            <div className="flex-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100
                               text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                Enterprise
              </span>
              <h2 className="text-2xl font-black text-slate-900 mb-2">10+ tickets per month?</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                Volume-based pricing with discounted per-ticket rates, priority queue,
                dedicated account management, and multi-user team access.
              </p>
              <ul className="space-y-2">
                {[
                  "Volume-discounted resolution fees",
                  "Priority ticket queue",
                  "Dedicated account manager",
                  "Multi-user team access",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-3">
              <a
                href={CONTACT.salesMailto}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white
                           font-bold px-6 py-3 rounded-xl hover:bg-slate-700 transition-colors text-sm"
              >
                Contact Sales
              </a>
              <p className="text-xs text-slate-400 text-center">{CONTACT.salesEmail}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pricing FAQs</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(79,70,229,0.2), transparent 60%)" }} />
        <div className="max-w-xl mx-auto text-center relative">
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
            No subscription required
          </h2>
          <p className="text-slate-400 text-base mb-8 leading-relaxed">
            Create a free account and pay ₹{CONSULTING_FEE} + GST only when you open your first ticket.
          </p>
          <Link
            to="/register/customer"
            className="inline-flex items-center justify-center gap-2 bg-indigo-500 text-white
                       font-bold px-8 py-4 rounded-2xl hover:bg-indigo-400 transition-colors text-base"
          >
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
