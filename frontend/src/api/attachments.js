import apiClient from "./client";

export const listAttachments = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/attachments/`);

export const uploadAttachment = (ticketId, file) => {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post(`/tickets/${ticketId}/attachments/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteAttachment = (ticketId, attachmentId) =>
  apiClient.delete(`/tickets/${ticketId}/attachments/${attachmentId}/`);
