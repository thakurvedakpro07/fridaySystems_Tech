import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Spinner from "./components/ui/Spinner";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import OfflineBanner from "./components/ui/OfflineBanner";

// Eagerly loaded — smallest possible critical path for authenticated users
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
const ResolveTicketPage    = lazy(() => import("./pages/ResolveTicketPage"));
const KnowledgeBasePage        = lazy(() => import("./pages/KnowledgeBasePage"));
const KnowledgeBaseArticlePage = lazy(() => import("./pages/KnowledgeBaseArticlePage"));

// Operations Dashboard pages (all staff roles)
const OpsDashboard      = lazy(() => import("./pages/ops/OpsDashboard"));
const OpsTicketQueue    = lazy(() => import("./pages/ops/OpsTicketQueue"));
const OpsFreelancers    = lazy(() => import("./pages/ops/OpsFreelancers"));
const OpsAssignments    = lazy(() => import("./pages/ops/OpsAssignments"));
const OpsUsers          = lazy(() => import("./pages/ops/OpsUsers"));
const OpsRoles          = lazy(() => import("./pages/ops/OpsRoles"));
const OpsServices       = lazy(() => import("./pages/ops/OpsServices"));
const OpsPayments       = lazy(() => import("./pages/ops/OpsPayments"));
const OpsAnalytics      = lazy(() => import("./pages/ops/OpsAnalytics"));
const OpsSettings       = lazy(() => import("./pages/ops/OpsSettings"));
const OpsKnowledgeBase  = lazy(() => import("./pages/ops/OpsKnowledgeBase"));

