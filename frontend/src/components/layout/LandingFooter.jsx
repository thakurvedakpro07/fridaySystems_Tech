// Temporary placeholder contact information. Replace before production launch.
import { Link } from "react-router-dom";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useToast } from "../../context/ToastContext";
import { CONTACT } from "../../config/contact";

const YEAR = new Date().getFullYear();

const NAV = {
  Product: [
    { label: "How It Works",      href: "/#how-it-works" },
    { label: "Services",          href: "/services",              internal: true },
    { label: "Pricing",           href: "/pricing",               internal: true },
    { label: "About Us",          href: "/about",                 internal: true },
    { label: "Join as Engineer",  href: "/register/freelancer",   internal: true },
    { label: "Contact",           href: "/contact",               internal: true },
  ],
  Platform: [
    { label: "Dashboard",     href: "/dashboard",     internal: true },
    { label: "Analytics",     href: "/analytics",     internal: true },
    { label: "Billing",       href: "/billing",       internal: true },
    { label: "Help Center",   href: "/help-center",   internal: true },
  ],
  Support: [
    { label: "Help Center",   href: "/help-center",  internal: true },
    { label: "Open a Ticket", href: "/register",     internal: true },
    { label: "Contact Us",    href: "/contact",      internal: true },
    { label: "Email Support",  href: CONTACT.supportMailto },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy",  internal: true },
    { label: "Terms of Service", href: "/terms",  internal: true },
    { label: "Refund Policy",  href: "/help-center#refund-policy", internal: true },
    { label: "Cookie Policy",  href: "/privacy#cookies", internal: true },
  ],
};

function FooterLink({ label, href, internal }) {
  if (internal) {
    return (
      <Link to={href} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
      {label}
    </a>
  );
}

export default function LandingFooter() {
  const isMobile = useIsMobile();
  const addToast  = useToast();

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(CONTACT.tollFree);
      addToast("Phone number copied.", "success");
    } catch {
      addToast("Could not copy — please dial manually.", "warning");
    }
  }

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10">

          {/* Brand column — spans 2 */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0 shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-black text-white leading-tight">ResolveHQ</p>
                <p className="text-[11px] text-slate-400 font-semibold leading-tight">Enterprise IT Support Marketplace</p>
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/10 text-indigo-200 border border-white/15 ml-1">
                Beta
              </span>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-xs">
              Expert IT support for Indian SMBs. Pay only when your problem is resolved.
              Verified engineers, transparent pricing.
            </p>

            {/* Contact info block */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a href={CONTACT.supportMailto} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                  {CONTACT.supportEmail}
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {isMobile ? (
                  <a
                    href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
                    aria-label={`Call support: ${CONTACT.tollFree}`}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors
                               focus:outline-none focus:ring-1 focus:ring-slate-400 rounded"
                  >
                    {CONTACT.tollFree} (Toll-free)
                  </a>
                ) : (
                  <button
                    onClick={copyNumber}
                    aria-label="Copy phone number to clipboard"
                    title={`${CONTACT.tollFree} — click to copy`}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors
                               focus:outline-none focus:ring-1 focus:ring-slate-400 rounded"
                  >
                    {CONTACT.tollFree} (Toll-free)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-slate-500">{CONTACT.businessHours}</p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <a href="#" aria-label="Twitter"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(NAV).map(([section, links]) => (
            <div key={section}>
              <p className="text-xs font-black text-slate-200 uppercase tracking-widest mb-5">
                {section}
              </p>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <FooterLink {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            © {YEAR} Friday Tech Systems Pvt. Ltd. · All rights reserved
          </p>
          <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end">
            <span className="text-xs text-slate-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
              Secure Remote Access
            </span>
            <span className="text-xs text-slate-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
              Verified Engineers
            </span>
            <span className="text-xs text-slate-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
              Made in India 🇮🇳
            </span>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md font-semibold">
              ResolveHQ Beta
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
