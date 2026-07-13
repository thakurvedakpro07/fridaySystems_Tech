import apiClient from "./client";

export const getAIAssistant = (ticketId, tone = "professional") =>
  apiClient.get(`/tickets/${ticketId}/ai-assistant/`, { params: { tone } });

export const logAIDraftInsert = (ticketId, tone = "professional") =>
  apiClient.post(`/tickets/${ticketId}/ai-assistant/log-insert/`, { tone });
