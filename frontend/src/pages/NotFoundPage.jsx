// Temporary placeholder contact information. Replace before production launch.
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../context/ToastContext";
import { CONTACT } from "../config/contact";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Page Not Found");
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isMobile = useIsMobile();
  const addToast = useToast();

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(CONTACT.tollFree);
      addToast("Phone number copied.", "success");
    } catch {
      addToast("Could not copy — please dial manually.", "warning");
    }
  }

  const homeHref = isAuthenticated
    ? user?.is_staff ? "/admin" : user?.role === "freelancer" ? "/freelancer" : "/dashboard"
    : "/";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="text-8xl font-black text-slate-200 select-none mb-2">404</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-slate-500 text-sm mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to={homeHref}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium
                       px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Go home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="text-sm font-medium px-5 py-2.5 rounded-lg border border-slate-200
                       text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Go back
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-8">
          Still stuck?{" "}
          <a href={CONTACT.supportMailto} className="text-indigo-500 hover:underline">
            {CONTACT.supportEmail}
          </a>
          {" "}·{" "}
          {isMobile ? (
            <a href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
               aria-label={`Call support: ${CONTACT.tollFree}`}
               className="hover:text-slate-600">
              {CONTACT.tollFree}
            </a>
          ) : (
            <button onClick={copyNumber}
                    aria-label="Copy phone number to clipboard"
                    title={`${CONTACT.tollFree} — click to copy`}
                    className="hover:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded">
              {CONTACT.tollFree}
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
