import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import LandingFooter from "../components/layout/LandingFooter";
import Header from "../components/layout/Header";
import { CONTACT } from "../config/contact";

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
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Animated counter hook ─────────────────────────────────────────
function useCountUp(end, duration = 2, inView) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setCount(0);
    const start = Date.now();
    const ms = duration * 1000;
    let raf;
    const tick = () => {
      const pct = Math.min((Date.now() - start) / ms, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setCount(Math.round(eased * end));
      if (pct < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, inView]);
  return count;
}

// ── Data ──────────────────────────────────────────────────────────
const SERVICES = [
  {
    title: "Linux Server Support",
    desc: "RHEL, Ubuntu, Debian — setup, hardening, systemd & cron",
    color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "Windows Administration",
    desc: "Active Directory, DNS, Group Policy, RDP, file sharing",
    color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
  {
    title: "Microsoft 365",
    desc: "Exchange Online, Teams, SharePoint, OneDrive admin",
    color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: "Networking & VPN",
    desc: "LAN/WAN, firewall setup, VPN config, routing & switching",
    color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
  },
  {
    title: "Cloud Infrastructure",
    desc: "AWS, Azure, GCP — deployment, cost optimisation, migrations",
    color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
  {
    title: "Cybersecurity",
    desc: "Firewall audits, vulnerability scans, compliance, hardening",
    color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Backup & Recovery",
    desc: "Data backup, disaster recovery planning, snapshot management",
    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    title: "Email Systems",
    desc: "Mail server setup, spam filtering, DKIM/SPF/DMARC config",
    color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    title: "Database Management",
    desc: "MySQL, PostgreSQL, MSSQL — tuning, backup, replication",
    color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
  },
  {
    title: "DevOps & CI/CD",
    desc: "Docker, Kubernetes, Jenkins, GitLab CI, GitHub Actions",
    color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: "Virtualization",
    desc: "VMware ESXi, Hyper-V — snapshots, vMotion, migrations",
    color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
      </svg>
    ),
  },
  {
    title: "Performance Optimisation",
    desc: "System profiling, bottleneck analysis, tuning & monitoring",
    color: "text-green-600", bg: "bg-green-50", border: "border-green-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const STATS = [
  { prefix: "",   value: 250, suffix: "+",    label: "Issues Resolved",        sub: "and counting" },
  { prefix: "",   value: 98,  suffix: "%",    label: "Customer Satisfaction",   sub: "CSAT score" },
  { prefix: "< ", value: 2,   suffix: " hrs", label: "Avg Response Time",       sub: "first engineer response" },
  { prefix: "",   value: 50,  suffix: "+",    label: "Verified Specialists",    sub: "across India" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create a Ticket",
    body: "Describe your IT problem in under 2 minutes. Select service type, severity, and attach screenshots.",
    color: "bg-indigo-600", ring: "ring-indigo-200", text: "text-indigo-600", bg: "bg-indigo-50",
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Pay Consultation Fee",
    body: "A flat ₹299 consulting fee via Razorpay. Fully refunded if no engineer accepts within 2 hours.",
    color: "bg-violet-600", ring: "ring-violet-200", text: "text-violet-600", bg: "bg-violet-50",
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Engineer Assigned",
    body: "A vetted engineer matching your service type is assigned. You're notified instantly and can chat in real time.",
    color: "bg-emerald-600", ring: "ring-emerald-200", text: "text-emerald-600", bg: "bg-emerald-50",
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Issue Resolved",
    body: "Confirm resolution, rate your experience, and download your GST invoice automatically.",
    color: "bg-amber-500", ring: "ring-amber-200", text: "text-amber-600", bg: "bg-amber-50",
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" />
      </svg>
    ),
  },
];

const WHY_FEATURES = [
  {
    title: "Transparent Pricing",
    desc: "Flat consulting fee upfront. Resolution fee only when the issue is fully fixed. No hidden charges, ever.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "text-amber-400",
  },
  {
    title: "Expert Engineers",
    desc: "Every engineer is screened for skills, identity, and professionalism before being listed on the platform.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    color: "text-indigo-400",
  },
  {
    title: "2-Hour Response SLA",
    desc: "Industry-leading response guarantee. If no engineer responds within 2 hours, your fee is refunded automatically.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "text-emerald-400",
  },
  {
    title: "Secure Communication",
    desc: "All ticket data is role-isolated. Only your assigned engineer can view your issue details.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    color: "text-violet-400",
  },
  {
    title: "Real-Time Tracking",
    desc: "Track every status change from Assigned → In Progress → Resolved. Full activity log on every ticket.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    color: "text-sky-400",
  },
  {
    title: "GST-Compliant Invoice",
    desc: "Every payment auto-generates a proper GST tax invoice. Perfect for business accounts and audits.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    color: "text-rose-400",
  },
];

const TESTIMONIALS = [
  {
    name: "Rajesh Mehta",
    title: "IT Manager",
    company: "Mehta Textiles Pvt. Ltd., Surat",
    body: "We had AD sync failures every other week. ResolveHQ assigned an engineer who fixed the Windows Server issue in under 3 hours. Worth every rupee — and the GST invoice made reimbursement easy.",
    rating: 5,
    initials: "RM",
    gradient: "from-indigo-600 to-violet-600",
  },
  {
    name: "Priya Nair",
    title: "Founder & CA",
    company: "Nair & Associates, Chennai",
    body: "Our Tally server kept crashing before month-end closing. I created a ticket at 11 PM and an engineer was on it within the hour. No subscriptions, no surprises. Exactly what a small firm needs.",
    rating: 5,
    initials: "PN",
    gradient: "from-violet-600 to-purple-700",
  },
  {
    name: "Suresh Joshi",
    title: "Operations Head",
    company: "Joshi Auto Parts, Pune",
    body: "Finally an IT support service that's transparent about pricing. You know the fee before you start. We've resolved 12 tickets — Linux, security, VMware — everything done on time with a proper invoice.",
    rating: 5,
    initials: "SJ",
    gradient: "from-emerald-600 to-teal-600",
  },
  {
    name: "Kavita Reddy",
    title: "CEO",
    company: "Reddy Pharma Distributors, Hyderabad",
    body: "Our ERP went down on a Friday evening. ResolveHQ had a SAP Basis engineer on the call within 90 minutes. We were back up before 9 PM. I would not trust anyone else for critical infrastructure.",
    rating: 5,
    initials: "KR",
    gradient: "from-rose-600 to-pink-600",
  },
];

const TRUST_BAR = [
  { label: "Verified IT Specialists" },
  { label: "Secure Payments via Razorpay" },
  { label: "2-Hour Response SLA" },
  { label: "Real-Time Ticket Tracking" },
  { label: "Enterprise Grade Security" },
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
    a: "ResolveHQ uses strict role-based access. Only the assigned engineer can view your ticket details. Customer data is never shared across accounts.",
  },
];

