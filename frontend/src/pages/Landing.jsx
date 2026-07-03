import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import LandingFooter from "../components/layout/LandingFooter";
import Header from "../components/layout/Header";
import { SERVICES, ACCENTS } from "../data/services";

// ── Animation variants ────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.5 } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.09 } },
};
const staggerFast = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

function Reveal({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────
function SectionBadge({ children, light = false }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                      uppercase tracking-widest mb-4
                      ${light
                        ? "bg-white/10 border border-white/20 text-indigo-200"
                        : "bg-indigo-50 border border-indigo-100 text-indigo-600"}`}>
      {children}
    </span>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left bg-white hover:bg-slate-50 transition-colors"
        aria-expanded={open}>
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden">
            <div className="px-6 pb-5 bg-white border-t border-slate-100">
              <p className="text-base text-slate-500 leading-relaxed pt-4">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════════

const TRUST_BAR = [
  { label: "Verified IT Specialists" },
  { label: "Transparent Fixed Pricing" },
  { label: "Priority Consultation Response" },
  { label: "Real-Time Ticket Tracking" },
  { label: "Enterprise Grade Security" },
];

const FEATURED = SERVICES.filter((s) => s.featured);


const PROCESS_STEPS = [
  {
    step: "01", title: "Submit Your Issue",
    body: "Describe your IT problem in plain English — no jargon needed. Select service type, severity, and attach screenshots in under 2 minutes.",
    color: "bg-indigo-600", ring: "ring-indigo-200",
    icon: <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>,
  },
  {
    step: "02", title: "Support Agent Contacts You",
    body: "A Support Agent contacts you within your chosen response window, understands your issue, and assigns the right engineer.",
    color: "bg-violet-600", ring: "ring-violet-200",
    icon: <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  },
  {
    step: "03", title: "Issue Resolved",
    body: "Work directly with your engineer through the ticket. Real-time updates at every stage — 7-stage tracking so you always know where things stand.",
    color: "bg-emerald-600", ring: "ring-emerald-200",
    icon: <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  },
  {
    step: "04", title: "Confirm & Close",
    body: "Confirm the fix and complete payment — only after your issue is fully resolved. Full payment history and billing records are available from your dashboard.",
    color: "bg-amber-500", ring: "ring-amber-200",
    icon: <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
  },
];

const TRUST_CARDS = [
  {
    title: "Verified Specialists",
    desc: "Every engineer passes skills assessment + identity verification before listing.",
    color: "text-indigo-600", bg: "bg-indigo-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  },
  {
    title: "Priority Consultation Response",
    desc: "Your Support Agent contacts you within your chosen response window (30 min – 4 hrs). If the consultation doesn't begin in time, your consulting fee is automatically refunded.",
    color: "text-emerald-600", bg: "bg-emerald-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    title: "Real-Time Tracking",
    desc: "7-stage ticket lifecycle with notifications at every status change.",
    color: "text-sky-600", bg: "bg-sky-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
  },
  {
    title: "Business-First Billing",
    desc: "Transparent pricing with no hidden charges. Full payment history and billing records available from your dashboard at any time.",
    color: "text-amber-600", bg: "bg-amber-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    title: "Escalation Support",
    desc: "If the first engineer can't resolve it, the ticket escalates to a senior specialist automatically.",
    color: "text-violet-600", bg: "bg-violet-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    title: "Enterprise Security",
    desc: "Role-based access control. Ticket data is visible only to the assigned engineer.",
    color: "text-rose-600", bg: "bg-rose-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
  },
];

const SLA_METRICS = [
  { label: "Consultation Response", value: "30 min – 4 hrs", sub: "Based on your priority — refunded if missed", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
  { label: "Status Updates", value: "Real-Time", sub: "Notifications at every step", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  { label: "Ticket Tracking", value: "24/7 Access", sub: "Dashboard always available", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
  { label: "Payment Protection", value: "Transparent", sub: "Pay resolution fee only after fix confirmed", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
];

const RECENT_ACTIVITY = [
  { issue: "Linux server performance degradation resolved", service: "Linux", time: "23 mins ago", severity: "High" },
  { issue: "VMware ESXi host stability restored after PSOD", service: "VMware", time: "1 hr ago", severity: "Medium" },
  { issue: "Windows Active Directory replication error fixed", service: "Windows", time: "2 hrs ago", severity: "High" },
  { issue: "OS patch rollout completed across 40 Linux nodes", service: "Patching", time: "3 hrs ago", severity: "Medium" },
  { issue: "Security hardening applied — CIS Level 1 baseline", service: "Security", time: "4 hrs ago", severity: "Low" },
  { issue: "Desktop driver conflict resolved, user unblocked", service: "Desktop", time: "5 hrs ago", severity: "Medium" },
  { issue: "SAP Basis transport request failure resolved", service: "SAP", time: "6 hrs ago", severity: "High" },
];

const ENGINEERS = [
  {
    name: "Arjun Kapoor",
    spec: "Linux Specialist",
    gradient: "from-orange-500 to-amber-500",
    initials: "AK",
    skills: ["RHEL", "Ubuntu", "Nginx", "Docker"],
  },
  {
    name: "Preethi Rajan",
    spec: "Windows Administrator",
    gradient: "from-blue-500 to-indigo-500",
    initials: "PR",
    skills: ["AD", "Group Policy", "Hyper-V", "RDS"],
  },
  {
    name: "Vikram Nair",
    spec: "VMware Specialist",
    gradient: "from-sky-500 to-teal-500",
    initials: "VN",
    skills: ["ESXi", "vSphere", "vSAN", "NSX"],
  },
  {
    name: "Sneha Kulkarni",
    spec: "SAP Basis Consultant",
    gradient: "from-purple-500 to-violet-600",
    initials: "SK",
    skills: ["SAP Basis", "TR Management", "HANA", "SM21"],
  },
  {
    name: "Rahul Mathur",
    spec: "Security Hardening Expert",
    gradient: "from-rose-500 to-pink-600",
    initials: "RM",
    skills: ["CIS Benchmarks", "VAPT", "ISO 27001", "SELinux"],
  },
];

const HELP_TOPICS = [
  {
    title: "How Billing Works",
    desc: "Consulting fee, resolution fee, refunds explained",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100",
  },
  {
    title: "Refund Policy",
    desc: "When and how refunds are processed automatically",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>,
    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
  },
  {
    title: "Engineer Assignment",
    desc: "How engineers are vetted and matched to your ticket",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100",
  },
  {
    title: "Ticket Lifecycle",
    desc: "7 stages from creation to resolution — what to expect",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
    color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100",
  },
  {
    title: "Contact Support",
    desc: "Reach our team via email, phone, or live chat",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>,
    color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100",
  },
];


const FAQ_ITEMS = [
  {
    q: "How does the pricing work?",
    a: "You pay a flat ₹299 consulting fee when opening a ticket. This covers the Support Agent consultation, diagnosis, and engineer assignment. It is fully refunded if the consultation doesn't begin within 4 hours. The resolution fee (₹499–₹1,999) is only charged after your issue is completely fixed.",
  },
  {
    q: "How are engineers verified?",
    a: "All freelancers complete a skills assessment, identity check, and supervised trial before listing. Their ratings, completion history, and response times are monitored continuously.",
  },
  {
    q: "How fast will a Support Agent contact me?",
    a: "Your Support Agent contacts you within your chosen response window: Critical (30 min), High (1 hr), Medium (2 hrs), Low (4 hrs). You get notifications at every status change. If the consultation doesn't begin within your window, the consulting fee is automatically refunded.",
  },
  {
    q: "Can I specify which type of engineer I need?",
    a: "Yes. When raising a ticket, you select the service type — Linux, Windows, VMware, SAP Basis, Security, Desktop Support, and others. ResolveHQ routes your ticket to a specialist with proven expertise in that area.",
  },
  {
    q: "What if my issue isn't resolved?",
    a: "You are never charged the resolution fee unless the issue is fully fixed and you confirm it. If an engineer cannot resolve the problem, the ticket is reassigned or escalated at no extra charge.",
  },
  {
    q: "Is my company data safe?",
    a: "ResolveHQ uses strict role-based access. Only the assigned engineer can view your ticket details. Customer data is never shared across accounts.",
  },
];

const HERO_TRUST = [
  {
    label: "Windows Provisioning",
    value: "Windows Server, Active Directory, DNS, GPO",
    bg: "bg-indigo-500/15",
    color: "text-indigo-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    label: "Linux Provisioning",
    value: "Server setup, package mgmt, systemd, automation",
    bg: "bg-amber-500/15",
    color: "text-amber-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    label: "Desktop Support",
    value: "Remote troubleshooting, drivers, antivirus",
    bg: "bg-orange-500/15",
    color: "text-orange-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
  {
    label: "VMware / Hypervisor",
    value: "ESXi host mgmt, VM provisioning, storage",
    bg: "bg-sky-500/15",
    color: "text-sky-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v2.25a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V4.5A2.25 2.25 0 014.5 2.25h10.5m5.25 5.25V2.25m0 5.25h-5.25m5.25 0L12 12" />
      </svg>
    ),
  },
  {
    label: "OS Patching",
    value: "Managed patching for Windows and Linux nodes",
    bg: "bg-teal-500/15",
    color: "text-teal-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Security Hardening",
    value: "CIS baseline, access controls, vuln remediation",
    bg: "bg-rose-500/15",
    color: "text-rose-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
];

// ══════════════════════════════════════════════════════════════════
// SECTION 1: HERO — 2-column with compact trust panel
// ══════════════════════════════════════════════════════════════════
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 px-4 sm:px-6 py-16 sm:py-20">

      {/* ── Background decorations ── */}
      <motion.div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)" }}
        animate={{ x: [0, 30, -15, 0], y: [0, -20, 25, 0], scale: [1, 1.08, 0.94, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
        animate={{ x: [0, -25, 20, 0], y: [0, 25, -20, 0], scale: [1, 0.92, 1.06, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-16 items-center">

          {/* ── LEFT: headline + CTAs + stats ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2.5 bg-white/8 border border-white/12
                         text-indigo-300 text-xs font-semibold px-4 py-2 rounded-full mb-7"
            >
              <span className="relative flex w-2.5 h-2.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
              </span>
              Verified IT Engineers · 30-Min Support Consultation
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-[3.75rem] xl:text-[4.5rem] font-black text-white
                         leading-[1.04] tracking-tight mb-5"
            >
              Need Expert IT Support?<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)" }}
              >
                No Full-Time Hire Required.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.22 }}
              className="text-slate-300 text-lg sm:text-xl leading-relaxed mb-8 max-w-xl"
            >
              When your server goes down, Windows systems stop working, office
              computers have issues, or your IT infrastructure needs expert
              support — we connect you with a verified IT engineer for fast
              remote troubleshooting.{" "}
              Speak with our support team in as little as 30 minutes. No
              retainers. No annual contracts. Pay only after your issue is resolved.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="flex flex-col sm:flex-row gap-3 mb-7"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/register/customer"
                  className="inline-flex items-center justify-center gap-2.5 bg-indigo-500 text-white
                             font-bold px-8 py-4 rounded-2xl hover:bg-indigo-400 active:bg-indigo-600
                             transition-colors text-base shadow-lg shadow-indigo-500/30">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Support Ticket
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <a href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 text-white/80 font-semibold
                             px-8 py-4 rounded-2xl border border-white/15 hover:bg-white/8
                             hover:text-white transition-all text-base">
                  How It Works
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </a>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              {["₹299 Flat Consulting Fee", "No Contracts", "4-Hour Refund Guarantee"].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-sm text-slate-400">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: Compact glass trust panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="bg-white/[0.06] backdrop-blur-sm border border-white/[0.10] rounded-3xl p-7">
              <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-white/8">
                <span className="relative flex w-2.5 h-2.5 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                  <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
                </span>
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">
                  Engineers Available Now
                </span>
              </div>

              <div className="space-y-3 mb-5">
                {HERO_TRUST.map((item) => (
                  <div key={item.label} className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm leading-tight">{item.label}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/8 pt-5 mb-5">
                <p className="text-slate-400 text-xs">Pay only after your issue is fixed</p>
              </div>

              <Link to="/register/customer"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500
                           text-white font-semibold py-3 px-5 rounded-xl transition-colors text-sm">
                Get Help Now
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 1B: PREMIUM SERVICES (immediately below how-it-works)
// ══════════════════════════════════════════════════════════════════
function PremiumServicesSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-12">
          <SectionBadge>Our Services</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            What Can We Solve For You?
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Expert engineers ready for the exact issues disrupting your business — from SAP Basis to security hardening.
          </p>
        </Reveal>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}
        >
          {FEATURED.map((svc) => {
            const a = ACCENTS[svc.accent] ?? ACCENTS.indigo;
            return (
              <motion.div
                key={svc.id} variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`group bg-white border ${a.border} ${a.ring} rounded-2xl p-6 flex flex-col
                            hover:shadow-xl ${a.shadow} transition-all duration-300`}
                style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.06)" }}
              >
                <div className={`w-12 h-12 ${a.bg} rounded-xl flex items-center justify-center mb-5
                                 ${a.text} group-hover:scale-110 transition-transform duration-200 shrink-0`}>
                  {svc.icon}
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">{svc.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{svc.desc}</p>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {svc.issues.slice(0, 3).map((issue) => (
                    <li key={issue} className="flex items-start gap-2">
                      <svg className={`w-3.5 h-3.5 ${a.text} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-xs text-slate-600 leading-relaxed">{issue}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register/customer"
                  className={`mt-auto inline-flex items-center gap-1.5 text-sm font-semibold ${a.text}
                              group-hover:gap-2.5 transition-all duration-200`}>
                  Get Help
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <Reveal delay={0.2} className="mt-10 text-center">
          <Link to="/services"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            View All Services
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 2: WHY BUSINESSES CHOOSE RESOLVEHQ
// ══════════════════════════════════════════════════════════════════
const WHY_CHOOSE = [
  {
    title: "No Annual Contracts",
    desc: "Use ResolveHQ when you need it. No commitments, no lock-in, no automatic renewals — ever.",
    color: "text-indigo-600", bg: "bg-indigo-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "Pay Per Issue",
    desc: "₹299 consulting fee to open a ticket. Resolution fee charged only after your issue is completely fixed and confirmed.",
    color: "text-emerald-600", bg: "bg-emerald-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Verified Engineers",
    desc: "Every specialist on ResolveHQ completes identity verification, a skills assessment, and a supervised trial before listing.",
    color: "text-violet-600", bg: "bg-violet-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Priority Consultation",
    desc: "Your Support Agent contacts you within your chosen response window (30 min – 4 hrs). If the consultation doesn't begin in time, your consulting fee is refunded.",
    color: "text-sky-600", bg: "bg-sky-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "24/7 Dashboard Access",
    desc: "Track every ticket, engineer assignment, and payment in real time. Full account visibility from any device, at any time.",
    color: "text-amber-600", bg: "bg-amber-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    title: "Transparent Pricing",
    desc: "See the resolution fee before you confirm. No hidden charges, no post-resolution surprises, no ambiguous billing.",
    color: "text-rose-600", bg: "bg-rose-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function WhyChooseSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-12">
          <SectionBadge>Why ResolveHQ</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Why Businesses Choose ResolveHQ
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Built for Indian SMBs — no bloated contracts, no hidden fees, no waiting weeks for an IT engineer.
          </p>
        </Reveal>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
        >
          {WHY_CHOOSE.map((card) => (
            <motion.div key={card.title} variants={fadeUp}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="bg-white border border-slate-100 rounded-2xl p-6 flex items-start gap-4"
              style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.06)" }}>
              <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                {card.icon}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 3: TRUST BAR
// ══════════════════════════════════════════════════════════════════
function TrustBarSection() {
  return (
    <section className="bg-white border-b border-slate-100 py-5 px-4 sm:px-6">
      <motion.div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
        variants={staggerFast} initial="hidden" whileInView="show" viewport={{ once: true }}>
        {TRUST_BAR.map(({ label }) => (
          <motion.div key={label} variants={fadeIn} className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 3: POPULAR PROBLEMS WE SOLVE
// ══════════════════════════════════════════════════════════════════
function PopularProblemsSection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Common IT Crises</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Popular Problems We Solve
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Get expert help for the IT issues that disrupt business operations.
          </p>
        </Reveal>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          {FEATURED.map((p) => {
            const a = ACCENTS[p.accent] ?? ACCENTS.indigo;
            return (
              <motion.div key={p.id} variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`group bg-white border ${a.border} rounded-2xl p-5 cursor-default
                           hover:shadow-xl ${a.glow} transition-all duration-300`}
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <div className={`w-12 h-12 ${a.bg} rounded-xl flex items-center justify-center mb-4
                                 ${a.text} group-hover:scale-110 transition-transform duration-200`}>
                  {p.icon}
                </div>
                <h3 className="font-bold text-slate-900 mb-1.5 text-sm leading-snug">{p.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{p.shortDesc}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Engineers Available</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <Reveal delay={0.2} className="mt-10 text-center">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link to="/register/customer"
              className="inline-flex items-center gap-2.5 bg-indigo-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-colors text-base shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Open a Ticket Now
            </Link>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 4: HOW RESOLVEHQ WORKS (4 steps)
// ══════════════════════════════════════════════════════════════════
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 px-4 sm:px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-12">
          <SectionBadge>Simple Process</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Get Help in 4 Simple Steps
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            From submitting your issue to a resolved, paid ticket — no ambiguity, no hidden fees, no surprises.
          </p>
        </Reveal>

        {/* Desktop: horizontal 4-step flow */}
        <div className="hidden sm:block">
          <motion.div className="grid grid-cols-4 gap-6"
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {PROCESS_STEPS.map((step, i) => (
              <motion.div key={step.step} variants={fadeUp} className="relative flex flex-col items-center text-center">
                {/* Connector arrow */}
                {i < PROCESS_STEPS.length - 1 && (
                  <div className="absolute top-7 left-[calc(50%+2.5rem)] right-0 flex items-center pointer-events-none">
                    <div className="flex-1 h-px bg-slate-200" />
                    <svg className="w-4 h-4 text-slate-500 shrink-0 -mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                )}
                <div className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg ring-4 ${step.ring} relative z-10`}>
                  {step.icon}
                </div>
                <span className="text-[10px] font-black text-slate-500 tracking-widest mb-2">STEP {step.step}</span>
                <h3 className="text-base font-black text-slate-900 mb-2 leading-tight">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Mobile: vertical list */}
        <div className="sm:hidden space-y-5">
          {PROCESS_STEPS.map((step, i) => (
            <Reveal key={step.step}>
              <div className="flex items-start gap-4">
                <div className="relative shrink-0 flex flex-col items-center">
                  <div className={`w-12 h-12 ${step.color} rounded-xl flex items-center justify-center shadow-md ring-4 ${step.ring}`}>
                    {step.icon}
                  </div>
                  {i < PROCESS_STEPS.length - 1 && (
                    <div className="w-px h-6 bg-slate-200 mt-2" />
                  )}
                </div>
                <div className="flex-1 pt-1.5">
                  <span className="text-[10px] font-black text-slate-500 tracking-widest">STEP {step.step}</span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5 mb-1">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 6: LIVE PLATFORM PREVIEW
// ══════════════════════════════════════════════════════════════════
function PlatformPreviewSection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-slate-50 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Platform Preview</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            See ResolveHQ In Action
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Tickets, engineer assignments, status updates, and billing history — all from a unified dashboard.
          </p>
        </Reveal>

        <Reveal>
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white"
            style={{ boxShadow: "0 24px 64px -8px rgb(0 0 0 / 0.18), 0 8px 24px -4px rgb(0 0 0 / 0.1)" }}>
            {/* Browser bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 max-w-xs mx-auto">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 text-center">
                  app.resolvehq.in/dashboard
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="hidden sm:block text-[10px]">Secure</span>
              </div>
            </div>

            {/* Dashboard mock */}
            <div className="flex h-[480px] overflow-hidden">
              {/* Sidebar */}
              <div className="w-52 bg-white border-r border-slate-100 p-3 shrink-0 hidden sm:flex flex-col gap-1">
                <div className="h-11 flex items-center gap-2.5 px-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 shrink-0" />
                  <div className="space-y-1">
                    <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
                    <div className="h-1.5 w-14 bg-slate-300 rounded-full" />
                  </div>
                </div>
                {[
                  { label: "Dashboard", active: true, w: "w-16" },
                  { label: "Tickets", active: false, w: "w-12" },
                  { label: "Billing", active: false, w: "w-14" },
                  { label: "Analytics", active: false, w: "w-18" },
                  { label: "Help Center", active: false, w: "w-20" },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${item.active ? "bg-indigo-600" : ""}`}>
                    <div className={`w-4 h-4 rounded ${item.active ? "bg-white/40" : "bg-slate-200"} shrink-0`} />
                    <div className={`h-2 ${item.w} rounded-full ${item.active ? "bg-white/70" : "bg-slate-200"}`} />
                  </div>
                ))}
              </div>

              {/* Main */}
              <div className="flex-1 bg-slate-50 p-5 overflow-hidden">
                <div className="mb-4">
                  <div className="h-4 w-52 bg-slate-800 rounded-full mb-2" />
                  <div className="h-2.5 w-36 bg-slate-300 rounded-full" />
                </div>
                <div className="flex gap-3 mb-5 overflow-hidden">
                  {["Verified Engineers", "Priority Consultation", "Refund Guarantee"].map((label) => (
                    <div key={label} className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-xl px-3 py-1.5 shrink-0">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                      <div className="h-2 w-20 bg-slate-300 rounded-full" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { num: "12", color: "text-indigo-600", border: "border-indigo-100" },
                    { num: "4",  color: "text-blue-600",   border: "border-blue-100"   },
                    { num: "3",  color: "text-amber-600",  border: "border-amber-100"  },
                    { num: "5",  color: "text-emerald-600",border: "border-emerald-100"},
                  ].map((card, i) => (
                    <div key={i} className={`bg-white border ${card.border} rounded-xl px-3 py-2.5`}>
                      <div className="h-1.5 w-10 bg-slate-200 rounded-full mb-2" />
                      <div className={`text-xl font-black ${card.color} leading-none`}>{card.num}</div>
                      <div className="h-1.5 w-14 bg-slate-200 rounded-full mt-1.5" />
                    </div>
                  ))}
                </div>
                {/* Active ticket card */}
                <div className="bg-white border border-indigo-100 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <div className="h-2.5 w-32 bg-slate-300 rounded-full" />
                    </div>
                    <div className="h-5 w-20 bg-amber-100 rounded-full" />
                  </div>
                  <div className="h-2 w-48 bg-slate-100 rounded-full mb-2" />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 shrink-0" />
                    <div className="h-2 w-24 bg-slate-200 rounded-full" />
                    <div className="h-2 w-16 bg-emerald-100 rounded-full" />
                  </div>
                </div>
                {/* Ticket list */}
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
                    <div className="h-6 w-20 bg-indigo-600 rounded-lg" />
                  </div>
                  {[
                    { status: "bg-amber-400", width: "w-32" },
                    { status: "bg-indigo-400", width: "w-44" },
                    { status: "bg-emerald-400", width: "w-28" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                      <div className={`w-2 h-2 rounded-full ${row.status} shrink-0`} />
                      <div className={`h-2.5 ${row.width} bg-slate-200 rounded-full flex-1`} />
                      <div className="h-5 w-16 bg-slate-100 rounded-lg shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel */}
              <div className="w-56 bg-white border-l border-slate-100 p-4 shrink-0 hidden lg:block space-y-4">
                {/* Notification center */}
                <div className="bg-white border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <div className="h-2 w-24 bg-slate-800 rounded-full" />
                    <div className="h-4 w-4 rounded-full bg-rose-100 ml-auto" />
                  </div>
                  {["Engineer assigned", "Ticket updated", "Ticket resolved"].map((s) => (
                    <div key={s} className="flex items-center gap-2 py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                    </div>
                  ))}
                </div>
                {/* Resolution status */}
                <div className="bg-white border border-emerald-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <div className="h-2 w-20 bg-slate-300 rounded-full" />
                  </div>
                  <div className="h-7 bg-emerald-50 rounded-lg mb-2" />
                  <div className="h-1.5 w-32 bg-slate-200 rounded-full" />
                </div>
                {/* Engineer card */}
                <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2">
                  <div className="h-2 w-24 bg-slate-800 rounded-full mb-3" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-200 shrink-0" />
                    <div>
                      <div className="h-2.5 w-20 bg-slate-800 rounded-full mb-1" />
                      <div className="h-1.5 w-14 bg-slate-200 rounded-full" />
                    </div>
                  </div>
                  <div className="h-6 bg-indigo-600 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
          {[
            { title: "Active Ticket View", desc: "Live engineer assignment with real-time status tracker" },
            { title: "Notification Center", desc: "Instant alerts for every ticket status change" },
            { title: "Billing History", desc: "Full payment history and billing records accessible at any time" },
          ].map((f) => (
            <motion.div key={f.title} variants={fadeUp}
              className="flex items-start gap-4 bg-white border border-slate-100 rounded-2xl p-5"
              style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 mb-1">{f.title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 7: TRUST & SECURITY
// ══════════════════════════════════════════════════════════════════
function TrustSecuritySection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Security First</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Built For Business-Critical Support
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Every feature is designed to reduce uncertainty, protect your data, and build trust.
          </p>
        </Reveal>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
          {TRUST_CARDS.map((card) => (
            <motion.div key={card.title} variants={fadeUp}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="bg-white border border-slate-100 rounded-2xl p-6 cursor-default"
              style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.06)" }}>
              <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center mb-5 ${card.color}`}>
                {card.icon}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 8: SERVICE COMMITMENTS / SLA
// ══════════════════════════════════════════════════════════════════
function SLASection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Our Commitments</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Service Commitments
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Clear guarantees you can hold us to — not marketing fluff.
          </p>
        </Reveal>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {SLA_METRICS.map((m) => (
            <motion.div key={m.label} variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`bg-white border ${m.border} rounded-2xl p-6 text-center cursor-default`}
              style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.06)" }}>
              <div className={`w-12 h-12 ${m.bg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                <svg className={`w-6 h-6 ${m.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{m.label}</p>
              <p className={`text-2xl font-black ${m.color} mb-2 leading-tight`}>{m.value}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{m.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 9: RECENT SUPPORT ACTIVITY
// ══════════════════════════════════════════════════════════════════
const SEVERITY_COLORS = {
  High:   { dot: "bg-rose-500",   badge: "bg-rose-50 text-rose-600 border-rose-100"   },
  Medium: { dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-600 border-amber-100"  },
  Low:    { dot: "bg-slate-300",  badge: "bg-slate-50 text-slate-500 border-slate-100" },
};

function RecentActivitySection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Live Feed</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Recent Issues We Solve Daily
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            A live feed of resolved tickets across the platform. Examples are illustrative.
          </p>
        </Reveal>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-px bg-slate-100" />

          <motion.div className="space-y-0"
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
            {RECENT_ACTIVITY.map((item, i) => {
              const sev = SEVERITY_COLORS[item.severity];
              return (
                <motion.div key={i} variants={fadeUp}
                  className="relative flex items-start gap-4 sm:gap-5 pl-12 sm:pl-14 py-4 group">
                  {/* Timeline dot */}
                  <div className={`absolute left-[10px] sm:left-[14px] top-[22px] w-3 h-3 rounded-full border-2 border-white ${sev.dot} shrink-0`} />

                  {/* Card */}
                  <div className="flex-1 bg-white border border-slate-100 rounded-2xl px-5 py-4
                                  group-hover:border-indigo-100 group-hover:shadow-md transition-all duration-200"
                    style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.05)" }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sev.badge}`}>
                            {item.severity} Priority
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {item.service}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{item.issue}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Resolved
                        </span>
                        <span className="text-[10px] text-slate-500">{item.time}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <Reveal delay={0.3} className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Activity examples are illustrative only and not from real accounts.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 10: ENGINEER TRUST / SPECIALIST CARDS
// ══════════════════════════════════════════════════════════════════
function EngineerSection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Verified Specialists</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Work With Verified Specialists
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Every engineer on ResolveHQ passes identity verification, skills assessment, and a supervised trial.
            Profiles below are representative examples.
          </p>
        </Reveal>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          {ENGINEERS.map((eng) => (
            <motion.div key={eng.name} variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="bg-white border border-slate-100 rounded-2xl p-5 text-center cursor-default"
              style={{ boxShadow: "0 2px 8px 0 rgb(0 0 0 / 0.07)" }}>
              {/* Avatar */}
              <div className="relative inline-flex mb-3">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${eng.gradient} flex items-center justify-center text-white font-black text-lg shadow-md`}>
                  {eng.initials}
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
              </div>

              {/* Info */}
              <p className="font-black text-slate-900 text-sm mb-0.5">{eng.name}</p>
              <div className="flex items-center justify-center gap-1 mb-3">
                <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                <p className="text-[11px] font-semibold text-indigo-600">{eng.spec}</p>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1 justify-center">
                {eng.skills.map((s) => (
                  <span key={s} className="text-[9px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <Reveal delay={0.2} className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Engineer profiles shown are representative examples only.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 11: HELP CENTER PREVIEW
// ══════════════════════════════════════════════════════════════════
function HelpCenterPreviewSection() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Self-Service</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Need Help?
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Browse our knowledge base for quick answers — or open a ticket for hands-on support.
          </p>
        </Reveal>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
          {HELP_TOPICS.map((t) => (
            <motion.div key={t.title} variants={fadeUp}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}>
              <Link to="/help-center"
                className={`flex items-start gap-4 bg-white border ${t.border} rounded-2xl p-5 block
                            hover:shadow-lg transition-all duration-200 cursor-pointer`}
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
                <div className={`w-11 h-11 ${t.bg} rounded-xl flex items-center justify-center shrink-0 ${t.color}`}>
                  {t.icon}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 mb-1">{t.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{t.desc}</p>
                </div>
                <svg className={`w-4 h-4 ${t.color} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <Reveal delay={0.2} className="mt-8 text-center">
          <Link to="/help-center"
            className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
            Browse Full Help Center
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 13: FREELANCER CTA
// ══════════════════════════════════════════════════════════════════
function FreelancerCTASection() {
  return (
    <section id="join-as-engineer" className="py-20 px-4 sm:px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="rounded-3xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #3b0764 0%, #5b21b6 50%, #7c3aed 100%)" }}>
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none opacity-10"
              style={{ background: "radial-gradient(circle, white, transparent)" }} />
            <div className="flex flex-col lg:flex-row items-center gap-10 px-8 sm:px-12 py-12">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-violet-100 text-xs font-semibold px-4 py-2 rounded-full mb-5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  For IT Professionals
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
                  Turn your IT expertise<br className="hidden sm:block" /> into income.
                </h2>
                <p className="text-violet-200 text-lg leading-relaxed mb-7 max-w-md">
                  Join ResolveHQ&apos;s vetted engineer network and help Indian businesses solve real-world IT challenges.
                </p>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/register/freelancer"
                    className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-7 py-3.5 rounded-xl hover:bg-violet-50 transition-colors text-base">
                    Join as Engineer
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </motion.div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3 w-full lg:w-auto">
                {[
                  "Flexible remote work",
                  "Build your reputation",
                  "Real engineering projects",
                  "Earnings per ticket resolved",
                ].map((b) => (
                  <div key={b} className="flex items-center gap-2.5 bg-white/8 border border-white/12 rounded-xl px-3.5 py-3">
                    <svg className="w-4 h-4 text-violet-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-sm font-medium text-white/90 leading-snug">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 14: FAQ
// ══════════════════════════════════════════════════════════════════
function FAQSection() {
  return (
    <section id="faq" className="py-16 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <Reveal className="text-center mb-12">
          <SectionBadge>Common Questions</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Frequently Asked
          </h2>
          <p className="text-lg text-slate-500">Everything you need to know before your first ticket.</p>
        </Reveal>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={item.q} delay={i * 0.04}>
              <FaqItem q={item.q} a={item.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 15: STRONG BOTTOM CTA
// ══════════════════════════════════════════════════════════════════
function BottomCTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-slate-950 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-64 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.22), transparent 70%)" }} />
      <motion.div className="absolute -bottom-24 right-0 w-96 h-96 rounded-full pointer-events-none opacity-10"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
        animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute -top-24 left-0 w-72 h-72 rounded-full pointer-events-none opacity-8"
        style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }}
        animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }} />

      <div className="relative max-w-3xl mx-auto text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/12 text-white/70 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Engineers available now
          </div>
          <h2 className="text-5xl sm:text-6xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            Ready To Resolve Your<br className="hidden sm:block" /> Next IT Issue?
          </h2>
          <p className="text-slate-400 text-xl mb-4 leading-relaxed max-w-xl mx-auto">
            Create a ticket and get connected with a verified IT specialist.
            Your Support Agent consultation begins within your chosen response window.
          </p>
          <p className="text-slate-500 text-sm mb-10">
            ₹299 consulting fee · Pay only when your issue is resolved · Consultation starts within your priority window
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register/customer"
                className="inline-flex items-center justify-center gap-2.5 bg-indigo-500 text-white font-bold px-9 py-4 rounded-2xl hover:bg-indigo-400 transition-colors text-base shadow-lg shadow-indigo-500/25">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Ticket
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 text-white/70 font-semibold px-9 py-4 rounded-2xl border border-white/15 hover:bg-white/8 hover:text-white transition-all text-base">
                Learn More
              </a>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════
export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* 1. Hero — value proposition + trust badges */}
        <HeroSection />
        {/* 2. How It Works — immediately answers "what happens next?" */}
        <HowItWorksSection />
        {/* 3. Premium Services — show exactly what problems we solve */}
        <PremiumServicesSection />
        {/* 4. Why Choose ResolveHQ — build trust before they scroll away */}
        <WhyChooseSection />
        {/* 5. Quick trust signals bar */}
        <TrustBarSection />
        {/* 6. Popular Problems — broad coverage proof */}
        <PopularProblemsSection />
        {/* 7. Platform Preview — show the actual product */}
        <PlatformPreviewSection />
        {/* 8. Trust & Security — deeper trust for enterprise buyers */}
        <TrustSecuritySection />
        {/* 9. SLA Commitments */}
        <SLASection />
        {/* 10. Recent Activity */}
        <RecentActivitySection />
        {/* 11. Engineer Profiles */}
        <EngineerSection />
        {/* 12. Help Center */}
        <HelpCenterPreviewSection />
        {/* 14. Freelancer CTA */}
        <FreelancerCTASection />
        {/* 15. FAQ */}
        <FAQSection />
        {/* 16. Bottom CTA */}
        <BottomCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
