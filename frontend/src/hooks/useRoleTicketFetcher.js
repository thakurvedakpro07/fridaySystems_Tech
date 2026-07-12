/**
 * useRoleTicketFetcher — picks the correct ticket-fetch endpoint + role label
 * for the current user. Shared by TicketDetailPage and ResolveTicketPage so
 * both pages resolve "which ticket endpoint / which role am I" identically.
 */
import { adminGetTicket, freelancerGetTicket, getTicket } from "../api/tickets";
import { useAuthStore } from "../store/authStore";

const INTERNAL_STAFF_ROLES = ["support_agent", "operations_manager", "finance_manager"];

export function useRoleTicketFetcher(id) {
  const user = useAuthStore((s) => s.user);
  if (user?.is_staff) return { fetchFn: () => adminGetTicket(id), role: "admin" };
  if (user?.role === "freelancer") return { fetchFn: () => freelancerGetTicket(id), role: "freelancer" };
  if (INTERNAL_STAFF_ROLES.includes(user?.role)) return { fetchFn: () => adminGetTicket(id), role: "support_agent" };
  return { fetchFn: () => getTicket(id), role: "customer" };
}
