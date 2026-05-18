/**
 * Auth API calls — register, login, logout.
 */
import apiClient from "./client";

export const register = (email, password, company, phone) =>
  apiClient.post("/auth/register/", { email, password, company, phone });

export const login = (email, password) =>
  apiClient.post("/auth/login/", { username: email, password });

export const refreshToken = (refresh) =>
  apiClient.post("/auth/token/refresh/", { refresh });

export const logout = (refresh) =>
  apiClient.post("/auth/logout/", { refresh });

export const getMyProfile = () =>
  apiClient.get("/customers/me/");

export const updateMyProfile = (data) =>
  apiClient.patch("/customers/me/", data);
