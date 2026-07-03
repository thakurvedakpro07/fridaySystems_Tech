import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastCtx = createContext(null);

const STYLES = {
  success: { bar: "bg-emerald-500", icon: "✓", bg: "bg-white", text: "text-emerald-700", border: "border-emerald-200" },
  error:   { bar: "bg-rose-500",    icon: "✕", bg: "bg-white", text: "text-rose-700",    border: "border-rose-200" },
  info:    { bar: "bg-indigo-500",  icon: "ℹ", bg: "bg-white", text: "text-indigo-700",  border: "border-indigo-200" },
  warning: { bar: "bg-amber-500",   icon: "⚠", bg: "bg-white", text: "text-amber-700",   border: "border-amber-200" },
};

const DURATIONS = {
  success: 3000,
  info:    4000,
  warning: 5000,
  error:   6000,
};

function Toast({ toast, onClose }) {
  useEffect(() => {
    const ms = DURATIONS[toast.type] ?? 4000;
    const timer = setTimeout(onClose, ms);
    return () => clearTimeout(timer);
  }, [onClose, toast.type]);

  const s = STYLES[toast.type] ?? STYLES.info;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-dropdown
                  min-w-[280px] max-w-sm animate-slide-in-right ${s.bg} ${s.border}`}
      role="alert"
    >
      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5 ${s.bar}`}>
        {s.icon}
      </span>
      <span className="flex-1 text-sm text-slate-800 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        className="shrink-0 text-slate-500 hover:text-slate-700 mt-0.5 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
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
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
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

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
