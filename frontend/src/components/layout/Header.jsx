import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import NotificationBell from "../ui/NotificationBell";

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
              ) : (
                <Link
                  to="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              )}

              {!user?.is_staff && (
                <Link
                  to="/tickets/new"
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + New Ticket
                </Link>
              )}

              <NotificationBell />

              <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[120px]">
                {user?.email}
              </span>

              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Logout
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
