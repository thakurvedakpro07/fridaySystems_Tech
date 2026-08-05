import apiClient from "./client";

export const listAttachments = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/attachments/`);

// Fetches the actual file bytes through the authenticated download endpoint.
// Attachments are never served from a raw/public URL — the backend only
// returns them to a user who passes the same ticket-ownership check as
// every other ticket sub-resource. Callers turn the resulting Blob into an
// object URL (see utils/attachmentDownload.js) for <img>/<a>/text preview.
export const downloadAttachment = (ticketId, attachmentId) =>
  apiClient.get(`/tickets/${ticketId}/attachments/${attachmentId}/download/`, {
    responseType: "blob",
  });

export const uploadAttachment = (ticketId, file) => {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post(`/tickets/${ticketId}/attachments/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteAttachment = (ticketId, attachmentId) =>
  apiClient.delete(`/tickets/${ticketId}/attachments/${attachmentId}/`);
