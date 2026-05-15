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
