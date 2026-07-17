import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useRoles } from "../../hooks/useRoles";

// ── Inline SVG icon set ───────────────────────────────────────────
const IC = {
  dashboard: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  ticket: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  plus: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  analytics: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  executive: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
    </svg>
  ),
  billing: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  bell: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  settings: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  engineers: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  payments: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  help: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  ),
  signout: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  assign: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  ),
  users: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  roles: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  services: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.905-2.72c.174-.168.35-.337.518-.512a5.29 5.29 0 00-7.497-7.497c-.175.168-.344.343-.512.518" />
    </svg>
  ),
  auditLog: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75M3.75 6.75h16.5M3.75 6.75v10.5A2.25 2.25 0 006 19.5h12a2.25 2.25 0 002.25-2.25V6.75M3.75 6.75L6 3.75h12l2.25 3" />
    </svg>
  ),
  knowledgeBase: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
};

// ── NavItem ───────────────────────────────────────────────────────
function NavItem({ to, icon, label, exact = false }) {
  const { pathname } = useLocation();
  const active = exact
    ? pathname === to
    : pathname === to || pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150 group
        ${active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
    >
      <span className={`shrink-0 transition-colors
        ${active ? "text-white" : "text-slate-500 group-hover:text-slate-600"}`}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

// ── NavSection label ──────────────────────────────────────────────
function NavSection({ label, children }) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest select-none">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ── User chip at sidebar bottom ───────────────────────────────────
function UserChip({ user, onLogout }) {
  const first    = (user?.first_name ?? "").trim();
  const last     = (user?.last_name  ?? "").trim();
  const initials = first && last
    ? `${first[0]}${last[0]}`.toUpperCase()
    : first
    ? first.slice(0, 2).toUpperCase()
    : (user?.email ?? "??").slice(0, 2).toUpperCase();
  const displayName = first
    ? `${first}${last ? " " + last : ""}`
    : user?.email ?? "";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold
                      flex items-center justify-center shrink-0 select-none">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{displayName}</p>
        <p className="text-[11px] text-slate-500 truncate capitalize">{user?.role ?? "user"}</p>
      </div>
      <button
        onClick={onLogout}
        title="Sign out"
        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50
                   transition-colors shrink-0"
        aria-label="Sign out"
      >
        {IC.signout}
      </button>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────
export default function Sidebar({ open, onClose }) {
  const { logout } = useAuth();
  const { user, isSuperAdmin, isOpsManager, isFinanceManager, isSupportAgent, isEngineer, isCustomer, isAnyStaff } = useRoles();

  // All four internal staff roles see the ops sidebar, regardless of path —
  // matches Header.jsx's existing role-only nav logic. Must be path-independent:
  // shared pages (TicketDetailPage, NotificationsPage, SettingsPage, AnalyticsPage)
  // are reachable by staff outside /operations/* (e.g. /tickets/:id, /admin/analytics),
  // and a path-gated check would render an empty sidebar there.
  const showOpsNav = isAnyStaff;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200
                  flex flex-col select-none
                  transform transition-transform duration-200 ease-in-out
                  ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      {/* ── Brand ────────────────────────────────────────────────── */}
      <div className="h-[72px] flex items-center gap-3 px-5 border-b border-slate-100 shrink-0">
        <Link to="/" className="flex items-center gap-3 min-w-0 group">
          <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center
                          shrink-0 shadow-sm transition-shadow group-hover:shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-bold text-slate-900 leading-tight tracking-tight">
              ResolveHQ
            </p>
            <p className="text-[10px] text-slate-500 leading-tight font-medium tracking-wide">
              Enterprise IT Support
            </p>
          </div>
        </Link>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="lg:hidden ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-700
                     hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Close navigation"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
        {isCustomer && (
          <>
            <NavSection label="Workspace">
              <NavItem to="/dashboard"   icon={IC.dashboard} label="Dashboard"  exact />
              <NavItem to="/tickets/new" icon={IC.plus}      label="New Ticket" exact />
            </NavSection>
            <NavSection label="Manage">
              <NavItem to="/analytics"     icon={IC.analytics}     label="Analytics" />
              <NavItem to="/billing"       icon={IC.billing}       label="Billing & Invoices" />
              <NavItem to="/knowledge-base" icon={IC.knowledgeBase} label="Knowledge Base" />
              <NavItem to="/notifications" icon={IC.bell}          label="Notifications" />
            </NavSection>
            <NavSection label="Account">
              <NavItem to="/settings"     icon={IC.settings} label="Settings" />
              <NavItem to="/help-center"  icon={IC.help}     label="Help Center" />
            </NavSection>
          </>
        )}

        {isEngineer && (
          <>
            <NavSection label="Workspace">
              <NavItem to="/freelancer" icon={IC.dashboard} label="My Assignments" exact />
            </NavSection>
            <NavSection label="Manage">
              <NavItem to="/analytics"     icon={IC.analytics}     label="Analytics" />
              <NavItem to="/knowledge-base" icon={IC.knowledgeBase} label="Knowledge Base" />
              <NavItem to="/notifications" icon={IC.bell}          label="Notifications" />
            </NavSection>
            <NavSection label="Account">
              <NavItem to="/settings"     icon={IC.settings} label="Settings" />
              <NavItem to="/help-center"  icon={IC.help}     label="Help Center" />
            </NavSection>
          </>
        )}

        {showOpsNav && (
          <>
            {/* Operations — all four staff roles */}
            <NavSection label="Operations">
              <NavItem to="/operations"         icon={IC.dashboard} label="Overview"     exact />
              <NavItem to="/operations/tickets" icon={IC.ticket}    label="Ticket Queue" />
              {(isSuperAdmin || isOpsManager) && (
                <NavItem to="/operations/assignments" icon={IC.assign} label="Assignments" />
              )}
            </NavSection>

            {/* Finance — Finance Manager + Super Admin (Ops Manager sees read-only) */}
            {(isSuperAdmin || isFinanceManager || isOpsManager) && (
              <NavSection label="Finance">
                <NavItem to="/operations/payments"  icon={IC.payments}  label="Payments" />
                <NavItem to="/operations/analytics" icon={IC.analytics} label="Analytics" />
                <NavItem to="/operations/executive-analytics" icon={IC.executive} label="Executive Analytics" />
              </NavSection>
            )}

            {/* Platform — Ops Manager + Super Admin */}
            {(isSuperAdmin || isOpsManager) && (
              <NavSection label="Platform">
                {isSuperAdmin && (
                  <>
                    <NavItem to="/operations/users"     icon={IC.users}    label="Users" />
                    <NavItem to="/operations/roles"     icon={IC.roles}    label="Roles" />
                    <NavItem to="/operations/audit-log" icon={IC.auditLog} label="Audit Log" />
                    <NavItem to="/operations/settings"  icon={IC.settings} label="Settings" />
                  </>
                )}
                {!isSuperAdmin && isOpsManager && (
                  <NavItem to="/operations/users" icon={IC.users} label="Users" />
                )}
                <NavItem to="/operations/freelancers" icon={IC.engineers} label="Engineers" />
                <NavItem to="/operations/services"    icon={IC.services}  label="Services" />
              </NavSection>
            )}

            <NavSection label="Account">
              <NavItem to="/operations/knowledge-base" icon={IC.knowledgeBase} label="Knowledge Base" />
              <NavItem to="/operations/notifications"  icon={IC.bell}          label="Notifications" />
              <NavItem to="/help-center"               icon={IC.help}          label="Help Center" />
            </NavSection>
          </>
        )}
      </nav>

      {/* ── User profile ─────────────────────────────────────────── */}
      <div className="px-3 pb-4 pt-3 border-t border-slate-100 shrink-0">
        <UserChip user={user} onLogout={logout} />
      </div>
    </aside>
  );
}
