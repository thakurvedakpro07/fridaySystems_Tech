import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { SERVICES, CATALOG_CATEGORIES, ACCENTS } from "../data/services";

// ── Category filter ───────────────────────────────────────────────
const ALL = "All";
const CATEGORIES = CATALOG_CATEGORIES;



// ── Sub-components ────────────────────────────────────────────────
function ServiceCard({ service }) {
  const a = ACCENTS[service.accent] ?? ACCENTS.indigo;
  return (
    <div className={`group bg-white border border-slate-200 ${a.ring} rounded-2xl p-6
                     shadow-card hover:shadow-card-hover hover:-translate-y-1
                     transition-all duration-200 flex flex-col`}>
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl ${a.icon} flex items-center justify-center mb-4 shrink-0`}>
        {service.icon}
      </div>

      {/* Category badge */}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold
                        uppercase tracking-wider border ${a.badge} mb-3 self-start`}>
        {service.category}
      </span>

      {/* Name + desc */}
      <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2 leading-snug">
        {service.name}
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-5">
        {service.desc}
      </p>

      {/* Time stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Consultation</p>
          <p className="text-sm font-black text-slate-800">30 min – 4 hrs</p>
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Completion</p>
          <p className="text-sm font-black text-slate-800">Varies by issue</p>
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/tickets/new"
        className={`${a.btn} text-white text-sm font-semibold px-4 py-2.5 rounded-xl
                    transition-colors text-center flex items-center justify-center gap-2 group/btn`}
      >
        Create Ticket
        <svg className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function ServicesPage() {
  const [active, setActive] = useState(ALL);

  const filtered = active === ALL
    ? SERVICES
    : SERVICES.filter((s) => s.category === active);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-slate-900 pt-16 pb-14 px-4 sm:px-6 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgb(99_102_241_/_0.25),transparent)] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/20
                           text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-5">
            Services
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08] mb-5">
            Expert IT support<br />
            <span className="text-indigo-400">for every problem</span>
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto mb-8">
            {SERVICES.length} specialisations. Verified engineers. Pay only when your problem is resolved.
            Transparent fixed pricing on every ticket.
          </p>

          {/* Hero stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              { value: `${SERVICES.length}`, label: "IT Specialisations" },
              { value: "30 min – 4 hrs", label: "Consultation Response" },
              { value: "₹299", label: "Consulting Fee" },
              { value: "0",    label: "Hidden Fees" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category filter ───────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 py-5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border transition-all duration-150
                ${active === cat
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50"
                }`}
            >
              {cat}
              {cat !== ALL && (
                <span className={`ml-2 text-[10px] font-black rounded-md px-1.5 py-0.5 tabular-nums
                                  ${active === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {SERVICES.filter((s) => s.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Services grid ─────────────────────────────────────── */}
      <section className="py-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Results label */}
          <p className="text-sm text-slate-500 font-medium mb-6">
            {filtered.length === SERVICES.length
              ? `All ${SERVICES.length} services`
              : `${filtered.length} service${filtered.length !== 1 ? "s" : ""} in ${active}`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-slate-500 text-lg font-medium">No services in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── How it works strip ────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100 py-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                             text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-3">
              How It Works
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              From ticket to resolution in 3 steps
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Submit a ticket",
                desc: "Describe your issue and pay the ₹299 consulting fee. A Support Agent contacts you within your chosen response window.",
                color: "text-indigo-600",
              },
              {
                step: "02",
                title: "Engineer assigned",
                desc: "Your Support Agent understands the issue and assigns the right engineer. The engineer begins working toward a resolution.",
                color: "text-violet-600",
              },
              {
                step: "03",
                title: "Problem resolved",
                desc: "Once you confirm the resolution, the remaining fee is charged. Your billing history is available from the dashboard.",
                color: "text-emerald-600",
              },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
                <p className={`text-4xl font-black ${color} mb-3 tracking-tighter`}>{step}</p>
                <h3 className="text-base font-black text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────── */}
      <section className="bg-brand-gradient py-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Can't find your service?
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed mb-8">
            Submit a ticket describing your issue — our team will match you with the right engineer,
            even for niche or complex infrastructure problems.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/tickets/new"
              className="bg-white text-indigo-700 font-bold px-8 py-3.5 rounded-xl
                         hover:bg-indigo-50 transition-colors text-sm shadow-sm"
            >
              Submit a Ticket
            </Link>
            <Link
              to="/contact"
              className="bg-white/10 border border-white/25 text-white font-semibold px-8 py-3.5
                         rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
