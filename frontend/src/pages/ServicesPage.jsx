import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";

// ── Category filter ───────────────────────────────────────────────
const ALL = "All";
const CATEGORIES = [
  ALL,
  "Server & Infrastructure",
  "Cloud & Networking",
  "Communication",
  "Data & Security",
  "Web & Hosting",
];

// ── Accent colour palette per service ────────────────────────────
const ACCENTS = {
  indigo: {
    icon:   "bg-indigo-50 text-indigo-600",
    badge:  "bg-indigo-50 text-indigo-700 border-indigo-100",
    btn:    "bg-indigo-600 hover:bg-indigo-700",
    ring:   "hover:border-indigo-200",
  },
  blue: {
    icon:   "bg-blue-50 text-blue-600",
    badge:  "bg-blue-50 text-blue-700 border-blue-100",
    btn:    "bg-blue-600 hover:bg-blue-700",
    ring:   "hover:border-blue-200",
  },
  violet: {
    icon:   "bg-violet-50 text-violet-600",
    badge:  "bg-violet-50 text-violet-700 border-violet-100",
    btn:    "bg-violet-600 hover:bg-violet-700",
    ring:   "hover:border-violet-200",
  },
  emerald: {
    icon:   "bg-emerald-50 text-emerald-600",
    badge:  "bg-emerald-50 text-emerald-700 border-emerald-100",
    btn:    "bg-emerald-600 hover:bg-emerald-700",
    ring:   "hover:border-emerald-200",
  },
  sky: {
    icon:   "bg-sky-50 text-sky-600",
    badge:  "bg-sky-50 text-sky-700 border-sky-100",
    btn:    "bg-sky-600 hover:bg-sky-700",
    ring:   "hover:border-sky-200",
  },
  amber: {
    icon:   "bg-amber-50 text-amber-600",
    badge:  "bg-amber-50 text-amber-700 border-amber-100",
    btn:    "bg-amber-600 hover:bg-amber-700",
    ring:   "hover:border-amber-200",
  },
  cyan: {
    icon:   "bg-cyan-50 text-cyan-600",
    badge:  "bg-cyan-50 text-cyan-700 border-cyan-100",
    btn:    "bg-cyan-600 hover:bg-cyan-700",
    ring:   "hover:border-cyan-200",
  },
  orange: {
    icon:   "bg-orange-50 text-orange-600",
    badge:  "bg-orange-50 text-orange-700 border-orange-100",
    btn:    "bg-orange-600 hover:bg-orange-700",
    ring:   "hover:border-orange-200",
  },
  rose: {
    icon:   "bg-rose-50 text-rose-600",
    badge:  "bg-rose-50 text-rose-700 border-rose-100",
    btn:    "bg-rose-600 hover:bg-rose-700",
    ring:   "hover:border-rose-200",
  },
  teal: {
    icon:   "bg-teal-50 text-teal-600",
    badge:  "bg-teal-50 text-teal-700 border-teal-100",
    btn:    "bg-teal-600 hover:bg-teal-700",
    ring:   "hover:border-teal-200",
  },
};

// ── Service data ──────────────────────────────────────────────────
const SERVICES = [
  {
    id: "linux-server",
    category: "Server & Infrastructure",
    name: "Linux Server Support",
    desc: "Configuration, troubleshooting, patching, and performance optimisation for Ubuntu, CentOS, Debian, and RHEL servers. Covers systemd, cron, kernel tuning, and process management.",
    responseTime: "< 2 hours",
    resolutionTime: "4–8 hours",
    accent: "indigo",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: "email-dns",
    category: "Communication",
    name: "Email & DNS Issues",
    desc: "Fix delivery failures, SPF/DKIM/DMARC misconfigurations, MX record errors, domain-level email routing, blacklist removal, and mail server certificate problems.",
    responseTime: "< 2 hours",
    resolutionTime: "2–6 hours",
    accent: "violet",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    id: "vpn-remote",
    category: "Cloud & Networking",
    name: "VPN & Remote Access",
    desc: "WireGuard, OpenVPN, and Cisco AnyConnect setup, site-to-site tunnels, split-tunnelling, remote desktop (RDP/SSH) access hardening, and jump-server configuration.",
    responseTime: "< 2 hours",
    resolutionTime: "3–6 hours",
    accent: "emerald",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    id: "network",
    category: "Cloud & Networking",
    name: "Network Troubleshooting",
    desc: "Diagnose and resolve LAN/WAN connectivity, router and managed-switch issues, VLAN configuration, bandwidth bottlenecks, packet loss, and firewall rule conflicts.",
    responseTime: "< 2 hours",
    resolutionTime: "2–5 hours",
    accent: "sky",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
  },
  {
    id: "database",
    category: "Data & Security",
    name: "Database Administration",
    desc: "MySQL, PostgreSQL, MongoDB, and Redis setup, query optimisation, slow-query analysis, backup scheduling, replication configuration, and disaster-recovery planning.",
    responseTime: "< 2 hours",
    resolutionTime: "4–12 hours",
    accent: "amber",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    id: "cloud",
    category: "Server & Infrastructure",
    name: "Cloud Infrastructure",
    desc: "AWS, Azure, and GCP instance provisioning, IAM policy setup, cost-optimisation reviews, auto-scaling groups, load balancer config, and multi-region architecture guidance.",
    responseTime: "< 2 hours",
    resolutionTime: "4–10 hours",
    accent: "cyan",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
  {
    id: "backup",
    category: "Server & Infrastructure",
    name: "Backup & Disaster Recovery",
    desc: "Automated backup strategy design, offsite replication (S3, Backblaze, Wasabi), RTO/RPO target planning, restoration drills, and business-continuity documentation.",
    responseTime: "< 2 hours",
    resolutionTime: "4–8 hours",
    accent: "orange",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    id: "security",
    category: "Data & Security",
    name: "Security Incident Response",
    desc: "Rapid triage for suspected breaches, malware removal, access-log forensics, compromised credential containment, server hardening, and post-incident compliance reporting.",
    responseTime: "< 1 hour",
    resolutionTime: "6–24 hours",
    accent: "rose",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    id: "web-hosting",
    category: "Web & Hosting",
    name: "Website & Hosting Issues",
    desc: "Diagnose and fix downtime, nginx/Apache misconfigurations, SSL/TLS certificate renewal, cPanel/WHM issues, WordPress performance and plugin conflicts, and CDN setup.",
    responseTime: "< 2 hours",
    resolutionTime: "2–6 hours",
    accent: "teal",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
];

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
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">First Response</p>
          <p className="text-sm font-black text-slate-800">{service.responseTime}</p>
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Resolution</p>
          <p className="text-sm font-black text-slate-800">{service.resolutionTime}</p>
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
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto mb-8">
            10 specialisations. Verified engineers. Pay only when your problem is resolved.
            Transparent fixed pricing on every ticket.
          </p>

          {/* Hero stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              { value: "10+",  label: "IT Specialisations" },
              { value: "< 2h", label: "First Response SLA" },
              { value: "₹299", label: "Consulting Fee" },
              { value: "0",    label: "Hidden Fees" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
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
          <p className="text-sm text-slate-400 font-medium mb-6">
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
              <p className="text-slate-400 text-lg font-medium">No services in this category.</p>
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
                desc: "Describe your issue and pay the ₹299 consulting fee to activate your ticket and SLA.",
                color: "text-indigo-600",
              },
              {
                step: "02",
                title: "Engineer assigned",
                desc: "A verified specialist picks up your ticket within 2 hours and starts working on a resolution.",
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
