import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function Header() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-blue-600">
          SupportMitra
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                to="/tickets/new"
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + New Ticket
              </Link>
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
