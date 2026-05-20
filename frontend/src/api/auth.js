/**
 * Auth API calls — register, login, logout.
 */
import apiClient from "./client";

export const register = (email, password, company, phone) =>
  apiClient.post("/auth/register/", { email, password, company, phone });

export const login = (email, password) =>
  apiClient.post("/auth/login/", { email, password });

export const refreshToken = (refresh) =>
  apiClient.post("/auth/token/refresh/", { refresh });

export const logout = (refresh) =>
  apiClient.post("/auth/logout/", { refresh });

// Universal current-user endpoint — works for ALL roles.
// Use this in initializeAuth() so admins and freelancers are not
// accidentally logged out on page refresh (unlike /customers/me/).
export const getMe = () =>
  apiClient.get("/auth/me/");

// Customer-profile-specific endpoints (company, phone, address, plan)
export const getMyProfile = () =>
  apiClient.get("/customers/me/");

export const updateMyProfile = (data) =>
  apiClient.patch("/customers/me/", data);
