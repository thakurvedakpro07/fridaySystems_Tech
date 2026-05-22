import apiClient from "./client";

export const listNotifications     = (params = {}) => apiClient.get("/notifications/", { params });
export const getUnreadCount        = ()             => apiClient.get("/notifications/unread-count/");
export const markNotificationRead  = (id)           => apiClient.patch(`/notifications/${id}/read/`);
export const markAllNotificationsRead = ()          => apiClient.post("/notifications/mark-all-read/");
