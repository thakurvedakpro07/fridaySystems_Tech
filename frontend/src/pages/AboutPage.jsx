import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { CONTACT } from "../config/contact";

const TEAM = [
  {
    name: "Ankit Sharma", title: "Co-founder & CEO",
    bio: "12+ years in enterprise IT services and B2B SaaS. Previously led IT operations for a 500-person manufacturing firm.",
    gradient: "from-indigo-500 to-violet-600", initials: "AS",
  },
  {
    name: "Meera Iyer", title: "Co-founder & CTO",
    bio: "Former engineering lead at a fintech startup. Architect of ResolveHQ's real-time ticket matching and billing engine.",
    gradient: "from-sky-500 to-teal-600", initials: "MI",
  },
  {
    name: "Rahul Gupta", title: "Head of Operations",
    bio: "Built the freelancer vetting pipeline that certifies every engineer on the platform. 8 years in IT staffing.",
    gradient: "from-emerald-500 to-green-600", initials: "RG",
  },
];

const VALUES = [
  {
    title: "Transparency First",
    desc: "You always know the price before work starts. No hidden fees, no surprise invoices. ₹299 upfront — that's it until resolution.",
    color: "text-indigo-600", bg: "bg-indigo-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Quality Over Quantity",
    desc: "We maintain a small, vetted pool of engineers rather than an open marketplace. Every specialist is tested and identity-verified before listing.",
    color: "text-emerald-600", bg: "bg-emerald-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "SMB-First Design",
    desc: "Every feature is built around the reality of running a small business: limited IT budget, no in-house team, and the need for GST-compliant invoices.",
    color: "text-amber-600", bg: "bg-amber-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
  },
  {
    title: "Speed with Accountability",
    desc: "A 2-hour first response SLA is a genuine commitment backed by automatic refunds. We don't sell promises — we enforce them with our own billing system.",
    color: "text-rose-600", bg: "bg-rose-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const MILESTONES = [
  { year: "2023", label: "Founded", desc: "Started as a tool to solve our own IT support problem at a 30-person startup." },
  { year: "2024 Q1", label: "First 100 Tickets", desc: "Reached our first 100 resolved tickets. Started formalising the engineer vetting process." },
  { year: "2024 Q3", label: "Razorpay Integration", desc: "Automated billing and GST invoice generation — the feature SMBs asked for most." },
  { year: "2025", label: "Beta Launch", desc: "Public beta opens to Indian SMBs across manufacturing, pharma, logistics, and services sectors." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-20 px-4 sm:px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 60% 40%, rgba(79,70,229,0.15), transparent 55%), radial-gradient(circle at 20% 70%, rgba(124,58,237,0.1), transparent 45%)" }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/8 border border-white/12
                           text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-6">
            Our Story
          </span>
          <h1 className="text-5xl sm:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Built by IT professionals,{" "}
            <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, #818cf8, #c084fc)" }}>
              for Indian businesses
            </span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            ResolveHQ was founded after watching too many SMBs suffer through slow,
            opaque IT support contracts. We built the marketplace we wished existed.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                               text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">
                Our Mission
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-5">
                Make enterprise-grade IT support accessible to every Indian SMB
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-4">
                India has over 63 million SMBs, most of whom cannot afford a full-time IT team.
                When a server goes down or an email system fails, they have nowhere to turn except
                expensive consultants with unclear pricing and no accountability.
              </p>
              <p className="text-slate-500 text-base leading-relaxed">
                ResolveHQ changes that. A verified engineer is assigned within 2 hours,
                you pay a known flat fee, and you get a GST invoice automatically.
                No retainers, no subscriptions, no surprises.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { num: "< 2h", label: "First Response SLA", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
                { num: "₹299", label: "Flat Consulting Fee", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                { num: "7",    label: "Ticket Stages",       color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
                { num: "GST",  label: "Invoice Included",    color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100" },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5 text-center`}>
                  <p className={`text-3xl font-black ${s.color} mb-1`}>{s.num}</p>
                  <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                             text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">
              Our Values
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              What we believe
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white border border-slate-100 rounded-2xl p-6"
                   style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <div className={`w-12 h-12 ${v.bg} ${v.color} rounded-xl flex items-center justify-center mb-4`}>
                  {v.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{v.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                             text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">
              Our Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              From idea to platform
            </h2>
          </div>
          <div className="space-y-0">
            {MILESTONES.map((m, i) => (
              <div key={m.year} className="flex gap-5">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-xs font-bold
                                  flex items-center justify-center shrink-0 shadow-sm">
                    {i + 1}
                  </div>
                  {i < MILESTONES.length - 1 && (
                    <div className="w-0.5 flex-1 my-1 min-h-[32px] bg-indigo-100" />
                  )}
                </div>
                <div className="pb-8 flex-1">
                  <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-1">{m.year}</p>
                  <h3 className="text-base font-bold text-slate-900 mb-1">{m.label}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                             text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">
              The Team
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Who builds ResolveHQ
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TEAM.map((p) => (
              <div key={p.name} className="bg-white border border-slate-100 rounded-2xl p-6 text-center"
                   style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${p.gradient} text-white text-xl font-black
                                flex items-center justify-center mx-auto mb-4 shadow-sm`}>
                  {p.initials}
                </div>
                <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                <p className="text-xs font-semibold text-indigo-600 mt-0.5 mb-3">{p.title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(79,70,229,0.2), transparent 60%)" }} />
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 tracking-tight">
            Ready to try ResolveHQ?
          </h2>
          <p className="text-slate-400 text-base mb-8 leading-relaxed">
            Create your first ticket in under 2 minutes. Pay ₹299 consulting fee — refunded automatically if no engineer accepts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register/customer"
                  className="inline-flex items-center justify-center gap-2 bg-indigo-500 text-white
                             font-bold px-8 py-4 rounded-2xl hover:bg-indigo-400 transition-colors text-base">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Get Started — Free
            </Link>
            <a href={CONTACT.supportMailto}
               className="inline-flex items-center justify-center gap-2 text-white/80 font-semibold
                          px-8 py-4 rounded-2xl border border-white/15 hover:bg-white/8 transition-all text-base">
              Contact Us
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
