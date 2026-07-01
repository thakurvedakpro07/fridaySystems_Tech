import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useToast } from "../../context/ToastContext";
import NotificationBell from "../ui/NotificationBell";
import { getDisplayName } from "../../utils/displayName";
import { CONTACT } from "../../config/contact";


function UserAvatar({ user }) {
  const first    = (user?.first_name ?? "").trim();
  const last     = (user?.last_name  ?? "").trim();
  const initials = first && last
    ? `${first[0]}${last[0]}`.toUpperCase()
    : first
    ? first.slice(0, 2).toUpperCase()
    : (user?.email ?? "??").slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full
                 bg-indigo-100 text-indigo-700 text-xs font-semibold select-none shrink-0"
      title={user?.email}
      aria-label={`Signed in as ${user?.email}`}
    >
      {initials}
    </span>
  );
}

function NavLink({ to, children, onClick }) {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-150
        ${active
          ? "text-indigo-600 bg-indigo-50"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
    >
      {children}
    </Link>
  );
}

function PhoneNavButton() {
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

  if (isMobile) {
    return (
      <a
        href={`tel:${CONTACT.tollFree.replace(/-/g, "")}`}
        aria-label={`Call support: ${CONTACT.tollFree}`}
        title={`Call ${CONTACT.tollFree}`}
        className="p-2.5 rounded-xl hover:bg-emerald-50 transition-colors
                   text-slate-400 hover:text-emerald-600 border border-transparent hover:border-emerald-100
                   focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      </a>
    );
  }

  return (
    <button
      onClick={copyNumber}
      aria-label={`Copy phone number ${CONTACT.tollFree} to clipboard`}
      title={`${CONTACT.tollFree} — click to copy`}
      className="p-2.5 rounded-xl hover:bg-emerald-50 transition-colors
                 text-slate-400 hover:text-emerald-600 border border-transparent hover:border-emerald-100
                 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    </button>
  );
}

