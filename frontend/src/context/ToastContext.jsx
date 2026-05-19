/**
 * Toast notification system.
 *
 * A "toast" is a small pop-up message that appears briefly then disappears.
 * Examples: "Ticket created successfully", "Failed to load comments".
 *
 * HOW IT WORKS:
 *   1. Wrap your app in <ToastProvider> (done in App.jsx)
 *   2. In any component: const toast = useToast()
 *   3. Call: toast("Ticket saved!", "success")
 *      or:   toast("Network error", "error")
 *   4. The message appears in the bottom-right corner for 4 seconds
 *
 * WHY React Context?
 *   Toasts can be triggered from anywhere — a form deep in the tree,
 *   a hook, a page. Context lets any component access addToast without
 *   passing it down through every parent as a prop.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastCtx = createContext(null);

const TYPE_STYLES = {
  success: "bg-green-600 text-white",
  error:   "bg-red-600 text-white",
  info:    "bg-gray-800 text-white",
  warning: "bg-yellow-500 text-white",
};

const TYPE_ICONS = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
  warning: "⚠",
};

function Toast({ toast, onClose }) {
  // Auto-dismiss after 4 seconds. useEffect cleanup cancels the timer
  // if the toast is manually closed before 4s expire.
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info;
  const icon   = TYPE_ICONS[toast.type]  ?? TYPE_ICONS.info;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm
                  min-w-[260px] max-w-sm animate-fade-in ${styles}`}
      role="alert"
    >
      <span className="text-base font-bold opacity-90">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 text-lg leading-none ml-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const addToast = useCallback((message, type = "info") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      {/* Fixed overlay container — toasts stack from the bottom */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/**
 * useToast — returns a function to trigger a toast from any component.
 *
 * Usage:
 *   const toast = useToast();
 *   toast("Saved!", "success");
 *   toast("Network error", "error");
 *   toast("Loading data…");          // defaults to "info"
 */
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
