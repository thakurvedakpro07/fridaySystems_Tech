import { useState } from "react";
import { Link } from "react-router-dom";
import LandingFooter from "../components/layout/LandingFooter";
import Header from "../components/layout/Header";

// ─── Data ────────────────────────────────────────────────────────────────────

const SERVICES = [
  { name: "Desktop Support",    fee: "₹499",   icon: "💻", desc: "Desktops, laptops, OS setup & troubleshooting" },
  { name: "Linux Provisioning", fee: "₹999",   icon: "🐧", desc: "Server setup, configuration, hardening" },
  { name: "Windows Server",     fee: "₹999",   icon: "🖥️", desc: "AD, DNS, file sharing, RDP setup" },
  { name: "OS Patching",        fee: "₹799",   icon: "🔧", desc: "Security patches, updates, maintenance" },
  { name: "Security Hardening", fee: "₹1,499", icon: "🔒", desc: "Firewall, audit, compliance checks" },
  { name: "VMware / ESXi",      fee: "₹1,299", icon: "☁️", desc: "Virtualisation, snapshots, migrations" },
  { name: "SAP Basis Lite",     fee: "₹1,999", icon: "🏭", desc: "Transport, user admin, basis operations" },
];

const FEATURES = [
  {
    icon: <TicketIcon />,
    title: "Smart Ticket Tracking",
    desc: "Create and track IT issues with full SLA monitoring. Every status change is logged and visible in real-time.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: <TeamIcon />,
    title: "Vetted Engineer Network",
    desc: "Every freelancer is screened for skills, identity, and professionalism before being listed on the platform.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: <ShieldIcon />,
    title: "Pay Only on Resolution",
    desc: "No monthly fees or surprises. Pay the flat resolution fee only after your issue is completely fixed.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: <BellIcon />,
    title: "Real-time Notifications",
    desc: "In-app notifications keep every stakeholder informed. Engineers post notes, you get updates instantly.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: <ReceiptIcon />,
    title: "GST-Compliant Invoicing",
    desc: "Every transaction generates a proper GST invoice automatically — perfect for Indian business accounts.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: <LockIcon />,
    title: "Secure Role-Based Access",
    desc: "Customer, engineer, and admin roles with strict access control. Data is compartmentalized by design.",
    color: "bg-sky-50 text-sky-600",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Describe your problem",
    body: "Open a ticket in under 2 minutes. Select service type, describe the issue, and pay the ₹299 consulting fee — refunded if unaccepted within 2 hrs.",
    iconBg: "bg-indigo-600",
    icon: <TicketIcon white />,
    role: "Customer",
    roleBg: "bg-indigo-50 text-indigo-700",
  },
  {
    step: "02",
    title: "Admin assigns an engineer",
    body: "Our admin reviews and assigns the best-matched vetted engineer. You're notified the moment assignment happens.",
    iconBg: "bg-violet-600",
    icon: <PersonIcon white />,
    role: "Admin",
    roleBg: "bg-violet-50 text-violet-700",
  },
  {
    step: "03",
    title: "Engineer resolves the issue",
    body: "The engineer works on your ticket, posts progress notes, and marks it resolved. Comment directly via the ticket thread.",
    iconBg: "bg-emerald-600",
    icon: <WrenchIcon white />,
    role: "Engineer",
    roleBg: "bg-emerald-50 text-emerald-700",
  },
  {
    step: "04",
    title: "You verify & pay on success",
    body: "Confirm the fix, pay the flat resolution fee, and receive a GST invoice. Rate your experience to improve the platform.",
    iconBg: "bg-amber-500",
    icon: <CheckIcon white />,
    role: "Customer",
    roleBg: "bg-amber-50 text-amber-700",
  },
];

const TRUST_STATS = [
  { value: "500+",    label: "SMBs Served" },
  { value: "98%",     label: "Resolution Rate" },
  { value: "< 2 hrs", label: "Avg First Response" },
  { value: "50+",     label: "Verified Engineers" },
  { value: "₹1.2 Cr+",label: "Downtime Savings" },
  { value: "100%",    label: "GST Invoiced" },
];

