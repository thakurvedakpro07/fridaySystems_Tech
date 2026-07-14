import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { CONTACT } from "../config/contact";
import { usePageTitle } from "../hooks/usePageTitle";

const SECTIONS = [
  { id: "information-collected", label: "Information We Collect" },
  { id: "how-we-use",            label: "How We Use Your Information" },
  { id: "data-sharing",          label: "Data Sharing" },
  { id: "data-security",         label: "Data Security" },
  { id: "data-retention",        label: "Data Retention" },
  { id: "cookies",               label: "Cookies" },
  { id: "your-rights",           label: "Your Rights" },
  { id: "contact",               label: "Contact Us" },
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  usePageTitle("Privacy Policy");
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-10 px-4 sm:px-6 border-b border-slate-100">
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100
                           text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">
            Legal
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-slate-500 text-base leading-relaxed">
            Effective date: January 1, 2025 &nbsp;·&nbsp; Last updated: June 2026
          </p>
          <p className="text-slate-500 text-base leading-relaxed mt-2 max-w-2xl">
            Friday Tech Systems Pvt. Ltd. ("ResolveHQ", "we", "us") operates the ResolveHQ IT support
            marketplace. This Privacy Policy explains how we collect, use, and protect your information.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-12 items-start">
          <div className="space-y-10">

            <Section id="information-collected" title="1. Information We Collect">
              <p><strong className="font-semibold text-slate-800">Account information:</strong> When you register, we collect your name, email address, phone number, and company name.</p>
              <p><strong className="font-semibold text-slate-800">GSTIN:</strong> If you provide your GSTIN for B2B invoicing, we store it securely and use it only for invoice generation.</p>
              <p><strong className="font-semibold text-slate-800">Ticket content:</strong> Issue descriptions, comments, and file attachments you upload are stored to enable engineer collaboration.</p>
              <p><strong className="font-semibold text-slate-800">Payment data:</strong> We do not store card numbers or payment credentials. All transactions are processed by Razorpay, a PCI DSS Level 1 certified gateway. We store transaction IDs and amounts for billing records.</p>
              <p><strong className="font-semibold text-slate-800">Usage data:</strong> We collect standard server logs (IP address, browser type, pages visited, timestamps) for security monitoring and performance improvement.</p>
            </Section>

            <Section id="how-we-use" title="2. How We Use Your Information">
              <p>We use your information to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Operate the ticket matching system and connect you with appropriate engineers</li>
                <li>Process payments and generate GST-compliant invoices</li>
                <li>Send transactional notifications about your ticket status</li>
                <li>Respond to support requests and billing queries</li>
                <li>Detect and prevent fraud and abuse</li>
                <li>Improve platform performance and user experience</li>
                <li>Meet our legal and regulatory obligations</li>
              </ul>
              <p>We do not use your information for targeted advertising. We do not sell your data to third parties.</p>
            </Section>

            <Section id="data-sharing" title="3. Data Sharing">
              <p>We share your information only in the following circumstances:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="font-semibold text-slate-800">Assigned engineers:</strong> The engineer assigned to your ticket can see your ticket content, comments, and contact email. They cannot see your payment details or GSTIN.</li>
                <li><strong className="font-semibold text-slate-800">Razorpay:</strong> Your billing information is shared with Razorpay solely to process payments. Razorpay's privacy policy governs their use of this data.</li>
                <li><strong className="font-semibold text-slate-800">Legal requirements:</strong> We may disclose information when required by Indian law, court order, or governmental authority.</li>
              </ul>
              <p>We never share personal data with third-party advertisers, data brokers, or unaffiliated companies.</p>
            </Section>

            <Section id="data-security" title="4. Data Security">
              <p>We implement industry-standard security measures to protect your data:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>All data is encrypted in transit using TLS 1.2+</li>
                <li>Passwords are hashed using bcrypt — we cannot recover plaintext passwords</li>
                <li>Role-based access control ensures ticket data is only visible to authorised users</li>
                <li>Database backups are encrypted at rest</li>
                <li>Engineers undergo identity verification before accessing the platform</li>
              </ul>
              <p>Despite these measures, no system is 100% secure. If you suspect a security issue, contact us immediately at <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a>.</p>
            </Section>

            <Section id="data-retention" title="5. Data Retention">
              <p>We retain your data for as long as your account is active and for a period of 7 years thereafter to comply with Indian tax and financial regulations (GST invoice records).</p>
              <p>If you request account deletion, we will delete your personal profile data within 30 days. Billing records and transaction logs are retained for 7 years as required by law.</p>
              <p>To request account deletion, contact <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a>.</p>
            </Section>

            <Section id="cookies" title="6. Cookies">
              <p>We use the following cookies:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="font-semibold text-slate-800">Authentication cookies:</strong> To keep you logged in securely across sessions. These are session-scoped and expire when you log out.</li>
                <li><strong className="font-semibold text-slate-800">CSRF tokens:</strong> To protect against cross-site request forgery attacks.</li>
              </ul>
              <p>We do not use analytics cookies from Google or Meta. We do not serve third-party advertising cookies.</p>
            </Section>

            <Section id="your-rights" title="7. Your Rights">
              <p>Under applicable Indian data protection law and our policies, you have the right to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="font-semibold text-slate-800">Access:</strong> Request a copy of the personal data we hold about you</li>
                <li><strong className="font-semibold text-slate-800">Correction:</strong> Update inaccurate personal data via Settings or by contacting us</li>
                <li><strong className="font-semibold text-slate-800">Deletion:</strong> Request deletion of your account and personal data (subject to legal retention requirements)</li>
                <li><strong className="font-semibold text-slate-800">Portability:</strong> Request an export of your ticket and billing data in a machine-readable format</li>
                <li><strong className="font-semibold text-slate-800">Complaint:</strong> Lodge a complaint with the appropriate data protection authority</li>
              </ul>
              <p>To exercise any of these rights, email <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a>. We respond within 15 business days.</p>
            </Section>

            <Section id="contact" title="8. Contact Us">
              <p>For privacy-related questions or requests:</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2 space-y-1.5">
                <p><strong className="font-semibold text-slate-800">Friday Tech Systems Pvt. Ltd.</strong></p>
                <p>Bengaluru, Karnataka, India</p>
                <p>Email: <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a></p>
                <p>Phone: {CONTACT.tollFree} (Toll-free)</p>
              </div>
              <p className="mt-3">We may update this Privacy Policy from time to time. Changes will be notified via email and the "Last updated" date above will be revised.</p>
            </Section>
          </div>

          {/* Sidebar nav */}
          <nav className="hidden lg:block sticky top-24 space-y-1" aria-label="Privacy policy sections">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-2">On this page</p>
            {SECTIONS.map(({ id, label }) => (
              <a key={id} href={`#${id}`}
                 className="block px-3 py-2 text-sm text-slate-500 hover:text-indigo-600
                            hover:bg-indigo-50 rounded-lg transition-colors">
                {label}
              </a>
            ))}
            <div className="pt-4 border-t border-slate-100 mt-4">
              <Link to="/terms"
                    className="block px-3 py-2 text-sm text-slate-500 hover:text-indigo-600
                               hover:bg-indigo-50 rounded-lg transition-colors">
                Terms of Service →
              </Link>
            </div>
          </nav>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
