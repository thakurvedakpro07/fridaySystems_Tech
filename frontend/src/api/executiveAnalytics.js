import apiClient from "./client";

export const getExecutiveAnalytics = (params = {}) =>
  apiClient.get("/ops/executive-analytics/", { params });
