/**
 * Popover — lightweight, non-blocking anchored panel.
 *
 * Unlike Modal, this has no backdrop and doesn't block the page — it's for
 * routine actions (quick-request templates, a single URL input) that
 * shouldn't interrupt the user with a confirmation dialog.
 */
import { useEffect, useRef } from "react";

export default function Popover({ isOpen, onClose, anchorClassName = "", children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={`absolute z-40 mt-2 bg-white border border-slate-200 rounded-xl
                  animate-fade-in ${anchorClassName}`}
      style={{ boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.18), 0 4px 12px -2px rgb(0 0 0 / 0.08)" }}
    >
      {children}
    </div>
  );
}
