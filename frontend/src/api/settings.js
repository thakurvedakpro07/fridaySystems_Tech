import apiClient from "./client";

export const getProfile = () => apiClient.get("/auth/profile/");
export const updateProfile = (data) => apiClient.patch("/auth/profile/", data);
export const changePassword = (data) => apiClient.post("/auth/change-password/", data);
