import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import LandingFooter from "../components/layout/LandingFooter";
import { CONTACT } from "../config/contact";

const SECTIONS = [
  { id: "acceptance",      label: "Acceptance of Terms" },
  { id: "services",        label: "Description of Services" },
  { id: "accounts",        label: "User Accounts" },
  { id: "payments",        label: "Payments & Refunds" },
  { id: "engineer-terms",  label: "Engineer Obligations" },
  { id: "prohibited",      label: "Prohibited Conduct" },
  { id: "ip",              label: "Intellectual Property" },
  { id: "liability",       label: "Limitation of Liability" },
  { id: "termination",     label: "Termination" },
  { id: "governing-law",   label: "Governing Law" },
  { id: "contact",         label: "Contact" },
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

export default function TermsPage() {
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
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">Terms of Service</h1>
          <p className="text-slate-500 text-base leading-relaxed">
            Effective date: January 1, 2025 &nbsp;·&nbsp; Last updated: June 2026
          </p>
          <p className="text-slate-500 text-base leading-relaxed mt-2 max-w-2xl">
            These Terms of Service ("Terms") govern your use of the ResolveHQ platform operated by
            Friday Tech Systems Pvt. Ltd. ("Company", "we", "us"). By using ResolveHQ, you agree to these Terms.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-12 items-start">
          <div className="space-y-10">

            <Section id="acceptance" title="1. Acceptance of Terms">
              <p>By creating an account or using any feature of ResolveHQ, you confirm that you:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Are at least 18 years of age</li>
                <li>Have the authority to enter into these Terms on behalf of any company you represent</li>
                <li>Accept these Terms in full, including our Privacy Policy</li>
              </ul>
              <p>If you do not agree, you must not use ResolveHQ.</p>
            </Section>

            <Section id="services" title="2. Description of Services">
              <p>ResolveHQ is an IT support marketplace that connects businesses ("Customers") with verified freelance IT engineers ("Engineers"). We provide:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>A ticketing platform for submitting IT support requests</li>
                <li>An engineer matching and assignment system</li>
                <li>Secure payment processing via Razorpay</li>
                <li>GST-compliant invoice generation</li>
                <li>Real-time ticket tracking and notification services</li>
              </ul>
              <p>ResolveHQ acts as a marketplace intermediary. We do not directly provide IT services — Engineers are independent contractors, not employees of Friday Tech Systems Pvt. Ltd.</p>
            </Section>

            <Section id="accounts" title="3. User Accounts">
              <p>You are responsible for:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activity that occurs under your account</li>
                <li>Providing accurate information, including your GSTIN if you require B2B invoices</li>
              </ul>
              <p>You must notify us immediately at <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a> if you suspect unauthorised access to your account.</p>
              <p>We reserve the right to suspend accounts that violate these Terms or engage in suspicious activity.</p>
            </Section>

            <Section id="payments" title="4. Payments & Refunds">
              <p><strong className="font-semibold text-slate-800">Consulting fee:</strong> A flat ₹299 (plus 18% GST) consulting fee is charged when you submit a ticket. This fee covers ticket creation, Support Agent consultation, issue diagnosis, and engineer assignment. It does not cover issue resolution.</p>
              <p><strong className="font-semibold text-slate-800">Resolution fee:</strong> An additional resolution fee (₹499–₹1,999 depending on complexity) is charged only after your issue is confirmed as resolved. The exact amount is disclosed before billing.</p>
              <p><strong className="font-semibold text-slate-800">Automatic refund:</strong> If no Support Agent begins the consultation within 4 hours of ticket creation, the consulting fee is automatically refunded to your original payment method within 5–7 business days.</p>
              <p><strong className="font-semibold text-slate-800">Disputed resolution:</strong> If you dispute the resolution, contact billing within 48 hours. We review all disputes and issue refunds when the engineer's work is found to be unsatisfactory.</p>
              <p><strong className="font-semibold text-slate-800">Non-refundable cases:</strong> The consulting fee is non-refundable if an engineer has spent 30+ minutes on your ticket, unless the resolution is disputed and upheld by our team.</p>
              <p><strong className="font-semibold text-slate-800">Payment processor:</strong> All payments are processed by Razorpay. Razorpay's Terms and Privacy Policy apply to payment data. We do not store card numbers.</p>
            </Section>

            <Section id="engineer-terms" title="5. Engineer Obligations">
              <p>Engineers on ResolveHQ agree to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Provide only accurate information about their skills and certifications</li>
                <li>Maintain the confidentiality of customer data accessed during ticket resolution</li>
                <li>Begin the consultation within the response window defined by the ticket's severity tier</li>
                <li>Not solicit customers to engage outside the platform to avoid platform fees</li>
                <li>Comply with the ResolveHQ Code of Conduct, which is provided during onboarding</li>
              </ul>
              <p>Engineers who violate these obligations may be permanently removed from the platform and forfeit pending payouts.</p>
            </Section>

            <Section id="prohibited" title="6. Prohibited Conduct">
              <p>You may not:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Use ResolveHQ for any unlawful purpose</li>
                <li>Attempt to gain unauthorised access to other users' accounts or data</li>
                <li>Submit false, misleading, or fraudulent tickets</li>
                <li>Use the platform to transmit malware, spam, or malicious code</li>
                <li>Circumvent security measures or attempt to reverse-engineer the platform</li>
                <li>Engage in abusive, threatening, or discriminatory behaviour toward engineers or staff</li>
                <li>Attempt to arrange off-platform payments with engineers to bypass our fee structure</li>
              </ul>
              <p>Violation of prohibited conduct may result in immediate account suspension and potential legal action.</p>
            </Section>

            <Section id="ip" title="7. Intellectual Property">
              <p>The ResolveHQ platform, including its design, code, trademarks, and content, is owned by Friday Tech Systems Pvt. Ltd. and protected by applicable intellectual property laws.</p>
              <p>You retain ownership of any content you upload (ticket descriptions, attachments). By uploading, you grant us a limited licence to use, store, and display this content solely to operate the service.</p>
              <p>You may not reproduce, distribute, or create derivative works from our platform content without our written permission.</p>
            </Section>

            <Section id="liability" title="8. Limitation of Liability">
              <p>ResolveHQ is provided on an "as is" basis. To the maximum extent permitted by law:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>We do not warrant that the platform will be uninterrupted or error-free</li>
                <li>We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform</li>
                <li>Our total liability for any claim is limited to the fees you paid to us in the 3 months preceding the claim</li>
              </ul>
              <p>Nothing in these Terms limits liability for fraud, death, or personal injury caused by our negligence.</p>
            </Section>

            <Section id="termination" title="9. Termination">
              <p>You may close your account at any time by contacting <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a>.</p>
              <p>We may terminate or suspend your account if you breach these Terms, engage in fraudulent activity, or if required by law.</p>
              <p>Upon termination, your access to the platform will cease. Billing records are retained for 7 years as required by Indian tax law.</p>
            </Section>

            <Section id="governing-law" title="10. Governing Law">
              <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.</p>
              <p>We will attempt to resolve disputes informally before initiating formal proceedings. Contact <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a> to raise a dispute.</p>
              <p>We may update these Terms. We will notify registered users by email at least 14 days before changes take effect. Continued use after that date constitutes acceptance of the revised Terms.</p>
            </Section>

            <Section id="contact" title="11. Contact">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                <p><strong className="font-semibold text-slate-800">Friday Tech Systems Pvt. Ltd.</strong></p>
                <p>Bengaluru, Karnataka, India</p>
                <p>Email: <a href={CONTACT.supportMailto} className="text-indigo-600 hover:underline">{CONTACT.supportEmail}</a></p>
                <p>Phone: {CONTACT.tollFree} (Toll-free)</p>
              </div>
            </Section>
          </div>

          {/* Sidebar nav */}
          <nav className="hidden lg:block sticky top-24 space-y-1" aria-label="Terms sections">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-2">On this page</p>
            {SECTIONS.map(({ id, label }) => (
              <a key={id} href={`#${id}`}
                 className="block px-3 py-2 text-sm text-slate-500 hover:text-indigo-600
                            hover:bg-indigo-50 rounded-lg transition-colors">
                {label}
              </a>
            ))}
            <div className="pt-4 border-t border-slate-100 mt-4">
              <Link to="/privacy"
                    className="block px-3 py-2 text-sm text-slate-500 hover:text-indigo-600
                               hover:bg-indigo-50 rounded-lg transition-colors">
                Privacy Policy →
              </Link>
            </div>
          </nav>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