const TESTIMONIALS = [
  {
    name: "Rajesh Mehta",
    title: "IT Manager",
    company: "Mehta Textiles Pvt. Ltd., Surat",
    body: "We had AD sync failures every other week. ResolveHQ assigned an engineer who fixed the Windows Server issue in under 3 hours. Worth every rupee — and the GST invoice made reimbursement easy.",
    rating: 5,
    initials: "RM",
    avatarBg: "bg-indigo-600",
  },
  {
    name: "Priya Nair",
    title: "Founder & CA",
    company: "Nair & Associates, Chennai",
    body: "Our Tally server kept crashing before month-end closing. I created a ticket at 11 PM and an engineer was on it within the hour. No subscriptions, no surprises. Exactly what a small firm needs.",
    rating: 5,
    initials: "PN",
    avatarBg: "bg-violet-600",
  },
  {
    name: "Suresh Joshi",
    title: "Operations Head",
    company: "Joshi Auto Parts, Pune",
    body: "Finally an IT support service that's transparent about pricing. You know the fee before you start. We've resolved 12 tickets — Linux, security, VMware — everything done on time.",
    rating: 5,
    initials: "SJ",
    avatarBg: "bg-emerald-600",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the pricing work?",
    a: "You pay a flat ₹299 consulting fee when opening a ticket. This is fully refunded if no engineer accepts within 2 hours. The resolution fee (₹499–₹1,999) is only charged after your issue is completely fixed.",
  },
  {
    q: "How are engineers verified?",
    a: "All freelancers complete a skills assessment, identity check, and a supervised trial before listing. Their ratings, completion history, and response times are monitored by our admin team.",
  },
  {
    q: "What is the response time SLA?",
    a: "Most tickets receive an engineer assignment within 2 hours during business hours (9 AM–8 PM IST). You receive notifications at every status change. If the SLA is breached, the consulting fee is automatically refunded.",
  },
  {
    q: "Do I get a GST invoice?",
    a: "Yes. Every transaction — consulting fee and resolution fee — generates a proper GST-compliant invoice automatically. Perfect for business accounts, audits, and tax filings.",
  },
  {
    q: "What if my issue isn't resolved?",
    a: "You are never charged the resolution fee unless the issue is fully fixed and you confirm it. If an engineer cannot resolve the problem, the ticket is reassigned or escalated at no extra charge.",
  },
  {
    q: "Is my company data safe?",
    a: "ResolveHQ uses strict role-based access. Only the assigned engineer can view your ticket details. Customer data is never shared across accounts and is stored securely on Indian servers.",
  },
];

// ─── SVG Icon components ──────────────────────────────────────────────────────

