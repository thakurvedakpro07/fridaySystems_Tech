/**
 * Auth API calls — register, login, logout.
 */
import apiClient from "./client";

export const register = (name, email, role, company, phone, password, password2, skills = "", consent = false) =>
  apiClient.post("/auth/register/", { name, email, role, company, phone, password, password2, skills, consent });

export const login = (email, password) =>
  apiClient.post("/auth/login/", { email, password });

export const refreshToken = (refresh) =>
  apiClient.post("/auth/token/refresh/", { refresh });

export const logout = (refresh) =>
  apiClient.post("/auth/logout/", { refresh });

// consent is only required (and only meaningful) on a user's FIRST Google
// sign-up — see google_auth_view's is_new_account gate. Existing users
// re-authenticating via Google can omit it.
export const googleLogin = (accessToken, consent = false) =>
  apiClient.post("/auth/google/", { access_token: accessToken, consent });

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

// Email verification
export const verifyEmail = (uid, token) =>
  apiClient.post("/auth/verify-email/", { uid, token });

export const resendVerificationEmail = () =>
  apiClient.post("/auth/verify-email/resend/");

export const resendVerificationEmailByEmail = (email) =>
  apiClient.post("/auth/verify-email/resend-by-email/", { email });
