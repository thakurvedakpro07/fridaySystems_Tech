/**
 * Modal — accessible dialog overlay for confirmations and forms.
 *
 * Features:
 *   • Click-outside closes the modal
 *   • Escape key closes the modal
 *   • Scroll locked on body while open
 *   • Slide-up + fade-in animation
 *   • Accessible: role="dialog", aria-modal, aria-labelledby
 *
 * Usage:
 *   <Modal isOpen={show} onClose={() => setShow(false)} title="Confirm">
 *     <p>Are you sure?</p>
 *   </Modal>
 */
import { useEffect, useId } from "react";

export default function Modal({ isOpen, onClose, title, children }) {
  const titleId = useId();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400
                       hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none
                       focus:ring-2 focus:ring-gray-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