function TicketIcon({ white }) {
  return (
    <svg className={`w-5 h-5 ${white ? "text-white" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function ReceiptIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function PersonIcon({ white }) {
  return (
    <svg className={`w-5 h-5 ${white ? "text-white" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function WrenchIcon({ white }) {
  return (
    <svg className={`w-5 h-5 ${white ? "text-white" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function CheckIcon({ white }) {
  return (
    <svg className={`w-5 h-5 ${white ? "text-white" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ArrowRight({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

// ─── Shared mini-components ───────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-3">{children}</p>
  );
}

function StarRating({ count }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= count ? "text-amber-400" : "text-slate-200"}`}
             fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-900 pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 bg-white border-t border-slate-100">
          <p className="text-sm text-slate-500 leading-relaxed pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">

        {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white pt-20 pb-24 px-4">
          {/* Radial glow */}
          <div className="absolute inset-0 bg-hero-pattern pointer-events-none" />
          {/* Decorative blob top-right */}
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
          {/* Decorative blob bottom-left */}
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-30 pointer-events-none" />

          <div className="relative max-w-3xl mx-auto text-center">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100
                            text-indigo-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Trusted by 500+ Indian SMBs
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900
                           leading-[1.1] tracking-tight mb-6">
              IT support that pays<br className="hidden sm:block" />
              <span className="bg-brand-gradient bg-clip-text text-transparent"> only on resolution</span>
            </h1>

            <p className="text-slate-500 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
              No contracts. No subscriptions. Vetted engineers fix your IT problems
              and you pay a flat fee only when your issue is fully resolved.
              GST invoice on every ticket.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
              <Link
                to="/register/customer"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white
                           font-semibold px-7 py-3.5 rounded-xl hover:bg-indigo-700 active:bg-indigo-800
                           transition-colors shadow-sm text-sm"
              >
                Get IT Support
                <ArrowRight />
              </Link>
              <Link
                to="/register/freelancer"
                className="inline-flex items-center justify-center gap-2 bg-white text-slate-700
                           font-semibold px-7 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300
                           hover:bg-slate-50 transition-colors text-sm shadow-sm"
              >
                Become a Freelancer
              </Link>
            </div>

            {/* Trust strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 border-t border-slate-100">
              {[
                { value: "500+",   sub: "SMBs served" },
                { value: "2 hrs",  sub: "avg first response" },
                { value: "98%",    sub: "resolution rate" },
                { value: "GST",    sub: "invoice on every ticket" },
              ].map((item) => (
                <div key={item.value} className="text-center">
                  <p className="text-2xl font-extrabold text-slate-900">{item.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 2. FEATURES ─────────────────────────────────────────────────────── */}
        <section id="features" className="py-20 px-4 bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <SectionLabel>Platform Features</SectionLabel>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                Everything your IT support needs
              </h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                Built specifically for Indian SMBs — transparent, efficient, and GST-compliant.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-white border border-slate-200 rounded-2xl p-6
                             hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
                  style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <SectionLabel>Simple Process</SectionLabel>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                From problem to resolution in 4 steps
              </h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                No ambiguity, no hidden charges — a transparent workflow built for SMBs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {HOW_IT_WORKS.map((item) => (
                <div
                  key={item.step}
                  className="bg-white border border-slate-200 rounded-2xl p-6"
                  style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${item.iconBg}`}>
                    {item.icon}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-slate-300">{item.step}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.roleBg}`}>
                      {item.role}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. STATS BANNER ─────────────────────────────────────────────────── */}
        <section className="py-16 px-4 bg-brand-gradient">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-8 gap-x-4 text-center">
              {TRUST_STATS.map((s) => (
                <div key={s.value} className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-extrabold text-white">{s.value}</p>
                  <p className="text-xs text-indigo-200 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. SERVICE CATALOG ──────────────────────────────────────────────── */}
        <section id="services" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <SectionLabel>Service Catalog</SectionLabel>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Flat-fee IT services</h2>
              <p className="text-slate-400 text-sm">
                + ₹299 consulting fee per ticket · Fully refunded if unaccepted within 2 hours
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SERVICES.map((s) => (
                <div
                  key={s.name}
                  className="group bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4
                             hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
                  style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
                >
                  <span className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center
                                   justify-center text-xl shrink-0 group-hover:border-indigo-100 transition-colors">
                    {s.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 mb-2">{s.desc}</p>
                    <p className="text-sm font-bold text-indigo-600">{s.fee}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register/customer"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold
                           px-7 py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm"
              >
                Get IT Support — Free to Join
                <ArrowRight />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 6. TESTIMONIALS ─────────────────────────────────────────────────── */}
        <section className="py-20 px-4 bg-slate-50 border-y border-slate-100">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <SectionLabel>Customer Stories</SectionLabel>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Trusted by real businesses</h2>
              <p className="text-slate-500 text-base max-w-xl mx-auto">
                IT teams and founders across India rely on ResolveHQ to keep operations running.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col"
                  style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
                >
                  <StarRating count={t.rating} />
                  <p className="text-sm text-slate-600 leading-relaxed mt-4 mb-5 flex-1">
                    "{t.body}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center
                                    text-white text-xs font-bold shrink-0 ${t.avatarBg}`}>
                      {t.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate">{t.title} · {t.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <SectionLabel>Common Questions</SectionLabel>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Frequently asked</h2>
              <p className="text-slate-500 text-base">
                Everything you need to know before your first ticket.
              </p>
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. FOR IT PROFESSIONALS ─────────────────────────────────────────── */}
        <section className="py-20 px-4 bg-white border-t border-slate-100">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 40%, #7c3aed 100%)" }}>
              <div className="flex flex-col lg:flex-row items-center gap-10 px-10 py-12 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />

                {/* Left content */}
                <div className="relative flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20
                                  text-violet-100 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    For IT Professionals
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4 leading-tight">
                    Turn your IT expertise<br className="hidden sm:block" /> into income.
                  </h2>
                  <p className="text-violet-200 text-base leading-relaxed mb-6 max-w-md">
                    Join ResolveHQ's network of trusted IT professionals and help businesses solve real-world technical challenges.
                  </p>
                  <Link
                    to="/register/freelancer"
                    className="inline-flex items-center gap-2 bg-white text-violet-700 font-semibold
                               px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors text-sm"
                  >
                    Become a Freelancer
                    <ArrowRight />
                  </Link>
                </div>

                {/* Right benefits */}
                <div className="relative flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
                  {[
                    { icon: "🏠", text: "Flexible remote work" },
                    { icon: "⭐", text: "Build professional reputation" },
                    { icon: "🎫", text: "Real support projects" },
                    { icon: "💰", text: "Earnings from completed tickets" },
                  ].map((b) => (
                    <div key={b.text} className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                      <span className="text-lg shrink-0">{b.icon}</span>
                      <span className="text-sm font-medium text-white">{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. FINAL CTA ────────────────────────────────────────────────────── */}
        <section className="py-24 px-4 bg-slate-900 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-64
                          bg-indigo-600 rounded-full blur-3xl opacity-20 pointer-events-none" />
          <div className="relative max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20
                            text-white/80 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Engineers online now
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-5 leading-tight">
              Your IT problem has a<br />fixed-price solution
            </h2>
            <p className="text-slate-400 text-base mb-10 leading-relaxed">
              Join 500+ Indian SMBs who resolve IT issues without contracts,
              subscriptions, or unexpected invoices.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register/customer"
                className="inline-flex items-center justify-center gap-2 bg-indigo-500 text-white
                           font-semibold px-7 py-3.5 rounded-xl hover:bg-indigo-400 transition-colors text-sm"
              >
                Get IT Support
                <ArrowRight />
              </Link>
              <Link
                to="/register/freelancer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white
                           font-semibold px-7 py-3.5 rounded-xl hover:bg-white/20 border border-white/20
                           transition-colors text-sm"
              >
                Become a Freelancer
              </Link>
            </div>
          </div>
        </section>

      </main>

      <LandingFooter />
    </div>
  );
}
