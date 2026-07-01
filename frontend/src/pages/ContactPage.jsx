import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../context/ToastContext";
import { CONTACT } from "../config/contact";

const CONTACT_CHANNELS = [
  {
    title: "Support Email",
    value: CONTACT.supportEmail,
    href: CONTACT.supportMailto,
    desc: "For ticket issues, account questions, and technical help",
    color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    title: "Sales & Partnerships",
    value: CONTACT.salesEmail,
    href: CONTACT.salesMailto,
    desc: "For enterprise pricing, partnerships, and demo requests",
    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    title: "Billing Queries",
    value: CONTACT.billingEmail,
    href: CONTACT.billingMailto,
    desc: "For invoice disputes, refund status, and payment questions",
    color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const isMobile = useIsMobile();
  const addToast = useToast();

  async function copyPhoneNumber() {
    try {
      await navigator.clipboard.writeText(CONTACT.tollFree);
      addToast("Phone number copied.", "success");
    } catch {
      addToast("Could not copy — please dial manually.", "warning");
    }
  }

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // Opens mailto with pre-filled content — replace with API call in production
    const body = encodeURIComponent(
      `Name: ${form.name}\nCompany: ${form.company}\n\n${form.message}`
    );
    const subject = encodeURIComponent(form.subject || "ResolveHQ Inquiry");
    window.location.href = `mailto:${CONTACT.supportEmail}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-14 px-4 sm:px-6 bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                           text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-5">
            Get In Touch
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-[1.1] tracking-tight mb-4">
            We&apos;re here to help
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
            Reach our team via email or phone. For immediate IT support, open a ticket and a Support Agent will contact you within your chosen response window.
          </p>
          <div className="mt-6">
            <Link to="/register/customer"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold
                             px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Open a Support Ticket →
            </Link>
          </div>
        </div>
      </section>

      {/* Contact channels */}
      <section className="py-16 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CONTACT_CHANNELS.map((ch) => (
              <a
                key={ch.title}
                href={ch.href}
                className={`bg-white border ${ch.border} rounded-2xl p-5 hover:shadow-md transition-all duration-200
                            hover:-translate-y-0.5 group block`}
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
              >
                <div className={`w-12 h-12 ${ch.bg} ${ch.color} rounded-xl flex items-center justify-center mb-4
                                group-hover:scale-110 transition-transform duration-200`}>
                  {ch.icon}
                </div>
                <p className="text-sm font-bold text-slate-900 mb-1">{ch.title}</p>
                <p className={`text-sm font-semibold ${ch.color} mb-2 break-all`}>{ch.value}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{ch.desc}</p>
              </a>
            ))}

            {/* Toll-Free phone card — mobile-aware */}
            {isMobile ? (
              <a
                href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
                aria-label={`Call toll-free support: ${CONTACT.tollFree}`}
                className="bg-white border border-sky-100 rounded-2xl p-5 hover:shadow-md
                           transition-all duration-200 hover:-translate-y-0.5 group block
                           focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
              >
                <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center mb-4
                                group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-900 mb-1">Toll-Free</p>
                <p className="text-sm font-semibold text-sky-600 mb-2">{CONTACT.tollFree}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{CONTACT.businessHours}</p>
              </a>
            ) : (
              <div
                className="bg-white border border-sky-100 rounded-2xl p-5"
                style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
              >
                <div className="w-12 h-12 bg-sky-50 text-sky-400 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-900 mb-1">Toll-Free</p>
                <p className="text-xs text-slate-500 mb-3">
                  Need immediate assistance?<br />Please dial from your phone:
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-800">{CONTACT.tollFree}</span>
                  <button
                    onClick={copyPhoneNumber}
                    aria-label="Copy phone number to clipboard"
                    className="text-[10px] font-bold text-sky-600 hover:text-sky-800
                               border border-sky-200 hover:border-sky-400 px-2 py-0.5 rounded-lg
                               transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500
                               focus:ring-offset-1"
                  >
                    Copy Number
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{CONTACT.businessHours}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact form + info */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12">

          {/* Form */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 tracking-tight">Send us a message</h2>
            {sent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-base font-bold text-emerald-800 mb-2">Message sent!</p>
                <p className="text-sm text-emerald-600 leading-relaxed">
                  Your email client has opened with your message pre-filled. We respond to all emails within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="name">
                      Your name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="name" name="name" type="text" required
                      value={form.name} onChange={handleChange}
                      placeholder="Rajesh Kumar"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="email">
                      Email address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="email" name="email" type="email" required
                      value={form.email} onChange={handleChange}
                      placeholder="rajesh@company.com"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="company">
                    Company name
                  </label>
                  <input
                    id="company" name="company" type="text"
                    value={form.company} onChange={handleChange}
                    placeholder="Sharma Enterprises Pvt. Ltd."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="subject">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="subject" name="subject" type="text" required
                    value={form.subject} onChange={handleChange}
                    placeholder="e.g. Question about enterprise pricing"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="message">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="message" name="message" required rows={5}
                    value={form.message} onChange={handleChange}
                    placeholder="Tell us how we can help…"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 resize-none
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700
                             transition-colors text-sm"
                >
                  Send Message
                </button>
                <p className="text-xs text-slate-400 text-center">
                  We respond to all messages within one business day. For urgent IT issues,{" "}
                  <Link to="/register/customer" className="text-indigo-600 hover:underline">open a support ticket</Link>{" "}
                  instead.
                </p>
              </form>
            )}
          </div>

          {/* Sidebar info */}
          <div className="space-y-5">
            {/* Business hours */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Business Hours</p>
              <div className="space-y-2.5">
                {[
                  { day: "Monday – Friday", hours: "9:00 AM – 8:00 PM IST" },
                  { day: "Saturday", hours: "10:00 AM – 6:00 PM IST" },
                  { day: "Sunday", hours: "Emergency tickets only" },
                ].map((row) => (
                  <div key={row.day} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 font-medium">{row.day}</span>
                    <span className="text-xs text-slate-500">{row.hours}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-700">Support team is online now</span>
              </div>
            </div>

            {/* Office address */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Registered Office</p>
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <address className="text-sm text-slate-600 not-italic leading-relaxed">
                  Friday Tech Systems Pvt. Ltd.<br />
                  Bengaluru, Karnataka 560001<br />
                  India
                </address>
              </div>
            </div>

            {/* Quick action */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
              <p className="text-sm font-bold text-indigo-900 mb-2">Need IT help right now?</p>
              <p className="text-xs text-indigo-700 leading-relaxed mb-4">
                Skip the form — open a support ticket and a Support Agent will contact you within your chosen response window.
              </p>
              <Link to="/register/customer"
                    className="block w-full text-center bg-indigo-600 text-white font-bold
                               py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm">
                Open a Ticket
              </Link>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
