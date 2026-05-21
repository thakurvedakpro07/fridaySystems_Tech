import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import NotificationBell from "../ui/NotificationBell";

function UserAvatar({ email }) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "??";
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full
                 bg-indigo-100 text-indigo-700 text-xs font-semibold select-none shrink-0"
      title={email}
      aria-label={`Signed in as ${email}`}
    >
      {initials}
    </span>
  );
}

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors duration-150
        ${active
          ? "text-indigo-600 bg-indigo-50"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
    >
      {children}
    </Link>
  );
}

export default function Header() {
  const { isAuthenticated, logout } = useAuth();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-brand-gradient rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-[0.9375rem] font-bold text-slate-900 tracking-tight">SupportMitra</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              {user?.is_staff ? (
                <NavLink to="/admin">Dashboard</NavLink>
              ) : user?.role === "freelancer" ? (
                <NavLink to="/freelancer">My Tickets</NavLink>
              ) : (
                <NavLink to="/dashboard">Dashboard</NavLink>
              )}

              {!user?.is_staff && user?.role !== "freelancer" && (
                <Link
                  to="/tickets/new"
                  className="ml-1 inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm
                             font-medium px-3.5 py-1.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800
                             transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Ticket
                </Link>
              )}

              <div className="ml-1">
                <NotificationBell />
              </div>

              <UserAvatar email={user?.email} />

              <button
                onClick={logout}
                className="ml-1 text-xs text-slate-500 hover:text-slate-900 border border-slate-200
                           hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-all duration-150
                           focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors">
                Sign in
              </Link>
              <Link
                to="/register"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg
                           hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
