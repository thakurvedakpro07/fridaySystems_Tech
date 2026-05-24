import { useEffect, useState } from "react";

/**
 * Mounts a top-of-page banner when the browser loses network connectivity.
 * Shows a green "reconnected" flash for 3 seconds when connectivity is restored.
 * Rendered inside App.jsx so it's globally visible across all pages.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer;

    function handleOffline() {
      setIsOffline(true);
      setShowReconnected(false);
    }

    function handleOnline() {
      setIsOffline(false);
      setShowReconnected(true);
      reconnectTimer = setTimeout(() => setShowReconnected(false), 3000);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearTimeout(reconnectTimer);
    };
  }, []);

  if (isOffline) {
    return (
      <div
        role="alert"
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2
                   bg-slate-900 text-white text-sm font-medium py-2 px-4 animate-fade-in"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
        </svg>
        You're offline — some features may not work until your connection is restored.
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2
                   bg-emerald-600 text-white text-sm font-medium py-2 px-4 animate-fade-in"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Back online — you're reconnected.
      </div>
    );
  }

  return null;
}