// ── Shared components ─────────────────────────────────────────────
function SectionBadge({ children }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                     text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-4">
      {children}
    </span>
  );
}

function StarRow({ count = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < count ? "text-amber-400" : "text-slate-200"}`}
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
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left
                   bg-white hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 bg-white border-t border-slate-100">
              <p className="text-base text-slate-500 leading-relaxed pt-4">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Section 1: Hero ───────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 pt-16 pb-28 px-4 sm:px-6">
      {/* Animated gradient blobs */}
      <motion.div
        className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)" }}
        animate={{ x: [0, 30, -15, 0], y: [0, -20, 25, 0], scale: [1, 1.08, 0.94, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
        animate={{ x: [0, -25, 20, 0], y: [0, 25, -20, 0], scale: [1, 0.92, 1.06, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }}
        animate={{ scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2.5 bg-white/8 border border-white/12
                     text-indigo-300 text-xs font-semibold px-4 py-2 rounded-full mb-8"
        >
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0" />
          Trusted by 500+ Indian SMBs · Engineers online now
        </motion.div>

        {/* Headline */}
        <motion.variants
          variants={stagger}
          initial="hidden"
          animate="show"
        />
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05]
                     tracking-tight mb-7"
        >
          Enterprise IT Support<br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)" }}>
            {" "}Without Enterprise Overhead
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
          className="text-slate-400 text-lg sm:text-xl lg:text-2xl mb-10 max-w-3xl mx-auto leading-relaxed"
        >
          Get expert engineers on demand. Resolve critical IT issues faster with
          transparent pricing, secure payments, and real-time progress tracking.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.34 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/register/customer"
              className="inline-flex items-center justify-center gap-2.5 bg-indigo-500 text-white
                         font-bold px-8 py-4 rounded-2xl hover:bg-indigo-400 transition-colors
                         text-base shadow-lg shadow-indigo-500/25"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Ticket — Free
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 text-white/80 font-semibold
                         px-8 py-4 rounded-2xl border border-white/15 hover:bg-white/8
                         hover:text-white transition-all text-base"
            >
              How It Works
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </a>
          </motion.div>
        </motion.div>

        {/* Quick stats strip at bottom of hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-10 border-t border-white/10 max-w-3xl mx-auto"
        >
          {[
            { value: "500+", label: "SMBs served" },
            { value: "₹299", label: "flat consulting fee" },
            { value: "< 2 hrs", label: "first response" },
            { value: "GST", label: "invoice on every ticket" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section 2: Trust Bar ──────────────────────────────────────────
function TrustBarSection() {
  return (
    <section className="bg-white border-b border-slate-100 py-5 px-4 sm:px-6">
      <motion.div
        className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
        variants={staggerFast}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
      >
        {TRUST_BAR.map(({ label }) => (
          <motion.div
            key={label}
            variants={fadeIn}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

// ── Section 3: Animated Stats ─────────────────────────────────────
function StatsCounter({ stat, inView }) {
  const count = useCountUp(stat.value, 2.2, inView);
  return (
    <div className="text-center px-4">
      <p className="text-5xl sm:text-6xl font-black text-white leading-none">
        {stat.prefix}{count}{stat.suffix}
      </p>
      <p className="text-lg font-semibold text-indigo-200 mt-3">{stat.label}</p>
      <p className="text-sm text-indigo-300/70 mt-1">{stat.sub}</p>
    </div>
  );
}

function StatsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section
      ref={ref}
      className="py-24 px-4 sm:px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 50%, #7c3aed 100%)" }}
    >
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-black/10 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <SectionBadge>Platform Metrics</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Numbers that build trust
          </h2>
        </Reveal>
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-10"
          variants={stagger}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
        >
          {STATS.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp}>
              <StatsCounter stat={stat} inView={inView} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section 4: Services ───────────────────────────────────────────
function ServicesSection() {
  return (
    <section id="services" className="py-24 px-4 sm:px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-14">
          <SectionBadge>Service Catalogue</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Expert support for every<br className="hidden sm:block" /> IT challenge
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            12 specialised service areas. Flat-fee pricing. No surprises.
          </p>
        </Reveal>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          {SERVICES.map((svc) => (
            <motion.div
              key={svc.title}
              variants={fadeUp}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`group bg-white border ${svc.border} rounded-2xl p-5 cursor-default
                         transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-100`}
              style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
            >
              <div className={`w-11 h-11 ${svc.bg} rounded-xl flex items-center justify-center mb-4
                               ${svc.color} group-hover:scale-110 transition-transform duration-200`}>
                {svc.icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-1.5 text-sm leading-snug">{svc.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{svc.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <Reveal delay={0.3} className="mt-10 text-center">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/register/customer"
              className="inline-flex items-center gap-2.5 bg-indigo-600 text-white font-bold
                         px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-colors text-base
                         shadow-lg shadow-indigo-500/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Get IT Support — Free to Join
            </Link>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Section 5: How It Works ───────────────────────────────────────
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <SectionBadge>Simple Process</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            From problem to resolution<br className="hidden sm:block" /> in 4 steps
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            No ambiguity. No hidden charges. A transparent workflow built for Indian SMBs.
          </p>
        </Reveal>

        <div className="relative">
          {/* Connecting dashed line (desktop) */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px
                          border-t-2 border-dashed border-slate-200 z-0" />

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                variants={fadeUp}
                className="flex flex-col items-center text-center"
              >
                {/* Step icon */}
                <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mb-5
                                 shadow-lg ring-4 ${step.ring}`}>
                  {step.icon}
                </div>
                {/* Step number */}
                <span className="text-xs font-black text-slate-300 tracking-widest mb-2">
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-black text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[220px]">{step.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── Section 6: Why ResolveHQ (Glassmorphism) ─────────────────────
function WhySection() {
  return (
    <section
      className="py-24 px-4 sm:px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
    >
      {/* Background orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
           style={{ background: "radial-gradient(circle, rgba(79,70,229,0.15), transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
           style={{ background: "radial-gradient(circle, rgba(124,58,237,0.1), transparent 70%)" }} />

      <div className="relative max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <SectionBadge>Why ResolveHQ</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            Built for businesses that<br className="hidden sm:block" /> can&apos;t afford downtime
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Every feature is designed to reduce uncertainty, speed up resolution, and build trust.
          </p>
        </Reveal>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {WHY_FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="relative rounded-2xl p-6 cursor-default"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5
                               ${f.color} bg-white/5`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section 7: Testimonials Carousel ─────────────────────────────
function TestimonialsSection() {
  const [active, setActive] = useState(0);
  const total = TESTIMONIALS.length;

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % total), 5500);
    return () => clearInterval(t);
  }, [total]);

  const prev = () => setActive((a) => (a - 1 + total) % total);
  const next = () => setActive((a) => (a + 1) % total);

  return (
    <section className="py-24 px-4 sm:px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <SectionBadge>Customer Stories</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Trusted by real businesses
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            IT teams and founders across India rely on ResolveHQ to keep operations running.
          </p>
        </Reveal>

        <div className="relative">
          {/* Carousel */}
          <div className="overflow-hidden rounded-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-slate-50 border border-slate-100 rounded-3xl p-8 sm:p-12"
                style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.05)" }}
              >
                <StarRow count={TESTIMONIALS[active].rating} />
                <p className="text-xl sm:text-2xl font-medium text-slate-800 leading-relaxed mt-6 mb-8
                               max-w-3xl">
                  &ldquo;{TESTIMONIALS[active].body}&rdquo;
                </p>
                <div className="flex items-center gap-4 pt-6 border-t border-slate-200">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white
                                   text-sm font-bold shrink-0 bg-gradient-to-br
                                   ${TESTIMONIALS[active].gradient}`}>
                    {TESTIMONIALS[active].initials}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{TESTIMONIALS[active].name}</p>
                    <p className="text-sm text-slate-500">
                      {TESTIMONIALS[active].title} · {TESTIMONIALS[active].company}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            {/* Dots */}
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-2 rounded-full transition-all duration-300
                    ${i === active ? "w-6 bg-indigo-600" : "w-2 bg-slate-200 hover:bg-slate-300"}`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            {/* Arrows */}
            <div className="flex gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50
                           flex items-center justify-center transition-colors"
                aria-label="Previous"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                onClick={next}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50
                           flex items-center justify-center transition-colors"
                aria-label="Next"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section 8: Platform Preview ───────────────────────────────────
function PlatformPreviewSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-slate-50 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <SectionBadge>Platform Preview</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Everything in one place
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Track tickets, manage payments, view analytics — all from a unified dashboard.
          </p>
        </Reveal>

        <Reveal>
          {/* Browser chrome wrapper */}
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
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs
                                text-slate-400 text-center">
                  app.resolvehq.in/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard UI mock */}
            <div className="flex h-[460px] overflow-hidden">
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
                  { label: "Tickets",   active: false, w: "w-12" },
                  { label: "Billing",   active: false, w: "w-14" },
                  { label: "Analytics", active: false, w: "w-18" },
                  { label: "Settings",  active: false, w: "w-14" },
                  { label: "Help Center",active: false,w: "w-20" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl
                      ${item.active ? "bg-indigo-600" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded ${item.active ? "bg-white/40" : "bg-slate-200"} shrink-0`} />
                    <div className={`h-2 ${item.w} rounded-full ${item.active ? "bg-white/70" : "bg-slate-200"}`} />
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 bg-slate-50 p-5 overflow-hidden">
                {/* Greeting */}
                <div className="mb-4">
                  <div className="h-4 w-52 bg-slate-800 rounded-full mb-2" />
                  <div className="h-2.5 w-36 bg-slate-300 rounded-full" />
                </div>

                {/* Trust bar */}
                <div className="flex gap-3 mb-5 overflow-hidden">
                  {["Verified Engineers", "Razorpay Secure", "2-hr SLA"].map((label) => (
                    <div key={label}
                         className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-xl px-3 py-1.5 shrink-0">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                      <div className="h-2 w-20 bg-slate-300 rounded-full" />
                    </div>
                  ))}
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { num: "12", color: "text-indigo-600", border: "border-indigo-100", label: "Total" },
                    { num: "4",  color: "text-blue-600",   border: "border-blue-100",   label: "Open" },
                    { num: "3",  color: "text-amber-600",  border: "border-amber-100",  label: "In Progress" },
                    { num: "5",  color: "text-emerald-600",border: "border-emerald-100",label: "Resolved" },
                  ].map((card) => (
                    <div key={card.label}
                         className={`bg-white border ${card.border} rounded-xl px-3 py-2.5`}>
                      <div className="h-1.5 w-10 bg-slate-200 rounded-full mb-2" />
                      <div className={`text-xl font-black ${card.color} leading-none`}>{card.num}</div>
                      <div className="h-1.5 w-14 bg-slate-200 rounded-full mt-1.5" />
                    </div>
                  ))}
                </div>

                {/* Ticket list */}
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="h-2.5 w-20 bg-slate-800 rounded-full" />
                    <div className="h-6 w-20 bg-indigo-600 rounded-lg" />
                  </div>
                  {[
                    { status: "bg-amber-400",  width: "w-32" },
                    { status: "bg-indigo-400", width: "w-44" },
                    { status: "bg-emerald-400",width: "w-28" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                      <div className={`w-2 h-2 rounded-full ${row.status} shrink-0`} />
                      <div className={`h-2.5 ${row.width} bg-slate-200 rounded-full flex-1`} />
                      <div className="h-5 w-16 bg-slate-100 rounded-lg shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel (desktop only) */}
              <div className="w-56 bg-white border-l border-slate-100 p-4 shrink-0 hidden lg:block space-y-4">
                <div className="bg-white border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div className="h-2 w-24 bg-slate-800 rounded-full" />
                  </div>
                  {["Ticket routing","Payment gateway","Notifications"].map((s) => (
                    <div key={s} className="flex items-center justify-between py-1">
                      <div className="h-1.5 w-20 bg-slate-200 rounded-full" />
                      <div className="h-1.5 w-12 bg-emerald-200 rounded-full" />
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="h-2 w-24 bg-slate-800 rounded-full mb-3" />
                  <div className="h-8 bg-indigo-600 rounded-lg" />
                  <div className="h-8 bg-slate-100 rounded-lg" />
                  <div className="h-8 bg-slate-100 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Feature callouts below preview */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {[
            { icon: "🎟", title: "Ticket Tracking", desc: "7-step visual progress tracker on every ticket" },
            { icon: "💳", title: "Billing & Invoices", desc: "GST-compliant PDF invoices on every payment" },
            { icon: "📊", title: "Analytics", desc: "Real-time ticket metrics, CSAT scores, timelines" },
          ].map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="flex items-start gap-4 bg-white border border-slate-100 rounded-2xl p-5"
              style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
            >
              <span className="text-2xl" role="img" aria-hidden="true">{f.icon}</span>
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

// ── Section 9: For Freelancers ────────────────────────────────────
function FreelancerCTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="rounded-3xl overflow-hidden relative"
               style={{ background: "linear-gradient(135deg, #3b0764 0%, #5b21b6 50%, #7c3aed 100%)" }}>
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none opacity-10"
                 style={{ background: "radial-gradient(circle, white, transparent)" }} />
            <div className="flex flex-col lg:flex-row items-center gap-10 px-8 sm:px-12 py-12">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20
                                text-violet-100 text-xs font-semibold px-4 py-2 rounded-full mb-5">
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
                  <Link
                    to="/register/freelancer"
                    className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold
                               px-7 py-3.5 rounded-xl hover:bg-violet-50 transition-colors text-base"
                  >
                    Become a Specialist
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </motion.div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3 w-full lg:w-auto">
                {[
                  { label: "Flexible remote work",         icon: (
                      <svg className="w-4 h-4 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                    )},
                  { label: "Build your reputation",        icon: (
                      <svg className="w-4 h-4 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                    )},
                  { label: "Real engineering projects",    icon: (
                      <svg className="w-4 h-4 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
                    )},
                  { label: "Earnings per ticket resolved", icon: (
                      <svg className="w-4 h-4 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )},
                ].map((b) => (
                  <div key={b.label}
                       className="flex items-center gap-2.5 bg-white/8 border border-white/12 rounded-xl px-3.5 py-3">
                    {b.icon}
                    <span className="text-sm font-medium text-white/90 leading-snug">{b.label}</span>
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

// ── FAQ ───────────────────────────────────────────────────────────
function FAQSection() {
  return (
    <section id="faq" className="py-24 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <Reveal className="text-center mb-12">
          <SectionBadge>Common Questions</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Frequently asked
          </h2>
          <p className="text-lg text-slate-500">
            Everything you need to know before your first ticket.
          </p>
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

// ── Section 9: Bottom CTA ─────────────────────────────────────────
function BottomCTASection() {
  return (
    <section className="py-28 px-4 sm:px-6 bg-slate-950 relative overflow-hidden">
      {/* Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-64 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.2), transparent 70%)" }}
      />
      <motion.div
        className="absolute -bottom-24 right-0 w-96 h-96 rounded-full pointer-events-none opacity-10"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/12
                          text-white/70 text-xs font-semibold px-4 py-2 rounded-full mb-7">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Engineers available now
          </div>
          <h2 className="text-5xl sm:text-6xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            Ready to resolve your<br className="hidden sm:block" /> next IT issue?
          </h2>
          <p className="text-slate-400 text-xl mb-10 leading-relaxed max-w-xl mx-auto">
            Create a ticket and get connected with a vetted specialist.
            First response in under 2 hours — guaranteed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/register/customer"
                className="inline-flex items-center justify-center gap-2.5 bg-indigo-500 text-white
                           font-bold px-9 py-4 rounded-2xl hover:bg-indigo-400 transition-colors
                           text-base shadow-lg shadow-indigo-500/25"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Ticket
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 text-white/70 font-semibold
                           px-9 py-4 rounded-2xl border border-white/15 hover:bg-white/8 hover:text-white
                           transition-all text-base"
              >
                Sign In
              </Link>
            </motion.div>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            No subscription · ₹299 consulting fee · GST invoice on every ticket
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <TrustBarSection />
        <StatsSection />
        <ServicesSection />
        <HowItWorksSection />
        <WhySection />
        <TestimonialsSection />
        <PlatformPreviewSection />
        <FreelancerCTASection />
        <FAQSection />
        <BottomCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
