import { useState } from "react";
import { Link } from "react-router-dom";
import MainLayout from "../components/layouts/MainLayout";
import { usePageTitle } from "../hooks/usePageTitle";
import { CONTACT } from "../config/contact";

// ── Section card ──────────────────────────────────────────────────
function HelpSection({ id, icon, title, children }) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
             style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <span className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </span>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </section>
  );
}

// ── Prose paragraph ───────────────────────────────────────────────
function P({ children }) {
  return <p className="text-sm text-slate-600 leading-relaxed">{children}</p>;
}

// ── Numbered step ─────────────────────────────────────────────────
function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center
                      text-xs font-bold shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-1">{title}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ── FAQ accordion item ────────────────────────────────────────────
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4
                   text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800">{q}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

// ── Ticket lifecycle step ─────────────────────────────────────────
function LifecycleStep({ status, label, description, active = false }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${active ? "bg-indigo-600" : "bg-slate-200"}`} />
      <div>
        <p className={`text-sm font-semibold ${active ? "text-indigo-700" : "text-slate-700"}`}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Quick nav ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: "how-it-works",        label: "How It Works" },
  { id: "ticket-lifecycle",    label: "Ticket Lifecycle" },
  { id: "payment-process",     label: "Payment Process" },
  { id: "engineer-assignment", label: "Engineer Assignment" },
  { id: "refund-policy",       label: "Refund Policy" },
  { id: "faqs",                label: "FAQs" },
  { id: "contact-support",     label: "Contact Support" },
];

export default function HelpCenterPage() {
  usePageTitle("Help Center");

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100
                           text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
            Help Center
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          How can we help you?
        </h1>
        <p className="text-base text-slate-500 mt-2 max-w-xl">
          Everything you need to know about using ResolveHQ — from raising your first ticket to tracking its resolution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-8 items-start">
        {/* ── Main content ─────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">

          {/* How it works */}
          <HelpSection id="how-it-works" title="How ResolveHQ Works" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }>
            <P>
              ResolveHQ is an enterprise IT support marketplace that connects Indian SMBs with vetted IT engineers.
              Instead of hiring in-house or relying on ad-hoc freelancers, you get expert help within 2 hours — guaranteed.
            </P>
            <div className="space-y-4 mt-2">
              <Step n={1} title="Create a support ticket">
                Describe your IT problem — hardware, software, networking, VMware, SAP, or anything in between.
                Takes under 2 minutes.
              </Step>
              <Step n={2} title="Pay the consulting fee">
                A flat ₹299 consulting fee is charged upfront. This is refunded automatically if no engineer accepts your ticket.
              </Step>
              <Step n={3} title="Get matched with a specialist">
                Our platform routes your ticket to a verified engineer whose skills match your issue.
                First response within 2 hours, resolution target 48 hours.
              </Step>
              <Step n={4} title="Track and collaborate">
                Chat with your engineer, share screenshots, and track progress in real time from your dashboard.
              </Step>
              <Step n={5} title="Confirm resolution & close your ticket">
                Mark the ticket resolved when your issue is fixed. Your payment history and billing records are available from the Billing page.
              </Step>
            </div>
          </HelpSection>

          {/* Ticket lifecycle */}
          <HelpSection id="ticket-lifecycle" title="Ticket Lifecycle" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
          }>
            <P>Every ticket moves through these stages. You can see the current stage on your ticket detail page.</P>
            <div className="mt-3 space-y-3 pl-1">
              <LifecycleStep
                status="pending_payment"
                label="Pending Payment"
                description="Ticket has been created. Pay the ₹299 consulting fee to activate it."
              />
              <LifecycleStep
                status="open"
                label="Open"
                description="Payment confirmed. Your ticket is in the queue and being reviewed."
              />
              <LifecycleStep
                status="assigned"
                label="Assigned"
                description="A vetted engineer has accepted your ticket and will respond shortly."
              />
              <LifecycleStep
                status="in_progress"
                active
                label="In Progress"
                description="Your engineer is actively working on the issue. You can chat with them here."
              />
              <LifecycleStep
                status="waiting_customer"
                label="Waiting on You"
                description="Your engineer needs additional information or access from you. Please respond promptly."
              />
              <LifecycleStep
                status="resolved"
                label="Resolved"
                description="Issue is fixed. Please confirm resolution and rate your experience."
              />
              <LifecycleStep
                status="closed"
                label="Closed"
                description="Ticket is fully closed. View your billing history from the Billing page."
              />
            </div>
          </HelpSection>

          {/* Payment process */}
          <HelpSection id="payment-process" title="Payment Process" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          }>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Consulting Fee — ₹299</p>
                <P>
                  Charged once per ticket when you submit it. Processed through our secure payment infrastructure.
                  Supports UPI, credit/debit cards, and net banking.
                </P>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">All amounts include 18% GST</p>
                <P>
                  Prices shown in the platform are inclusive of GST. A GST-compliant tax invoice is generated after
                  each successful payment and available for download from the Billing page.
                </P>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">B2B Invoice with GSTIN</p>
                <P>
                  If your company is GST-registered, add your GSTIN in Settings → Business Details.
                  It will appear on all future invoices automatically.
                </P>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <p className="text-xs font-bold text-emerald-700">Secure Payment Processing</p>
                </div>
                <p className="text-xs text-emerald-600 leading-relaxed">
                  Your card details are never stored on ResolveHQ servers. All transactions are handled by
                  PCI-DSS Level 1 compliant payment infrastructure.
                </p>
              </div>
            </div>
          </HelpSection>

          {/* Engineer assignment */}
          <HelpSection id="engineer-assignment" title="How Engineers Are Assigned" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }>
            <div className="space-y-3">
              <P>
                Every engineer on ResolveHQ goes through a rigorous vetting process before they can accept tickets.
              </P>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["Skill Verification", "Engineers list their skills and are tested against real-world scenarios."],
                  ["Background Check", "Identity and professional history are verified before onboarding."],
                  ["Skill Matching", "Our routing system matches your ticket's service type to engineers with proven expertise."],
                  ["Performance Rating", "CSAT ratings are collected after every ticket. Low-rated engineers are removed."],
                ].map(([title, desc]) => (
                  <div key={title} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-700 mb-1">{title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
              <P>
                If your ticket is not accepted within 2 hours of payment, our operations team escalates it manually.
                You will be notified of any delay via email and in-platform notification.
              </P>
            </div>
          </HelpSection>

          {/* Refund policy */}
          <HelpSection id="refund-policy" title="Refund Policy" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          }>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Automatic Refund — Unaccepted Ticket</p>
                <P>
                  If no engineer accepts your ticket within 24 hours of payment, the ₹299 consulting fee is
                  automatically refunded to your original payment method within 5–7 business days.
                  No action required from your side.
                </P>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Disputed Resolution</p>
                <P>
                  If you believe your issue was not resolved satisfactorily, raise a dispute within 48 hours
                  of the ticket being marked resolved. Contact our billing team at{" "}
                  <a href={CONTACT.billingMailto} className="text-indigo-600 hover:text-indigo-800 font-medium">
                    {CONTACT.billingEmail}
                  </a>.
                </P>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Non-Refundable Cases</p>
                <P>
                  The consulting fee is non-refundable once an engineer has spent 30+ minutes working on your ticket,
                  unless the resolution is disputed and our team upholds the dispute.
                </P>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-700 mb-1">Processing Time</p>
                <p className="text-xs text-amber-600 leading-relaxed">
                  Refunds via UPI are processed within 1–3 business days.
                  Card refunds take 5–7 business days depending on your bank.
                </p>
              </div>
            </div>
          </HelpSection>

          {/* FAQs */}
          <HelpSection id="faqs" title="Frequently Asked Questions" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          }>
            <div className="space-y-2">
              <FaqItem
                q="Can I get support for my Windows or Mac laptop?"
                a="Yes. We support Windows, macOS, Linux, networking, VMware, SAP, and general IT infrastructure. Select the appropriate service type when creating your ticket."
              />
              <FaqItem
                q="Is my data safe during a remote session?"
                a="Engineers only access what is necessary to resolve your issue. You can terminate any remote session at any time from your side. Sessions are not recorded by ResolveHQ."
              />
              <FaqItem
                q="What if I need ongoing support — not just a one-time fix?"
                a="ResolveHQ currently operates on a per-ticket model. For ongoing managed IT support, contact our sales team at hello@resolvehq.in to discuss a custom arrangement."
              />
              <FaqItem
                q="Can I choose which engineer works on my ticket?"
                a="Currently our system automatically assigns the best-matched available engineer. Engineer selection is on our roadmap for future releases."
              />
              <FaqItem
                q="What payment methods are accepted?"
                a="UPI, credit cards (Visa, Mastercard, RuPay), debit cards, and net banking. EMI options may be available on select cards."
              />
              <FaqItem
                q="I paid but my ticket is still showing Pending Payment."
                a="Payment confirmation can take up to 5 minutes. If your ticket hasn't updated after 10 minutes, contact support with your payment transaction ID."
              />
              <FaqItem
                q="How do I access my payment records and billing history?"
                a="Go to Billing in the sidebar. Every completed payment has a PDF download button for your records. If your company is GST-registered, add your GSTIN in Settings → Business Details to include it on all billing documents."
              />
              <FaqItem
                q="What are the business hours for support?"
                a={CONTACT.businessHours + ". Outside these hours, our team monitors critical tickets and responds within 4 hours."}
              />
            </div>
          </HelpSection>

          {/* Contact */}
          <HelpSection id="contact-support" title="Contact Support" icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          }>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <a
                href={CONTACT.supportMailto}
                className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4
                           hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-150 group"
              >
                <svg className="w-5 h-5 text-indigo-500 group-hover:text-indigo-700 transition-colors"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">Email Support</p>
                  <p className="text-xs text-slate-500 mt-0.5 break-all">{CONTACT.supportEmail}</p>
                </div>
              </a>

              <a
                href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
                className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4
                           hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-150 group"
              >
                <svg className="w-5 h-5 text-indigo-500 group-hover:text-indigo-700 transition-colors"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">Toll Free</p>
                  <p className="text-xs text-slate-500 mt-0.5">{CONTACT.tollFree}</p>
                </div>
              </a>

              <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-bold text-slate-700">Business Hours</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{CONTACT.businessHours}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
              <Link
                to="/tickets/new"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
                           px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Open a Support Ticket
              </Link>
              <a
                href={CONTACT.billingMailto}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600
                           hover:text-indigo-600 transition-colors"
              >
                Billing queries →
              </a>
            </div>
          </HelpSection>
        </div>

        {/* ── Quick navigation sidebar ──────────────────────────── */}
        <nav className="hidden lg:block sticky top-24 space-y-1" aria-label="Help center sections">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 px-2">
            On this page
          </p>
          {SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="block px-3 py-2 text-sm text-slate-500 hover:text-indigo-600
                         hover:bg-indigo-50 rounded-lg transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </MainLayout>
  );
}
