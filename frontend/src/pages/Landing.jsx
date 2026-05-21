import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";

const SERVICES = [
  { name: "Desktop Support",    fee: "₹499",   icon: "💻", desc: "Desktops, laptops, OS setup" },
  { name: "Linux Provisioning", fee: "₹999",   icon: "🐧", desc: "Server setup, config, hardening" },
  { name: "Windows Server",     fee: "₹999",   icon: "🖥️", desc: "AD, DNS, file sharing, RDP" },
  { name: "OS Patching",        fee: "₹799",   icon: "🔧", desc: "Security patches, updates" },
  { name: "Security Hardening", fee: "₹1,499", icon: "🔒", desc: "Firewall, audit, compliance" },
  { name: "VMware / ESXi",      fee: "₹1,299", icon: "☁️", desc: "Virtualisation, snapshots" },
  { name: "SAP Basis Lite",     fee: "₹1,999", icon: "🏭", desc: "Transport, user admin, basis ops" },
];

const TRUST_ITEMS = [
  { label: "500+", sub: "SMBs served" },
  { label: "2 hrs", sub: "avg first response" },
  { label: "98%", sub: "resolution rate" },
  { label: "GST", sub: "invoice on every ticket" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Describe your problem",
    body: "Open a ticket in under 2 minutes. Pay ₹299 consulting fee upfront.",
    color: "bg-indigo-50 text-indigo-700",
  },
  {
    step: "02",
    title: "Engineer gets assigned",
    body: "A vetted engineer accepts your case and contacts you within the SLA window.",
    color: "bg-violet-50 text-violet-700",
  },
  {
    step: "03",
    title: "Problem solved",
    body: "Pay the flat resolution fee only after your issue is fully fixed.",
    color: "bg-emerald-50 text-emerald-700",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-white pt-16 pb-20 px-4">
          {/* Background radial glow */}
          <div className="absolute inset-0 bg-hero-pattern pointer-events-none" />

          <div className="relative max-w-3xl mx-auto text-center">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100
                            text-indigo-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Trusted by 500+ Indian SMBs
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-5">
              Expert IT support<br className="hidden sm:block" />
              <span className="bg-brand-gradient bg-clip-text text-transparent"> for Indian SMBs</span>
            </h1>

            <p className="text-slate-500 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
              Pay only when your problem is solved. No contracts, no subscriptions.
              Vetted engineers. GST invoice on every transaction.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white
                           font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 active:bg-indigo-800
                           transition-colors shadow-sm text-sm"
              >
                Open a Support Ticket
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 bg-white text-slate-700
                           font-semibold px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300
                           hover:bg-slate-50 transition-colors text-sm shadow-sm"
              >
                View Pricing
              </a>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-12 pt-8
                            border-t border-slate-100">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xl font-bold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-slate-50 border-y border-slate-100">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How it works</h2>
              <p className="text-slate-500 text-sm">Three steps from problem to resolution</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step}
                     className="bg-white rounded-2xl border border-slate-200 p-6 relative overflow-hidden"
                     style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm mb-4 ${item.color}`}>
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm">{item.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Service Catalog</h2>
              <p className="text-slate-400 text-sm">
                + ₹299 consulting fee per ticket · Refunded if unaccepted within 2 hours
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SERVICES.map((s) => (
                <div
                  key={s.name}
                  className="group bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4
                             hover:border-indigo-200 hover:shadow-card-hover transition-all duration-200 cursor-default"
                  style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
                >
                  <span className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center
                                   justify-center text-xl shrink-0 group-hover:border-indigo-100 transition-colors">
                    {s.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 mb-1.5">{s.desc}</p>
                    <p className="text-sm font-bold text-indigo-600">{s.fee}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold
                           px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm"
              >
                Get Started — Free to Join
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
