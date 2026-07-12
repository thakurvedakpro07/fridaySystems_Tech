/**
 * useFocusTrap — confines Tab/Shift+Tab cycling to the focusable elements
 * inside `containerRef` for as long as the owning component is mounted,
 * moves focus into the container on mount, and restores focus to whatever
 * was focused beforehand once it unmounts.
 *
 * No focus-trap library or utility existed anywhere in this codebase
 * (checked) — built from scratch, deliberately small and single-purpose.
 * Intended for components that mount/unmount themselves based on an "open"
 * condition in the parent (e.g. `{open && <Drawer ref={r} />}`) rather than
 * always being mounted with an internal `isOpen` prop — the effect here
 * runs for the component's entire mounted lifetime.
 */
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useFocusTrap(containerRef) {
  const previouslyFocused = useRef(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const container = containerRef.current;

    const getFocusable = () =>
      container
        ? Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null)
        : [];

    // Land keyboard focus inside the panel as soon as it mounts.
    (getFocusable()[0] ?? container)?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [containerRef]);
}
