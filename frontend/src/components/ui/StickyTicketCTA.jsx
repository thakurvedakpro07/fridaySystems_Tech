import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function StickyTicketCTA() {
  const [show, setShow] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Freelancers and staff have their own navigation — no CTA needed
  if (user?.role === "freelancer" || user?.is_staff) return null;

  const href = isAuthenticated ? "/tickets/new" : "/register";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          aria-hidden={!show}
        >
          <Link
            to={href}
            className="flex flex-col items-center bg-indigo-600 hover:bg-indigo-700
                       active:bg-indigo-800 text-white rounded-2xl shadow-lg hover:shadow-xl
                       px-5 py-3.5 transition-colors duration-150
                       border border-indigo-500/30 group
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            aria-label="Create a support ticket"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-[10px] font-semibold text-indigo-200 uppercase tracking-widest">
                Need IT Help?
              </span>
            </div>
            <span className="text-sm font-black flex items-center gap-1.5">
              Create Ticket
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