export default function Header() {
  const { isAuthenticated, logout } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">

      {/* ── Main header row ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[80px] flex items-center justify-between gap-4">

        {/* ── Brand ──────────────────────────────────────────── */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group" onClick={closeMenu}>
          <div className="w-[50px] h-[50px] bg-brand-gradient rounded-xl flex items-center justify-center
                          shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-[1.75rem] font-black text-slate-900 leading-tight tracking-tight">ResolveHQ</p>
            <p className="text-[11px] text-slate-400 leading-tight font-semibold tracking-wider hidden sm:block">
              Enterprise IT Support Marketplace
            </p>
          </div>
        </Link>

        {/* ── Desktop nav ────────────────────────────────────── */}
        <nav className="hidden sm:flex items-center gap-1.5">
          {isAuthenticated ? (
            <>
              {user?.is_staff && user?.role === "admin" ? (
                <NavLink to="/admin">Dashboard</NavLink>
              ) : user?.role === "operations_manager" ? (
                <NavLink to="/operations">Ops Dashboard</NavLink>
              ) : user?.role === "freelancer" ? (
                <NavLink to="/freelancer">My Tickets</NavLink>
              ) : (
                <NavLink to="/dashboard">Dashboard</NavLink>
              )}

              {!user?.is_staff && user?.role !== "freelancer" && user?.role !== "operations_manager" && (
                <Link
                  to="/tickets/new"
                  className="ml-1 inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm
                             font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 active:bg-indigo-800
                             transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Ticket
                </Link>
              )}

              {user?.is_staff && user?.role === "admin" ? (
                <NavLink to="/admin/analytics">Analytics</NavLink>
              ) : user?.role === "operations_manager" ? null : (
                <NavLink to="/analytics">Analytics</NavLink>
              )}

              {user?.is_staff && user?.role === "admin" ? (
                <NavLink to="/admin/payments">Payments</NavLink>
              ) : user?.role === "operations_manager" || user?.role === "freelancer" ? null : (
                <NavLink to="/billing">Billing</NavLink>
              )}

              <div className="ml-1">
                <NotificationBell />
              </div>

              <Link to="/settings" title="Account settings" className="ml-1">
                <UserAvatar user={user} />
              </Link>

              <button
                onClick={logout}
                className="ml-2 text-xs font-medium text-slate-500 hover:text-slate-900
                           border border-slate-200 hover:border-slate-300
                           px-3 py-2 rounded-xl transition-all duration-150
                           focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/services">Services</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/pricing">Pricing</NavLink>
              <NavLink to="/register/freelancer">Join as Engineer</NavLink>
              <NavLink to="/contact">Contact</NavLink>
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900
                           px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors ml-1"
              >
                Sign In
              </Link>
              <PhoneNavButton />
              <Link
                to="/register"
                className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                           hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
              >
                Create Ticket
              </Link>
            </>
          )}
        </nav>

        {/* ── Mobile right: bell + hamburger ─────────────────── */}
        <div className="flex sm:hidden items-center gap-2">
          {isAuthenticated && <NotificationBell />}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200
                       transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>


      {/* ── Mobile dropdown ─────────────────────────────────── */}
      {menuOpen && (
        <div className="sm:hidden border-t border-slate-100 bg-white/98 backdrop-blur-md
                        px-4 pb-5 pt-3 animate-fade-in">
          {isAuthenticated ? (
            <div className="space-y-1">
              {/* User info */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50 border border-slate-100 mb-3">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  {getDisplayName(user, "full") && (
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {getDisplayName(user, "full")}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>

              {user?.is_staff && user?.role === "admin" ? (
                <NavLink to="/admin" onClick={closeMenu}>Dashboard</NavLink>
              ) : user?.role === "operations_manager" ? (
                <NavLink to="/operations" onClick={closeMenu}>Ops Dashboard</NavLink>
              ) : user?.role === "freelancer" ? (
                <NavLink to="/freelancer" onClick={closeMenu}>My Tickets</NavLink>
              ) : (
                <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>
              )}

              {!user?.is_staff && user?.role !== "freelancer" && user?.role !== "operations_manager" && (
                <Link
                  to="/tickets/new"
                  onClick={closeMenu}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600
                             hover:bg-indigo-700 px-3.5 py-2.5 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Ticket
                </Link>
              )}

              {user?.is_staff && user?.role === "admin" ? (
                <NavLink to="/admin/analytics" onClick={closeMenu}>Analytics</NavLink>
              ) : user?.role === "operations_manager" ? null : (
                <NavLink to="/analytics" onClick={closeMenu}>Analytics</NavLink>
              )}

              {user?.is_staff && user?.role === "admin" ? (
                <NavLink to="/admin/payments" onClick={closeMenu}>Payments</NavLink>
              ) : user?.role === "operations_manager" || user?.role === "freelancer" ? null : (
                <NavLink to="/billing" onClick={closeMenu}>Billing</NavLink>
              )}

              <NavLink to="/notifications" onClick={closeMenu}>Notifications</NavLink>
              <NavLink to="/settings" onClick={closeMenu}>Settings</NavLink>

              <button
                onClick={() => { logout(); closeMenu(); }}
                className="w-full text-left text-sm font-medium text-rose-600 hover:text-rose-700
                           hover:bg-rose-50 px-3.5 py-2.5 rounded-xl transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <NavLink to="/services" onClick={closeMenu}>Services</NavLink>
              <NavLink to="/about" onClick={closeMenu}>About</NavLink>
              <NavLink to="/pricing" onClick={closeMenu}>Pricing</NavLink>
              <NavLink to="/register/freelancer" onClick={closeMenu}>Join as Engineer</NavLink>
              <NavLink to="/contact" onClick={closeMenu}>Contact</NavLink>
              <Link
                to="/login"
                onClick={closeMenu}
                className="block text-sm font-medium text-slate-700 hover:bg-slate-100
                           px-3.5 py-2.5 rounded-xl transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="block text-sm font-semibold text-white bg-indigo-600
                           hover:bg-indigo-700 px-3.5 py-2.5 rounded-xl transition-colors text-center"
              >
                Create Ticket
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
