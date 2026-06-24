/**
 * Central role-checking hook.
 *
 * All role predicates derive from (user.role + user.is_staff) — the single
 * source of truth for authorization, mirroring the backend permission layer.
 *
 * Usage:
 *   const { isSuperAdmin, isOpsManager } = useRoles();
 */
import { useAuthStore } from "../store/authStore";

export function useRoles() {
  const user = useAuthStore((s) => s.user);

  const isSuperAdmin    = !!(user?.is_staff && user?.role === "admin");
  const isOpsManager    = !!(user && !user.is_staff && user.role === "operations_manager");
  const isFinanceManager = !!(user && !user.is_staff && user.role === "finance_manager");
  const isSupportAgent  = !!(user && !user.is_staff && user.role === "support_agent");
  const isEngineer      = !!(user && user.role === "freelancer");
  const isCustomer      = !!(user && user.role === "customer" && !user.is_staff);

  // True for any of the four internal staff roles.
  const isAnyStaff = isSuperAdmin || isOpsManager || isFinanceManager || isSupportAgent;

  return {
    user,
    isSuperAdmin,
    isOpsManager,
    isFinanceManager,
    isSupportAgent,
    isEngineer,
    isCustomer,
    isAnyStaff,
  };
}
