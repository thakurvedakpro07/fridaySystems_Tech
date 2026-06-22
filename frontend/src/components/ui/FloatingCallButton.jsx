import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { CONTACT } from "../../config/contact";

export default function FloatingCallButton() {
  const user = useAuthStore((s) => s.user);

  // Admins see a different UI — no call CTA needed there
  if (user?.is_staff) return null;

  const tel = `tel:${CONTACT.tollFree.replace(/-/g, "")}`;

  return (
    <>
      {/* ── Desktop: fixed bottom-right button with periodic pulse ── */}
      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        {/* Pulse ring fires once every 15 s — 1.2 s animate, 13.8 s rest */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ boxShadow: ["0 0 0 0px rgba(16,185,129,0.5)", "0 0 0 12px rgba(16,185,129,0)", "0 0 0 0px rgba(16,185,129,0)"] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 13.8, ease: "easeOut" }}
        />
        <a
          href={tel}
          aria-label={`Call support on ${CONTACT.tollFree}`}
          className="relative flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                     text-white font-semibold text-sm px-6 py-3.5 rounded-2xl
                     shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40
                     transition-all duration-200 hover:-translate-y-0.5 border border-emerald-500/30 group"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
          <div>
            <span className="block text-emerald-200 text-[10px] font-bold uppercase tracking-widest leading-none mb-0.5">
              Call Support
            </span>
            <span className="block font-black text-white text-sm leading-none">{CONTACT.tollFree}</span>
          </div>
        </a>
      </div>

      {/* ── Mobile: sticky bottom bar ────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-50 sm:hidden">
        <a
          href={tel}
          aria-label={`Call support on ${CONTACT.tollFree}`}
          className="flex items-center justify-center gap-3 py-4 px-6
                     bg-emerald-600 active:bg-emerald-700 text-white w-full
                     shadow-[0_-4px_16px_rgba(0,0,0,0.15)]"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
          <div>
            <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest leading-none">
              Call Support Now
            </p>
            <p className="text-lg font-black text-white leading-tight">{CONTACT.tollFree}</p>
          </div>
        </a>
      </div>
    </>
  );
}
