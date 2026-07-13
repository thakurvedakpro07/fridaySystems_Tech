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

export const addComment = (ticketId, body, isInternal = false) =>
  apiClient.post(`/tickets/${ticketId}/comments/`, { body, is_internal: isInternal });

export const submitCSAT = (ticketId, score, comment) =>
  apiClient.post(`/tickets/${ticketId}/csat/`, { score, comment });

export const acceptResolution = (ticketId, score, comment = "") =>
  apiClient.post(`/tickets/${ticketId}/accept-resolution/`, { score, comment });

export const rejectResolution = (ticketId, note = "") =>
  apiClient.post(`/tickets/${ticketId}/reject-resolution/`, { note });

export const listServices = () =>
  apiClient.get("/services/");

export const listActivityLog = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/activity/`);

// Admin-only ticket actions
export const assignTicket = (ticketId, freelancerId) =>
  apiClient.post(`/admin/tickets/${ticketId}/assign/`, { freelancer_id: freelancerId });

export const adminUpdateStatus = (ticketId, newStatus, note = "") =>
  apiClient.post(`/admin/tickets/${ticketId}/status/`, { new_status: newStatus, note });

export const unassignTicket = (ticketId, note = "") =>
  apiClient.post(`/admin/tickets/${ticketId}/unassign/`, { note });

export const adminListTickets = (params = {}) =>
  apiClient.get("/admin/tickets/", { params });

// Admin uses the same /tickets/{id}/ endpoint — TicketDetailView already handles is_staff
export const adminGetTicket = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/`);

// Freelancer-only ticket actions
export const freelancerListTickets = (params = {}) =>
  apiClient.get("/freelancer/tickets/", { params });

// Engineer Workspace: fetch all of the engineer's active (non-closed)
// tickets in one page — bucketing/sorting into triage sections happens
// client-side (see utils/ticketPriority.js), not via server-side filters.
export const freelancerListActiveTickets = () =>
  freelancerListTickets({ exclude_status: "closed", page_size: 100 });

export const freelancerGetTicket = (ticketId) =>
  apiClient.get(`/freelancer/tickets/${ticketId}/`);

export const freelancerUpdateStatus = (ticketId, newStatus, note = "") =>
  apiClient.post(`/freelancer/tickets/${ticketId}/status/`, { new_status: newStatus, note });

export const freelancerStartRemoteSession = (ticketId, remoteSessionUrl) =>
  apiClient.post(`/freelancer/tickets/${ticketId}/remote-session/`, { remote_session_url: remoteSessionUrl });

// Admin freelancer management
export const listFreelancers = () =>
  apiClient.get("/admin/freelancers/");

// Resolution fee payment flow
export const getResolutionQuote = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/resolution-quote/`);

export const initiateResolutionPayment = (ticketId) =>
  apiClient.post(`/tickets/${ticketId}/initiate-resolution-payment/`);

export const verifyResolutionPayment = (ticketId, data) =>
  apiClient.post(`/tickets/${ticketId}/verify-resolution-payment/`, data);
