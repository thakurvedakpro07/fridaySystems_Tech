// Temporary placeholder contact information. Replace before production launch.
import { CONTACT } from "../../config/contact";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* Brand + beta badge */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-800">ResolveHQ</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold
                             bg-indigo-50 text-indigo-600 border border-indigo-100">
              Beta
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-400">© {new Date().getFullYear()} Friday Tech Systems</span>
          </div>

          {/* Contact + links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            <a
              href={CONTACT.supportMailto}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {CONTACT.supportEmail}
            </a>
            <span className="text-slate-200 hidden sm:inline">·</span>
            <a
              href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              {CONTACT.tollFree}
            </a>
            <span className="text-slate-200 hidden sm:inline">·</span>
            <span className="text-xs text-slate-400">{CONTACT.businessHours}</span>
          </div>

        </div>
      </div>
    </footer>
  );
}
