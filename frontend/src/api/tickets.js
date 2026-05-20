/**
 * Ticket API calls.
 */
import apiClient from "./client";

export const listTickets = (params = {}) =>
  apiClient.get("/tickets/", { params });

export const getTicket = (id) =>
  apiClient.get(`/tickets/${id}/`);

export const createTicket = (data) =>
  apiClient.post("/tickets/", data);

export const updateTicket = (id, data) =>
  apiClient.patch(`/tickets/${id}/`, data);

export const listComments = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/comments/`);

export const addComment = (ticketId, body) =>
  apiClient.post(`/tickets/${ticketId}/comments/`, { body });

export const submitCSAT = (ticketId, score, comment) =>
  apiClient.post(`/tickets/${ticketId}/csat/`, { score, comment });

export const listServices = () =>
  apiClient.get("/services/");

export const listActivityLog = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/activity/`);

// Admin-only ticket actions
export const assignTicket = (ticketId, freelancerId) =>
  apiClient.post(`/admin/tickets/${ticketId}/assign/`, { freelancer_id: freelancerId });

export const adminUpdateStatus = (ticketId, newStatus, note = "") =>
  apiClient.post(`/admin/tickets/${ticketId}/status/`, { status: newStatus, note });

export const unassignTicket = (ticketId, note = "") =>
  apiClient.post(`/admin/tickets/${ticketId}/unassign/`, { note });

export const adminListTickets = (params = {}) =>
  apiClient.get("/admin/tickets/", { params });

export const adminGetTicket = (ticketId) =>
  apiClient.get(`/admin/tickets/${ticketId}/`);

// Freelancer-only ticket actions
export const freelancerListTickets = (params = {}) =>
  apiClient.get("/freelancer/tickets/", { params });

export const freelancerGetTicket = (ticketId) =>
  apiClient.get(`/freelancer/tickets/${ticketId}/`);

export const freelancerUpdateStatus = (ticketId, newStatus, note = "") =>
  apiClient.post(`/freelancer/tickets/${ticketId}/status/`, { status: newStatus, note });

// Admin freelancer management
export const listFreelancers = () =>
  apiClient.get("/admin/freelancers/");
