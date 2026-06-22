import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import LandingFooter from "../components/layout/LandingFooter";
import Header from "../components/layout/Header";

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
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left bg-white hover:bg-slate-50 transition-colors"
        aria-expanded={open}>
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
  { label: "Secure Payments via Razorpay" },
  { label: "2-Hour Response SLA" },
  { label: "Real-Time Ticket Tracking" },
  { label: "Enterprise Grade Security" },
];

const POPULAR_PROBLEMS = [
  {
    title: "Linux Server Down",
    desc: "Crash, OOM kills, systemd failures, kernel panics",
    color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", glow: "shadow-orange-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "Microsoft 365 Issues",
    desc: "Exchange sync, Teams outages, OneDrive errors",
    color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100", glow: "shadow-teal-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: "VPN Connectivity Problems",
    desc: "Split tunneling, auth failures, routing issues",
    color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100", glow: "shadow-purple-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
  },
  {
    title: "Email Delivery Failures",
    desc: "DKIM/SPF/DMARC misconfig, blacklisting, bounce errors",
    color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", glow: "shadow-amber-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    title: "Database Performance",
    desc: "Slow queries, deadlocks, index tuning, replication lag",
    color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", glow: "shadow-indigo-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    title: "Backup & Recovery",
    desc: "Failed backups, corrupted snapshots, data restore",
    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", glow: "shadow-emerald-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Cybersecurity Incidents",
    desc: "Ransomware, unauthorized access, vulnerability patching",
    color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", glow: "shadow-rose-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    title: "Cloud Infrastructure",
    desc: "AWS/Azure/GCP outages, cost spikes, mis-configuration",
    color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100", glow: "shadow-sky-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
  {
    title: "Network Troubleshooting",
    desc: "Packet loss, latency spikes, VLAN & firewall issues",
    color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100", glow: "shadow-cyan-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
  {
    title: "Active Directory Issues",
    desc: "GPO failures, replication errors, account lockouts",
    color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", glow: "shadow-blue-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: "Website Downtime",
    desc: "HTTP 5xx errors, nginx/Apache failures, SSL expiry",
    color: "text-green-600", bg: "bg-green-50", border: "border-green-100", glow: "shadow-green-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    title: "DevOps & Deployment",
    desc: "CI/CD pipeline failures, Docker issues, Kubernetes errors",
    color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100", glow: "shadow-violet-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
];

const STATS = [
  { prefix: "",   value: 250, suffix: "+",    label: "Issues Resolved",      sub: "and counting" },
  { prefix: "",   value: 98,  suffix: "%",    label: "Customer Satisfaction", sub: "CSAT score" },
  { prefix: "< ", value: 2,   suffix: " hrs", label: "Avg Response Time",     sub: "first engineer response" },
  { prefix: "",   value: 50,  suffix: "+",    label: "Verified Specialists",  sub: "across India" },
];

const PROCESS_STEPS = [
  {
    step: "01", title: "Submit Your Issue",
    body: "Describe your IT problem in plain English — no jargon needed. Select service type, severity, and attach screenshots in under 2 minutes.",
    color: "bg-indigo-600", ring: "ring-indigo-200",
    icon: <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>,
  },
  {
    step: "02", title: "Engineer Assigned",
    body: "A vetted specialist matching your exact service type is assigned within 2 hours — with instant email and notification.",
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
    step: "04", title: "Pay Securely",
    body: "Confirm the fix and pay via Razorpay — only after your issue is resolved. GST-compliant PDF invoice auto-generated instantly.",
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
    title: "Secure Payments",
    desc: "All transactions via Razorpay with PCI DSS compliance. No card data stored.",
    color: "text-emerald-600", bg: "bg-emerald-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
  },
  {
    title: "Real-Time Tracking",
    desc: "7-stage ticket lifecycle with notifications at every status change.",
    color: "text-sky-600", bg: "bg-sky-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
  },
  {
    title: "Invoice Transparency",
    desc: "GST-compliant PDF invoice generated automatically for every payment.",
    color: "text-amber-600", bg: "bg-amber-50",
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
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
  { label: "First Response", value: "< 2 Hours", sub: "Guaranteed or money back", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
  { label: "Resolution Updates", value: "Real-Time", sub: "Notifications at every step", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  { label: "Ticket Tracking", value: "24/7 Access", sub: "Dashboard always available", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
  { label: "Payment Protection", value: "Transparent", sub: "Pay only for resolution", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
];

const RECENT_ACTIVITY = [
  { issue: "Linux server performance degradation resolved", service: "Linux", time: "23 mins ago", severity: "High" },
  { issue: "Microsoft 365 mailbox sync failure fixed", service: "M365", time: "1 hr ago", severity: "Medium" },
  { issue: "VPN connectivity restored for remote workforce", service: "Network", time: "2 hrs ago", severity: "High" },
  { issue: "MySQL slow query optimisation completed", service: "Database", time: "3 hrs ago", severity: "Medium" },
  { issue: "Email routing correction and DMARC alignment", service: "Email", time: "4 hrs ago", severity: "Low" },
  { issue: "AWS EC2 instance scaling issue resolved", service: "Cloud", time: "5 hrs ago", severity: "High" },
  { issue: "Active Directory replication error fixed", service: "Windows", time: "6 hrs ago", severity: "High" },
];

const ENGINEERS = [
  {
    name: "Arjun Kapoor",
    spec: "Linux Specialist",
    exp: "8 yrs",
    tickets: 340,
    response: "< 45 min",
    rating: 4.9,
    gradient: "from-orange-500 to-amber-500",
    initials: "AK",
    skills: ["RHEL", "Ubuntu", "Nginx", "Docker"],
  },
  {
    name: "Preethi Rajan",
    spec: "Windows Administrator",
    exp: "6 yrs",
    tickets: 212,
    response: "< 30 min",
    rating: 4.8,
    gradient: "from-blue-500 to-indigo-500",
    initials: "PR",
    skills: ["AD", "Group Policy", "Hyper-V", "RDS"],
  },
  {
    name: "Vikram Nair",
    spec: "Cloud Engineer",
    exp: "5 yrs",
    tickets: 178,
    response: "< 60 min",
    rating: 4.7,
    gradient: "from-sky-500 to-teal-500",
    initials: "VN",
    skills: ["AWS", "Azure", "Terraform", "K8s"],
  },
  {
    name: "Sneha Kulkarni",
    spec: "Network Engineer",
    exp: "7 yrs",
    tickets: 295,
    response: "< 40 min",
    rating: 4.9,
    gradient: "from-purple-500 to-violet-600",
    initials: "SK",
    skills: ["Cisco", "Fortinet", "VPN", "BGP"],
  },
  {
    name: "Rahul Mathur",
    spec: "Cybersecurity Specialist",
    exp: "9 yrs",
    tickets: 189,
    response: "< 50 min",
    rating: 5.0,
    gradient: "from-rose-500 to-pink-600",
    initials: "RM",
    skills: ["Pentest", "SIEM", "ISO27001", "VAPT"],
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
    desc: "7 stages from creation to invoice — what to expect",
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

const TESTIMONIALS = [
  {
    name: "Rajesh Mehta", title: "IT Manager", company: "Mehta Textiles Pvt. Ltd., Surat",
    body: "We had AD sync failures every other week. ResolveHQ assigned an engineer who fixed the Windows Server issue in under 3 hours. Worth every rupee — and the GST invoice made reimbursement easy.",
    rating: 5, initials: "RM", gradient: "from-indigo-600 to-violet-600",
  },
  {
    name: "Priya Nair", title: "Founder & CA", company: "Nair & Associates, Chennai",
    body: "Our Tally server kept crashing before month-end closing. I created a ticket at 11 PM and an engineer was on it within the hour. No subscriptions, no surprises. Exactly what a small firm needs.",
    rating: 5, initials: "PN", gradient: "from-violet-600 to-purple-700",
  },
  {
    name: "Suresh Joshi", title: "Operations Head", company: "Joshi Auto Parts, Pune",
    body: "Finally an IT support service that's transparent about pricing. You know the fee before you start. We've resolved 12 tickets — Linux, security, VMware — all done on time with a proper invoice.",
    rating: 5, initials: "SJ", gradient: "from-emerald-600 to-teal-600",
  },
  {
    name: "Kavita Reddy", title: "CEO", company: "Reddy Pharma Distributors, Hyderabad",
    body: "Our ERP went down on a Friday evening. ResolveHQ had a SAP Basis engineer on the call within 90 minutes. We were back up before 9 PM. I would not trust anyone else for critical infrastructure.",
    rating: 5, initials: "KR", gradient: "from-rose-600 to-pink-600",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the pricing work?",
    a: "You pay a flat ₹299 consulting fee when opening a ticket. This is fully refunded if no engineer accepts within 2 hours. The resolution fee (₹499–₹1,999) is only charged after your issue is completely fixed.",
  },
  {
    q: "How are engineers verified?",
    a: "All freelancers complete a skills assessment, identity check, and supervised trial before listing. Their ratings, completion history, and response times are monitored continuously.",
  },
  {
    q: "What is the response time SLA?",
    a: "Most tickets receive an engineer assignment within 2 hours during business hours (9 AM–8 PM IST). You get notifications at every status change. If the SLA is breached, the consulting fee is automatically refunded.",
  },
  {
    q: "Do I get a GST invoice?",
    a: "Yes. Every transaction — consulting fee and resolution fee — generates a proper GST-compliant PDF invoice automatically. Perfect for business accounts, audits, and tax filings.",
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
    label: "Fast Response SLA",
    value: "< 2 Hours Guaranteed",
    bg: "bg-indigo-500/15",
    color: "text-indigo-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Verified Engineers",
    value: "Vetted specialists across India",
    bg: "bg-emerald-500/15",
    color: "text-emerald-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    label: "Microsoft 365 Support",
    value: "Exchange, Teams, OneDrive, SharePoint",
    bg: "bg-blue-500/15",
    color: "text-blue-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Email & DNS Issues",
    value: "DKIM/SPF/DMARC, deliverability, routing",
    bg: "bg-violet-500/15",
    color: "text-violet-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    label: "Server Administration",
    value: "Linux, Windows Server, performance & crashes",
    bg: "bg-orange-500/15",
    color: "text-orange-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    label: "Network & VPN Support",
    value: "Remote access, firewall, connectivity",
    bg: "bg-sky-500/15",
    color: "text-sky-300",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
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
              India's Enterprise IT Support Marketplace · Engineers Online
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-[3.75rem] xl:text-[4.5rem] font-black text-white
                         leading-[1.04] tracking-tight mb-5"
            >
              Expert IT Support —<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)" }}
              >
                No Full-Time Hire Needed.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.22 }}
              className="text-slate-300 text-lg sm:text-xl leading-relaxed mb-8 max-w-xl"
            >
              When your server crashes, email stops delivering, or your team
              can&apos;t connect to VPN — get a verified IT engineer on the problem
              in under 2 hours. No retainers. No contracts. Pay only when your issue is fixed.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="flex flex-col sm:flex-row gap-3 mb-10"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/register/customer"
                  className="inline-flex items-center justify-center gap-2.5 bg-indigo-500 text-white
                             font-bold px-8 py-4 rounded-2xl hover:bg-indigo-400 active:bg-indigo-600
                             transition-colors text-base shadow-lg shadow-indigo-500/30">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Ticket — Free to Start
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

            {/* Trust badges — honest service attributes, no fake numbers */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="pt-8 border-t border-white/10"
            >
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Why businesses choose ResolveHQ
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    label: "Pay Per Issue",
                    sub: "No retainers or subscriptions",
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                  },
                  {
                    label: "No Annual Contracts",
                    sub: "Use only when you need it",
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    ),
                  },
                  {
                    label: "GST Invoice Included",
                    sub: "Auto-generated on every payment",
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                      </svg>
                    ),
                  },
                  {
                    label: "Vetted Engineers",
                    sub: "Identity verified + skills tested",
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    ),
                  },
                ].map((badge) => (
                  <div key={badge.label}
                    className="flex items-start gap-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
                    <div className="w-6 h-6 bg-indigo-500/20 rounded-lg flex items-center justify-center shrink-0 text-indigo-300 mt-0.5">
                      {badge.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{badge.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{badge.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-white font-black text-sm ml-1.5">4.9 / 5.0</span>
                </div>
                <p className="text-slate-400 text-xs">Issues resolved — pay only when fixed</p>
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
const PREMIUM_SERVICES = [
  {
    name: "Microsoft 365 Support",
    desc: "Full support for the Microsoft 365 ecosystem — mailbox migrations, Teams federation issues, and admin console management.",
    issues: [
      "Exchange mailbox sync & migration errors",
      "Microsoft Teams outages & federation issues",
      "OneDrive / SharePoint access & sync problems",
      "Licence management & admin console fixes",
    ],
    color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", glow: "hover:border-blue-200", shadow: "hover:shadow-blue-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    name: "Server Administration",
    desc: "Linux and Windows Server management — performance tuning, crash recovery, and service restoration for critical business systems.",
    issues: [
      "Linux server crashes, OOM kills & kernel panics",
      "Windows Server roles, IIS & RDS failures",
      "Nginx, Apache & database server configuration",
      "Backup restoration & disaster recovery",
    ],
    color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", glow: "hover:border-indigo-200", shadow: "hover:shadow-indigo-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    name: "Network & VPN Support",
    desc: "End-to-end network troubleshooting, VPN setup and recovery, firewall configuration, and remote access management.",
    issues: [
      "VPN authentication failures & split tunneling",
      "Packet loss, latency spikes & VLAN issues",
      "Cisco / Fortinet firewall configuration",
      "Remote desktop & site-to-site connectivity",
    ],
    color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100", glow: "hover:border-sky-200", shadow: "hover:shadow-sky-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
  {
    name: "Email & DNS Issues",
    desc: "Fix email deliverability failures, DNS misconfigurations, blacklisting, and mail server setup for all major hosting platforms.",
    issues: [
      "DKIM / SPF / DMARC misconfiguration",
      "Email blacklisting & bounce rate issues",
      "DNS propagation & zone file problems",
      "cPanel, Postfix & Google Workspace mail setup",
    ],
    color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100", glow: "hover:border-violet-200", shadow: "hover:shadow-violet-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    name: "Cloud Infrastructure",
    desc: "AWS, Azure, and GCP support — from cost spikes and scaling issues to misconfigured services and deployment failures.",
    issues: [
      "AWS EC2, RDS, S3 & Lambda incidents",
      "Azure Active Directory & Entra ID issues",
      "GCP networking, IAM & billing anomalies",
      "Cost optimisation & infrastructure rightsizing",
    ],
    color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100", glow: "hover:border-cyan-200", shadow: "hover:shadow-cyan-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
  {
    name: "Cybersecurity Assistance",
    desc: "Rapid response to security incidents, vulnerability assessments, and hardening for business-critical systems.",
    issues: [
      "Ransomware response & malware removal",
      "Vulnerability assessment (VAPT)",
      "Firewall rules & endpoint hardening",
      "Compliance preparation — ISO 27001, SOC 2",
    ],
    color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", glow: "hover:border-rose-200", shadow: "hover:shadow-rose-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
];

function PremiumServicesSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-12">
          <SectionBadge>Our Services</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            What Can We Fix For You?
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Expert engineers ready for the exact issues disrupting your business — from Microsoft 365 to cloud infrastructure.
          </p>
        </Reveal>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}
        >
          {PREMIUM_SERVICES.map((svc) => (
            <motion.div
              key={svc.name} variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`group bg-white border ${svc.border} ${svc.glow} rounded-2xl p-6 flex flex-col
                          hover:shadow-xl ${svc.shadow} transition-all duration-300`}
              style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.06)" }}
            >
              <div className={`w-12 h-12 ${svc.bg} rounded-xl flex items-center justify-center mb-5
                               ${svc.color} group-hover:scale-110 transition-transform duration-200 shrink-0`}>
                {svc.icon}
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">{svc.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{svc.desc}</p>
              <ul className="space-y-1.5 mb-5 flex-1">
                {svc.issues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2">
                    <svg className={`w-3.5 h-3.5 ${svc.color} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-xs text-slate-600 leading-relaxed">{issue}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register/customer"
                className={`mt-auto inline-flex items-center gap-1.5 text-sm font-semibold ${svc.color}
                            group-hover:gap-2.5 transition-all duration-200`}>
                Get Help
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </motion.div>
          ))}
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
    title: "Fast Response SLA",
    desc: "First engineer assigned within 2 hours of ticket creation. If the SLA is breached, your consulting fee is automatically refunded.",
    color: "text-sky-600", bg: "bg-sky-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "GST Invoice Included",
    desc: "Every payment auto-generates a GST-compliant PDF invoice — ready for business reimbursement, audits, and tax filing.",
    color: "text-amber-600", bg: "bg-amber-50",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
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
          {POPULAR_PROBLEMS.map((p) => (
            <motion.div key={p.title} variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`group bg-white border ${p.border} rounded-2xl p-5 cursor-default
                         hover:shadow-xl ${p.glow} transition-all duration-300`}
              style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
              <div className={`w-12 h-12 ${p.bg} rounded-xl flex items-center justify-center mb-4
                               ${p.color} group-hover:scale-110 transition-transform duration-200`}>
                {p.icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-1.5 text-sm leading-snug">{p.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">{p.desc}</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Engineers Available</span>
              </div>
            </motion.div>
          ))}
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
// SECTION 4: ANIMATED STATS
// ══════════════════════════════════════════════════════════════════
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
    <section ref={ref} className="py-16 px-4 sm:px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #4338ca 0%, #6d28d9 50%, #7c3aed 100%)" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-black/10 blur-3xl" />
      </div>
      <div className="relative max-w-5xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge light>Platform Metrics</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Numbers that speak for themselves
          </h2>
        </Reveal>
        <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-10"
          variants={stagger} initial="hidden" animate={inView ? "show" : "hidden"}>
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

// ══════════════════════════════════════════════════════════════════
// SECTION 5: HOW RESOLVEHQ WORKS (4 steps)
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
                    <svg className="w-4 h-4 text-slate-300 shrink-0 -mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                )}
                <div className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg ring-4 ${step.ring} relative z-10`}>
                  {step.icon}
                </div>
                <span className="text-[10px] font-black text-slate-300 tracking-widest mb-2">STEP {step.step}</span>
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
                  <span className="text-[10px] font-black text-slate-300 tracking-widest">STEP {step.step}</span>
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
            Tickets, engineer assignments, notifications, invoices — all from a unified dashboard.
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
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 text-center">
                  app.resolvehq.in/dashboard
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
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
                  {["Verified Engineers", "Razorpay Secure", "2-hr SLA"].map((label) => (
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
                  {["Engineer assigned", "Ticket updated", "Invoice ready"].map((s) => (
                    <div key={s} className="flex items-center gap-2 py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                    </div>
                  ))}
                </div>
                {/* Invoice status */}
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
            { title: "Invoice & Billing", desc: "GST-compliant PDF invoices auto-generated on payment" },
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{m.label}</p>
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
                        <span className="text-[10px] text-slate-400">{item.time}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <Reveal delay={0.3} className="mt-8 text-center">
          <p className="text-sm text-slate-400">
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
              <div className="flex items-center justify-center gap-1 mb-1">
                <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                <p className="text-[11px] font-semibold text-indigo-600">{eng.spec}</p>
              </div>

              {/* Rating */}
              <div className="flex items-center justify-center gap-1 mb-3">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-bold text-slate-700">{eng.rating}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-1 mb-3 text-center">
                <div>
                  <p className="text-xs font-black text-slate-900">{eng.exp}</p>
                  <p className="text-[9px] text-slate-400 leading-tight">Exp.</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{eng.tickets}</p>
                  <p className="text-[9px] text-slate-400 leading-tight">Tickets</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{eng.response}</p>
                  <p className="text-[9px] text-slate-400 leading-tight">Response</p>
                </div>
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
          <p className="text-sm text-slate-400">
            Engineer profiles shown are representative examples only.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 11: TESTIMONIALS
// ══════════════════════════════════════════════════════════════════
function TestimonialsSection() {
  const [active, setActive] = useState(0);
  const total = TESTIMONIALS.length;

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % total), 5500);
    return () => clearInterval(t);
  }, [total]);

  return (
    <section className="py-16 px-4 sm:px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-10">
          <SectionBadge>Customer Stories</SectionBadge>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Trusted by real businesses
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            IT teams and founders across India rely on ResolveHQ for critical infrastructure support.
          </p>
        </Reveal>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl">
            <AnimatePresence mode="wait">
              <motion.div key={active}
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-slate-50 border border-slate-100 rounded-3xl p-8 sm:p-12"
                style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.05)" }}>
                <StarRow count={TESTIMONIALS[active].rating} />
                <p className="text-xl sm:text-2xl font-medium text-slate-800 leading-relaxed mt-6 mb-8 max-w-3xl">
                  &ldquo;{TESTIMONIALS[active].body}&rdquo;
                </p>
                <div className="flex items-center gap-4 pt-6 border-t border-slate-200">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 bg-gradient-to-br ${TESTIMONIALS[active].gradient}`}>
                    {TESTIMONIALS[active].initials}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{TESTIMONIALS[active].name}</p>
                    <p className="text-sm text-slate-500">{TESTIMONIALS[active].title} · {TESTIMONIALS[active].company}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button key={i} onClick={() => setActive(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === active ? "w-6 bg-indigo-600" : "w-2 bg-slate-200 hover:bg-slate-300"}`}
                  aria-label={`Go to testimonial ${i + 1}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActive((a) => (a - 1 + total) % total)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors" aria-label="Previous">
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button onClick={() => setActive((a) => (a + 1) % total)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors" aria-label="Next">
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

// ══════════════════════════════════════════════════════════════════
// SECTION 12: HELP CENTER PREVIEW
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
    <section className="py-20 px-4 sm:px-6 bg-white">
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
                    Become a Specialist
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
            First response in under 2 hours — guaranteed.
          </p>
          <p className="text-slate-500 text-sm mb-10">
            ₹299 consulting fee · Resolution fee only after the issue is fixed · GST invoice included
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
        {/* 12. Testimonials */}
        <TestimonialsSection />
        {/* 13. Help Center */}
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
