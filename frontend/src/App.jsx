import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Spinner from "./components/ui/Spinner";

// Eagerly loaded — smallest possible critical path for authenticated users
import AdminDashboard from "./pages/admin/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NewTicket from "./pages/NewTicket";
import Register from "./pages/Register";
import TicketDetailPage from "./pages/TicketDetailPage";

// Lazily loaded — split into separate chunks, downloaded only when first visited
const Landing          = lazy(() => import("./pages/Landing"));
const AnalyticsPage    = lazy(() => import("./pages/AnalyticsPage"));
const SettingsPage     = lazy(() => import("./pages/SettingsPage"));
const FreelancerDashboard = lazy(() => import("./pages/freelancer/FreelancerDashboard"));
const FreelancerList   = lazy(() => import("./pages/admin/FreelancerList"));

import { ToastProvider } from "./context/ToastContext";
import { useAuthStore } from "./store/authStore";

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

// Redirects unauthenticated users to /login
function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Redirects non-admin users back to /dashboard
function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user?.is_staff ? children : <Navigate to="/dashboard" replace />;
}

// Redirects non-freelancer users to their appropriate home
function FreelancerRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role === "freelancer") return children;
  return <Navigate to={user?.is_staff ? "/admin" : "/dashboard"} replace />;
}

// Redirects already-authenticated users away from /login and /register.
// Admins go to /admin; everyone else goes to /dashboard.
// Without this, a logged-in user could open /login and see the auth form again.
function PublicOnlyRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return children;
  return <Navigate to={user?.is_staff ? "/admin" : "/dashboard"} replace />;
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <ToastProvider>
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

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

          {/* Freelancer pages — require login + role=freelancer */}
          <Route
            path="/freelancer"
            element={<PrivateRoute><FreelancerRoute><FreelancerDashboard /></FreelancerRoute></PrivateRoute>}
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
          <Route
            path="/admin/analytics"
            element={<AdminRoute><AnalyticsPage /></AdminRoute>}
          />

          {/* Shared pages — require login */}
          <Route
            path="/settings"
            element={<PrivateRoute><SettingsPage /></PrivateRoute>}
          />
          <Route
            path="/analytics"
            element={<PrivateRoute><AnalyticsPage /></PrivateRoute>}
          />

          {/* Catch-all: redirect unknown URLs to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  );
}
