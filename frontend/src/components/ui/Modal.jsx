import { useEffect, useId } from "react";

// Module-level, shared by every mounted Modal instance — see the body-lock
// effect below for why this can't just be `document.body.style.overflow =
// isOpen ? "hidden" : ""` per instance.
let openModalCount = 0;

export default function Modal({ isOpen, onClose, title, children, footer, footerClassName }) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reference-counted, not "isOpen ? hidden : ''" per instance. Root cause
  // this fixes: as of Phase 4.5, some flows close one Modal and open a
  // different Modal instance in the same click (AdminTicketActions closing
  // its Change Status modal while handing off to ResolutionPanel's modal).
  // Both state updates land in the same React commit; React runs every
  // affected effect's cleanup first, then every new effect body. With the
  // old unconditional `document.body.style.overflow = isOpen ? ... : ""`,
  // whichever Modal instance's effect happened to run last in that commit
  // won, regardless of which modal was actually left open on screen — so
  // the modal you could see and the body's scroll-lock state could
  // silently disagree (background not actually locked, or locked with
  // nothing visibly open to unlock it), and which one "won" depended on
  // component tree order, not on what's true — hence intermittent, not
  // every time. Counting how many Modals are currently open and only
  // touching the body style at the 0→1 and 1→0 transitions makes the lock
  // state correct regardless of how many Modals swap open/closed in the
  // same commit, or in what order their effects happen to run.
  useEffect(() => {
    if (!isOpen) return;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = "";
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" />

      {/* Dialog — capped to the viewport height and laid out as a column so
          only the body (not the header/footer) ever scrolls. The structural
          properties (max-height/flex/overflow) are set as literal inline
          styles rather than left to Tailwind utility classes alone — those
          classes are still present for documentation/consistency, but the
          inline styles are what the browser actually guarantees, with no
          dependency on class generation order or cascade specificity. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-white rounded-2xl w-full max-w-md animate-slide-up overflow-hidden"
        style={{
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px -8px rgb(0 0 0 / 0.22), 0 8px 24px -4px rgb(0 0 0 / 0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — flex-shrink: 0 so it always stays fully visible above the scroll area */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
          style={{ flexShrink: 0 }}
        >
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500
                       hover:text-slate-700 hover:bg-slate-100 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — the ONLY scrollable region: flex: 1 lets it fill the
            remaining space between header and footer, min-height: 0
            overrides the flex-item default (min-height: auto) that would
            otherwise let this box grow past the dialog's max-height to fit
            its content instead of scrolling, and overflow-y: auto is what
            actually produces the scrollbar once content exceeds that space. */}
        <div
          className="px-6 py-5"
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        >
          {children}
        </div>

        {/* Footer — optional, flex-shrink: 0, stays pinned below the scroll
            area. Existing callers that don't pass `footer` are unaffected:
            their action buttons still render inside the scrollable body
            exactly as before. `footerClassName`, when passed, REPLACES the
            default padding rather than appending to it — two Tailwind
            classes that both set padding (e.g. the default `py-4` and a
            caller's `py-5`) have equal specificity, so which one wins would
            depend on generated stylesheet order, not JSX order; replacing
            avoids that ambiguity entirely. */}
        {footer && (
          <div
            className={`border-t border-slate-100 ${footerClassName ?? "px-6 py-4"}`}
            style={{ flexShrink: 0 }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
