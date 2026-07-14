import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { usePageTitle } from "../hooks/usePageTitle";

export default function ForbiddenPage() {
  usePageTitle("Access Denied");
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const homeHref = isAuthenticated
    ? user?.is_staff ? "/admin" : user?.role === "freelancer" ? "/freelancer" : "/dashboard"
    : "/login";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md animate-fade-in">
        <div className="text-8xl font-black text-slate-200 select-none mb-2">403</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access denied</h1>
        <p className="text-slate-500 text-sm mb-8">
          {isAuthenticated
            ? "You don't have permission to view this page."
            : "You need to be signed in to view this page."}
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
            {isAuthenticated ? "Go home" : "Sign in"}
          </Link>
          <button
            onClick={() => window.history.back()}
            className="text-sm font-medium px-5 py-2.5 rounded-lg border border-slate-200
                       text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
