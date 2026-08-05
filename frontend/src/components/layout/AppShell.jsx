import { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "../ui/NotificationBell";
import Button from "../ui/Button";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../context/ToastContext";
import { resendVerificationEmail } from "../../api/auth";

function UserAvatar({ user }) {
  const first    = (user?.first_name ?? "").trim();
  const last     = (user?.last_name  ?? "").trim();
  const initials = first && last
    ? `${first[0]}${last[0]}`.toUpperCase()
    : first
    ? first.slice(0, 2).toUpperCase()
    : (user?.email ?? "??").slice(0, 2).toUpperCase();

  return (
    <Link
      to="/settings"
      title="Account settings"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full
                 bg-indigo-100 text-indigo-700 text-xs font-semibold select-none
                 hover:ring-2 hover:ring-indigo-300 transition-all shrink-0"
      aria-label="Account settings"
    >
      {initials}
    </Link>
  );
}

function UnverifiedEmailBanner() {
  const addToast = useToast();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      const { data } = await resendVerificationEmail();
      if (data.code === "cooldown") {
        addToast(data.detail, "warning");
      } else {
        addToast(data.detail ?? "Verification email sent.", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.detail ?? "Could not send verification email.", "error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
        <span className="text-amber-800">
          Please verify your email address to unlock ticket creation and other actions.
        </span>
        <Button size="sm" variant="secondary" onClick={handleResend} loading={resending}>
          Resend email
        </Button>
      </div>
    </div>
  );
}

// ── AppShell ──────────────────────────────────────────────────────
// Authenticated app layout: fixed sidebar (desktop) + slim topbar + content.
// The single shell for every authenticated page — `maxWidth`/`noPad` mirror
// MainLayout's API so pages keep their existing content width after swapping.
export default function AppShell({ children, maxWidth, noPad = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Main area (offset by sidebar on desktop) ─────────── */}
      <div className="lg:pl-64 flex flex-col min-h-screen">

        {user?.is_verified === false && <UnverifiedEmailBanner />}

        {/* ── Topbar ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 h-[72px] bg-white/95 backdrop-blur-md
                           border-b border-slate-200/80 flex items-center px-4 sm:px-6 gap-4 shrink-0">

          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900
                       transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Mobile brand (hidden on desktop — shown in sidebar) */}
          <Link to="/" className="lg:hidden flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-gradient rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">ResolveHQ</span>
          </Link>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <UserAvatar user={user} />
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────── */}
        <main className={`flex-1 w-full mx-auto ${maxWidth ?? ""} ${noPad ? "" : "px-4 sm:px-6 lg:px-8 py-8"}`}>
          {children}
        </main>

      </div>
    </div>
  );
}
