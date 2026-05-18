/**
 * Root application component.
 * Defines all routes (URL → page component mappings).
 *
 * How React Router works:
 *   <BrowserRouter> — enables URL-based routing
 *   <Routes>        — container for all route definitions
 *   <Route>         — maps a URL path to a component
 */
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminDashboard from "./pages/admin/AdminDashboard";
import FreelancerList from "./pages/admin/FreelancerList";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NewTicket from "./pages/NewTicket";
import Register from "./pages/Register";
import TicketDetailPage from "./pages/TicketDetailPage";
import { useAuthStore } from "./store/authStore";

// A wrapper that redirects unauthenticated users to /login
function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// A wrapper that redirects non-admin users to /dashboard
function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user?.is_staff ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const initializing = useAuthStore((s) => s.initializing);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  // On first mount: re-fetch the user profile if a stored token exists.
  // This rehydrates `user` state after a page refresh so AdminRoute works.
  useEffect(() => {
    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Block all route rendering until the auth check completes.
  // Without this guard, AdminRoute evaluates user===null before the profile
  // fetch returns and incorrectly redirects admins to /dashboard.
  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Customer pages — require login */}
        <Route
          path="/dashboard"
          element={<PrivateRoute><Dashboard /></PrivateRoute>}
        />
        <Route
          path="/tickets/new"
          element={<PrivateRoute><NewTicket /></PrivateRoute>}
        />
        <Route
          path="/tickets/:id"
          element={<PrivateRoute><TicketDetailPage /></PrivateRoute>}
        />

        {/* Admin pages — require login + is_staff */}
        <Route
          path="/admin"
          element={<AdminRoute><AdminDashboard /></AdminRoute>}
        />
        <Route
          path="/admin/freelancers"
          element={<AdminRoute><FreelancerList /></AdminRoute>}
        />

        {/* Catch-all: redirect unknown URLs to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
