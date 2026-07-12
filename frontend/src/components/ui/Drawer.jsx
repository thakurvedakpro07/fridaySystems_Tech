/**
 * Drawer — right-side slide-over panel.
 *
 * Deliberately NOT built on Modal.jsx and doesn't touch it. A drawer here
 * has different requirements than a centered dialog: no document.body
 * scroll lock (the page behind must stay fully scrollable), no full-screen
 * backdrop blocking interaction with the rest of the page (so no
 * click-outside-to-close either — there's nothing to click), and it slides
 * in from the right instead of fading/scaling in centered. Forcing all of
 * that into Modal.jsx via extra conditional props would have complicated
 * the two other call sites (AdminTicketActions' three modals) that still
 * want the standard centered/backdrop/body-locked behavior untouched.
 *
 * Visual language (motion.div, slide-in spring, header/footer chrome)
 * mirrors the existing HistoryDrawer in OpsAssignments.jsx, minus its
 * full-screen backdrop — this has its own, much lighter backdrop below,
 * purely for visual contrast, with pointer-events disabled so it never
 * blocks interaction with the page behind it.
 *
 * Sizing: no fixed `height` — the panel's height is its content (header +
 * body + footer), capped by `maxHeight`. That's deliberate: a flex column
 * with an explicit top+bottom (or a bare height) forces the middle `flex:1`
 * region to stretch and fill whatever space is left, even when the actual
 * form content is short — that's what produced the large empty gap above
 * the footer. Letting height be "content, up to a cap" means a short form
 * hugs its own content and a long one caps out and scrolls, in both cases
 * with no forced empty space.
 *
 * Usage: mount/unmount this component itself based on your own "open"
 * state, wrapped in <AnimatePresence> — e.g. `{open && <Drawer .../>}` —
 * rather than passing an `isOpen` prop. That's what lets framer-motion play
 * the slide-out exit animation on close.
 */
import { useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export default function Drawer({ onClose, title, children, footer }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useFocusTrap(panelRef);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Purely decorative — pointer-events-none so the page behind stays
          fully clickable/scrollable, matching the drawer's "page remains
          fully visible and interactive" requirement. Not part of the
          accessible tree. */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-slate-900/10 pointer-events-none"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 z-50 bg-white border border-slate-200 rounded-l-2xl overflow-hidden"
        style={{
          top: "16px",
          maxHeight: "calc(100vh - 32px)",
          width: "500px",
          maxWidth: "92vw",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px -8px rgb(0 0 0 / 0.18), -2px 0 8px -2px rgb(0 0 0 / 0.08)",
        }}
      >
        {/* Header — flex-shrink: 0, always visible above the scroll area */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
          style={{ flexShrink: 0 }}
        >
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500
                       hover:text-slate-700 hover:bg-slate-100 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — the only scrollable region, same proven flex:1/min-height:0/
            overflow-y:auto structure as Modal.jsx's body (inline styles, not
            just Tailwind classes, for the same reason documented there). */}
        <div
          className="px-6 py-5"
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        >
          {children}
        </div>

        {/* Footer — optional, flex-shrink: 0, pinned below the scroll area */}
        {footer && (
          <div
            className="px-6 py-5 border-t border-slate-100"
            style={{ flexShrink: 0 }}
          >
            {footer}
          </div>
        )}
      </motion.div>
    </>
  );
}
