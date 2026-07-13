import apiClient from "./client";

export const listArticles          = (params = {}) => apiClient.get("/kb/articles/", { params });
export const getArticle            = (id)           => apiClient.get(`/kb/articles/${id}/`);
export const createArticle         = (data)         => apiClient.post("/kb/articles/", data);
export const updateArticle         = (id, data)     => apiClient.patch(`/kb/articles/${id}/`, data);
export const deleteArticle         = (id)           => apiClient.delete(`/kb/articles/${id}/`);
export const listCategories        = ()             => apiClient.get("/kb/categories/");
export const getTicketArticles     = (ticketId)     => apiClient.get(`/tickets/${ticketId}/kb-articles/`);
export const linkArticleToTicket   = (ticketId, articleId) =>
  apiClient.post(`/tickets/${ticketId}/kb-articles/${articleId}/link/`);
export const unlinkArticleFromTicket = (ticketId, articleId) =>
  apiClient.delete(`/tickets/${ticketId}/kb-articles/${articleId}/link/`);
