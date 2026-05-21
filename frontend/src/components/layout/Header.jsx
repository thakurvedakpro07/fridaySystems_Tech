import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import NotificationBell from "../ui/NotificationBell";

function UserAvatar({ email }) {
  const initials = email
    ? email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold select-none"
      title={email}
      aria-label={`Signed in as ${email}`}
    >
      {initials}
    </span>
  );
}

export default function Header() {
  const { isAuthenticated, logout } = useAuth();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-blue-600">
          SupportMitra
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {user?.is_staff ? (
                <Link
                  to="/admin"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Admin
                </Link>
              ) : user?.role === "freelancer" ? (
                <Link
                  to="/freelancer"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  My Tickets
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              )}

              {!user?.is_staff && user?.role !== "freelancer" && (
                <Link
                  to="/tickets/new"
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + New Ticket
                </Link>
              )}

              <NotificationBell />

              <UserAvatar email={user?.email} />

              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300
                           px-2.5 py-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
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
