import apiClient from "./client";

export const getProfile = () => apiClient.get("/auth/profile/");
export const updateProfile = (data) => apiClient.patch("/auth/profile/", data);
export const changePassword = (data) => apiClient.post("/auth/change-password/", data);

export const exportMyData = () => apiClient.get("/auth/profile/export/", { responseType: "blob" });
export const requestAccountDeletion = (data) => apiClient.post("/auth/deletion-request/", data);
export const cancelAccountDeletion = () => apiClient.post("/auth/deletion-request/cancel/");