// Public website pages
const AboutPage    = lazy(() => import("./pages/AboutPage"));
const PricingPage  = lazy(() => import("./pages/PricingPage"));
const ContactPage  = lazy(() => import("./pages/ContactPage"));
const PrivacyPage  = lazy(() => import("./pages/PrivacyPage"));
const TermsPage    = lazy(() => import("./pages/TermsPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));

import { ToastProvider } from "./context/ToastContext";
import { useAuthStore } from "./store/authStore";
import StickyTicketCTA from "./components/ui/StickyTicketCTA";
import FloatingCallButton, { PhoneSupportWidget } from "./components/ui/FloatingCallButton";

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

// Suppressed on the Ops Ticket Queue only — the fixed bottom-right widget
// overlaps the ticket table's Assign/Reassign action column there. Every
// other route keeps the widget; this is not a global removal.
const FLOATING_WIDGET_HIDDEN_PATHS = ["/operations/tickets"];

function FloatingSupportWidgets() {
  const { pathname } = useLocation();
  if (FLOATING_WIDGET_HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <>
      {/* Mobile call bar — full-width, only visible below sm breakpoint */}
      <FloatingCallButton />
      {/* Desktop floating column — phone widget pinned to bottom-right, ticket CTA
          stacks above it via flex-col-reverse. No hardcoded offsets means no overlap
          regardless of widget height. Hidden on mobile (mobile bar handles that). */}
      <div className="fixed bottom-6 right-6 z-50 hidden sm:flex flex-col-reverse gap-3 items-end">
        <PhoneSupportWidget />
        <StickyTicketCTA />
      </div>
    </>
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
  // Any staff role lands at /operations; non-staff non-engineer goes to /dashboard
  const staffRoles = ["admin", "operations_manager", "finance_manager", "support_agent"];
  return <Navigate to={staffRoles.includes(user?.role) ? "/operations" : "/dashboard"} replace />;
}

// Redirects already-authenticated users away from /login and /register.
// Staff roles go to /operations; everyone else to /dashboard.
function PublicOnlyRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return children;
  const staffRoles = ["admin", "operations_manager", "finance_manager", "support_agent"];
  if (staffRoles.includes(user?.role)) return <Navigate to="/operations" replace />;
  if (user?.role === "freelancer") return <Navigate to="/freelancer" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Allows all four internal staff roles onto /operations/* routes.
function OpsRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const staffRoles = ["admin", "operations_manager", "finance_manager", "support_agent"];
  if (!staffRoles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// Ops Manager + Super Admin only (not Finance Manager or Support Agent).
// Used for assignment, engineer, and service management routes.
function OpsManagerRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const isOpsManager = user?.role === "operations_manager" && !user?.is_staff;
  const isSuperAdmin = user?.role === "admin" && user?.is_staff;
  if (!isOpsManager && !isSuperAdmin) return <Navigate to="/403" replace />;
  return children;
}

// Finance Manager + Super Admin only (payment write + summary).
function FinanceRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const isFinance = user?.role === "finance_manager" && !user?.is_staff;
  const isSuperAdmin = user?.role === "admin" && user?.is_staff;
  if (!isFinance && !isSuperAdmin) return <Navigate to="/403" replace />;
  return children;
}

// Ops Manager + Finance Manager + Super Admin — for Payments and Analytics pages.
// Ops Manager gets read-only UI; Finance Manager gets write UI. Role enforcement is
// inside each page component via useRoles(). The route guard only controls access.
function PaymentRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const isOpsManager  = user?.role === "operations_manager" && !user?.is_staff;
  const isFinance     = user?.role === "finance_manager"    && !user?.is_staff;
  const isSuperAdmin  = user?.role === "admin"              && user?.is_staff;
  if (!isOpsManager && !isFinance && !isSuperAdmin) return <Navigate to="/403" replace />;
  return children;
}

// Super Admin only — used for user/role management pages inside /operations/*.
function SuperAdminOpsRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_staff || user?.role !== "admin") return <Navigate to="/403" replace />;
  return children;
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
      <FloatingSupportWidgets />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about"    element={<AboutPage />} />
          <Route path="/pricing"  element={<PricingPage />} />
          <Route path="/contact"  element={<ContactPage />} />
          <Route path="/privacy"  element={<PrivacyPage />} />
          <Route path="/terms"    element={<TermsPage />} />
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
          <Route
            path="/tickets/:id/resolve"
            element={<PrivateRoute><ResolveTicketPage /></PrivateRoute>}
          />

          {/* Freelancer pages — require login + role=freelancer */}
          <Route
            path="/freelancer"
            element={<PrivateRoute><FreelancerRoute><FreelancerDashboard /></FreelancerRoute></PrivateRoute>}
          />

          {/* Admin pages — require login + is_staff */}
          {/* /admin's dashboard was a duplicate of /operations (unified staff
              dashboard covers Super Admin's superset view now) — redirect
              rather than maintain two dashboards. The remaining /admin/*
              pages below are distinct tools, not dashboards, and stay put. */}
          <Route
            path="/admin"
            element={<AdminRoute><Navigate to="/operations" replace /></AdminRoute>}
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

          {/* Knowledge Base — customer self-service, all authenticated roles */}
          <Route
            path="/knowledge-base"
            element={<PrivateRoute><KnowledgeBasePage /></PrivateRoute>}
          />
          <Route
            path="/knowledge-base/:id"
            element={<PrivateRoute><KnowledgeBaseArticlePage /></PrivateRoute>}
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

          {/* Operations Portal — all four staff roles */}
          <Route path="/operations"             element={<OpsRoute><OpsDashboard /></OpsRoute>} />
          <Route path="/operations/tickets"     element={<OpsRoute><OpsTicketQueue /></OpsRoute>} />

          {/* Operations — Ops Manager + Super Admin only */}
          <Route path="/operations/freelancers" element={<OpsManagerRoute><OpsFreelancers /></OpsManagerRoute>} />
          <Route path="/operations/assignments" element={<OpsManagerRoute><OpsAssignments /></OpsManagerRoute>} />
          <Route path="/operations/services"    element={<OpsManagerRoute><OpsServices /></OpsManagerRoute>} />

          {/* Operations — Finance Manager + Ops Manager + Super Admin */}
          <Route path="/operations/payments"    element={<PaymentRoute><OpsPayments /></PaymentRoute>} />
          <Route path="/operations/analytics"   element={<PaymentRoute><OpsAnalytics /></PaymentRoute>} />

          {/* Operations — all staff roles */}
          <Route path="/operations/notifications" element={<OpsRoute><NotificationsPage /></OpsRoute>} />
          <Route path="/operations/knowledge-base" element={<OpsRoute><OpsKnowledgeBase /></OpsRoute>} />

          {/* Platform Management — Ops Manager + Super Admin (write gated inside page + backend) */}
          <Route path="/operations/users"       element={<OpsManagerRoute><OpsUsers /></OpsManagerRoute>} />
          <Route path="/operations/roles"       element={<SuperAdminOpsRoute><OpsRoles /></SuperAdminOpsRoute>} />
          <Route path="/operations/settings"    element={<SuperAdminOpsRoute><OpsSettings /></SuperAdminOpsRoute>} />

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
