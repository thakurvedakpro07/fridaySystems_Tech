import apiClient from "./client";

// ── Operations Dashboard ───────────────────────────────────────────

export const getOpsDashboard = () =>
  apiClient.get("/ops/dashboard/");

// `config` accepts extra axios request config (e.g. `{ signal }` for
// request cancellation) without disturbing existing callers that only
// pass `params`.
export const getOpsTickets = (params = {}, config = {}) =>
  apiClient.get("/ops/tickets/", { params, ...config });

export const getOpsFreelancers = (params = {}) =>
  apiClient.get("/ops/freelancers/", { params });

export const opsAssignTicket = (ticketId, freelancerId) =>
  apiClient.post(`/ops/tickets/${ticketId}/assign/`, { freelancer_id: freelancerId });

export const opsUnassignTicket = (ticketId, note = "") =>
  apiClient.post(`/ops/tickets/${ticketId}/unassign/`, { note });

export const opsStatusUpdate = (ticketId, newStatus, note = "") =>
  apiClient.post(`/ops/tickets/${ticketId}/status/`, { new_status: newStatus, note });

export const getOpsTicketHistory = (ticketId) =>
  apiClient.get(`/ops/tickets/${ticketId}/history/`);

// ── User Management (Super Admin write; both roles read) ───────────

export const getOpsUsers = (params = {}) =>
  apiClient.get("/ops/users/", { params });

export const getOpsUserDetail = (userId) =>
  apiClient.get(`/ops/users/${userId}/`);

export const opsChangeRole = (userId, newRole, note = "") =>
  apiClient.post(`/ops/users/${userId}/role/`, { new_role: newRole, note });

export const opsDeactivateUser = (userId) =>
  apiClient.post(`/ops/users/${userId}/deactivate/`);

export const opsReactivateUser = (userId) =>
  apiClient.post(`/ops/users/${userId}/reactivate/`);

// ── Role Change Audit Log ─────────────────────────────────────────

export const getOpsRoleAudit = (params = {}) =>
  apiClient.get("/ops/role-audit/", { params });

// ── System Audit Log ───────────────────────────────────────────────

export const getOpsAuditLog = (params = {}) =>
  apiClient.get("/ops/audit-log/", { params });

// ── Services Management ───────────────────────────────────────────

export const getOpsServices = (params = {}) =>
  apiClient.get("/ops/services/", { params });

export const createOpsService = (data) =>
  apiClient.post("/ops/services/", data);

export const updateOpsService = (serviceId, data) =>
  apiClient.patch(`/ops/services/${serviceId}/`, data);

export const toggleOpsService = (serviceId) =>
  apiClient.post(`/ops/services/${serviceId}/toggle/`);

// ── SLA Policy Management ───────────────────────────────────────────

export const getOpsSLAPolicies = (params = {}) =>
  apiClient.get("/ops/sla-policies/", { params });

export const createOpsSLAPolicy = (data) =>
  apiClient.post("/ops/sla-policies/", data);

export const updateOpsSLAPolicy = (policyId, data) =>
  apiClient.patch(`/ops/sla-policies/${policyId}/`, data);

export const deleteOpsSLAPolicy = (policyId) =>
  apiClient.delete(`/ops/sla-policies/${policyId}/`);

// ── Payments (Finance Manager write; Ops Manager read) ────────────

export const getOpsPayments = (params = {}) =>
  apiClient.get("/ops/payments/", { params });

export const getOpsPaymentSummary = () =>
  apiClient.get("/ops/payments/summary/");

export const opsConfirmPayment = (paymentId) =>
  apiClient.post(`/ops/payments/${paymentId}/confirm/`);

export const opsRefundPayment = (paymentId) =>
  apiClient.post(`/ops/payments/${paymentId}/refund/`);

// ── Ticket Escalation ─────────────────────────────────────────────

export const opsEscalateTicket = (ticketId, note = "") =>
  apiClient.post(`/ops/tickets/${ticketId}/escalate/`, { note });

// ── Ops Analytics (role-scoped) ───────────────────────────────────

export const getOpsAnalytics = () =>
  apiClient.get("/ops/analytics/");
