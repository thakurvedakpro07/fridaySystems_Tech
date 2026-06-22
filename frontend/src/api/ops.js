import apiClient from "./client";

export const getOpsDashboard = () =>
  apiClient.get("/ops/dashboard/");

export const getOpsTickets = (params = {}) =>
  apiClient.get("/ops/tickets/", { params });

export const getOpsFreelancers = (params = {}) =>
  apiClient.get("/ops/freelancers/", { params });

export const opsAssignTicket = (ticketId, freelancerId) =>
  apiClient.post(`/ops/tickets/${ticketId}/assign/`, { freelancer_id: freelancerId });

export const opsUnassignTicket = (ticketId, note = "") =>
  apiClient.post(`/ops/tickets/${ticketId}/unassign/`, { note });

export const getOpsTicketHistory = (ticketId) =>
  apiClient.get(`/ops/tickets/${ticketId}/history/`);
