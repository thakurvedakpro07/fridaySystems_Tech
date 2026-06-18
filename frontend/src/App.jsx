import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Spinner from "./components/ui/Spinner";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import OfflineBanner from "./components/ui/OfflineBanner";

// Eagerly loaded — smallest possible critical path for authenticated users
import AdminDashboard from "./pages/admin/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NewTicket from "./pages/NewTicket";
import Register from "./pages/Register";
import RegisterRole from "./pages/RegisterRole";
import RegisterCustomer from "./pages/RegisterCustomer";
import RegisterFreelancer from "./pages/RegisterFreelancer";
import TicketDetailPage from "./pages/TicketDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import ForbiddenPage from "./pages/ForbiddenPage";

// Lazily loaded — split into separate chunks, downloaded only when first visited
const Landing              = lazy(() => import("./pages/Landing"));
const AnalyticsPage        = lazy(() => import("./pages/AnalyticsPage"));
const SettingsPage         = lazy(() => import("./pages/SettingsPage"));
const FreelancerDashboard  = lazy(() => import("./pages/freelancer/FreelancerDashboard"));
const FreelancerList       = lazy(() => import("./pages/admin/FreelancerList"));
const BillingPage          = lazy(() => import("./pages/BillingPage"));
const PaymentsDashboard    = lazy(() => import("./pages/admin/PaymentsDashboard"));
const ForgotPassword       = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword        = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail          = lazy(() => import("./pages/VerifyEmail"));
const CustomerOnboarding   = lazy(() => import("./pages/onboarding/CustomerOnboarding"));
const FreelancerOnboarding = lazy(() => import("./pages/onboarding/FreelancerOnboarding"));
const NotificationsPage    = lazy(() => import("./pages/NotificationsPage"));
const HelpCenterPage       = lazy(() => import("./pages/HelpCenterPage"));

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

// Redirects unauthenticated users to /login; non-admins to /dashboard.
// Requires BOTH is_staff=true AND role="admin" to prevent privilege escalation
// if is_staff is granted to a non-admin role by mistake.
function AdminRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_staff || user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
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
    <ErrorBoundary>
    <BrowserRouter>
      <OfflineBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          {/* Role selection — new entry point for registration */}
          <Route path="/register" element={<PublicOnlyRoute><RegisterRole /></PublicOnlyRoute>} />
          <Route path="/register/customer"   element={<PublicOnlyRoute><RegisterCustomer /></PublicOnlyRoute>} />
          <Route path="/register/freelancer" element={<PublicOnlyRoute><RegisterFreelancer /></PublicOnlyRoute>} />
          {/* Legacy /register/legacy redirect for any bookmarked links */}
          <Route path="/register/legacy" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/verify-email"    element={<VerifyEmail />} />

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
          <Route
            path="/admin/payments"
            element={<AdminRoute><PaymentsDashboard /></AdminRoute>}
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
          <Route
            path="/billing"
            element={<PrivateRoute><BillingPage /></PrivateRoute>}
          />

          {/* Notifications full-page view */}
          <Route
            path="/notifications"
            element={<PrivateRoute><NotificationsPage /></PrivateRoute>}
          />

          {/* Help Center */}
          <Route
            path="/help-center"
            element={<PrivateRoute><HelpCenterPage /></PrivateRoute>}
          />

          {/* Onboarding — post-registration guided setup (require auth) */}
          <Route
            path="/onboarding/customer"
            element={<PrivateRoute><CustomerOnboarding /></PrivateRoute>}
          />
          <Route
            path="/onboarding/freelancer"
            element={<PrivateRoute><FreelancerOnboarding /></PrivateRoute>}
          />

          {/* Named error pages */}
          <Route path="/403" element={<ForbiddenPage />} />

          {/* Catch-all: show proper 404 page instead of silently redirecting */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
    </ToastProvider>
  );
}
