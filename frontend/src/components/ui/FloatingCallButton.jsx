import { useAuthStore } from "../../store/authStore";
import { CONTACT } from "../../config/contact";

const PHONE_PATH =
  "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z";

function PhoneIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={PHONE_PATH} />
    </svg>
  );
}

// ── Desktop call button — rendered inside the shared floating column in App.jsx.
// Compact green button, visually secondary to the indigo Create Ticket CTA above it.
export function PhoneSupportWidget() {
  const user = useAuthStore((s) => s.user);
  if (user?.is_staff) return null;

  return (
    <a
      href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
      aria-label={`Call support: ${CONTACT.tollFree}`}
      className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                 text-white px-5 py-3 rounded-2xl shadow-md shadow-emerald-600/20
                 hover:shadow-lg hover:shadow-emerald-600/30 border border-emerald-500/30
                 transition-all duration-200 hover:-translate-y-0.5
                 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
    >
      <PhoneIcon className="w-4 h-4" />
      <div>
        <span className="block text-emerald-200 text-[10px] font-bold uppercase tracking-widest leading-none mb-0.5">
          Call Support
        </span>
        <span className="block font-black text-white text-sm leading-none">
          {CONTACT.tollFree}
        </span>
      </div>
    </a>
  );
}

// ── Mobile sticky bottom bar — full-width tel: link, hidden on sm+ screens.
// Rendered in App.jsx outside the desktop column so it spans the full viewport width.
export default function FloatingCallButton() {
  const user = useAuthStore((s) => s.user);
  if (user?.is_staff) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 sm:hidden">
      <a
        href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
        aria-label={`Call support: ${CONTACT.tollFree}`}
        className="flex items-center justify-center gap-3 py-4 px-6
                   bg-emerald-600 active:bg-emerald-700 text-white w-full
                   shadow-[0_-4px_16px_rgba(0,0,0,0.15)]
                   focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-inset"
      >
        <PhoneIcon />
        <div>
          <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest leading-none">
            Call Support Now
          </p>
          <p className="text-lg font-black text-white leading-tight">{CONTACT.tollFree}</p>
        </div>
      </a>
    </div>
  );
}
