import { useEffect } from "react";

// Full-screen image viewer for attachment previews. A separate primitive
// from Modal.jsx rather than a forced fit — Modal is capped at max-w-md
// with white-card dialog chrome sized for forms/confirmations, neither of
// which suits viewing a large image against a dark backdrop. Same
// interaction contract as Modal (Escape closes, backdrop click closes,
// body scroll locked while open) minus Modal's multi-instance reference
// counting, since only one lightbox is ever open at a time here.
export default function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm animate-fade-in" />

      <button
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center
                   rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors
                   focus:outline-none focus:ring-2 focus:ring-white/50"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-scale-in"
      />

      {alt && (
        <p
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/40
                     px-3 py-1.5 rounded-full max-w-[90vw] truncate"
        >
          {alt}
        </p>
      )}
    </div>
  );
}
