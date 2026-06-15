/**
 * Axios HTTP client — the single place where all API calls are configured.
 *
 * Why Axios instead of fetch()?
 * Axios automatically parses JSON, handles errors more clearly,
 * and makes it easy to attach an auth token to every request.
 */
import axios from "axios";

const apiClient = axios.create({
  // In development the Vite proxy forwards /api/* to http://localhost:8000
  // In production this hits the real API directly
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  // Fail fast rather than hanging indefinitely on network issues
  timeout: 10000,
});

// ── Request interceptor ───────────────────────────────────────────
// access_token lives in sessionStorage (H-09): cleared on tab close so
// XSS cannot harvest it across browser sessions via localStorage.
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────
// Runs after every response — if we get a 401, try to refresh the token
apiClient.interceptors.response.use(
  (response) => response, // success — pass through

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // prevent infinite retry loop

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const { data } = await axios.post("/api/auth/token/refresh/", {
          refresh: refreshToken,
        });
        // Store refreshed access_token in sessionStorage (not localStorage).
        try { sessionStorage.setItem("access_token", data.access); } catch {}
        // Django rotates refresh tokens (ROTATE_REFRESH_TOKENS=True) — save the new one
        // or the next refresh attempt will fail with 401 (old token is blacklisted).
        if (data.refresh) {
          localStorage.setItem("refresh_token", data.refresh);
        }
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest); // retry the original request
      } catch {
        // Refresh failed — clear tokens and let the app redirect to login cleanly.
        try { sessionStorage.removeItem("access_token"); } catch {}
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        // Use replace so the user lands back on the login page without a back-button
        // loop where re-visiting the previous page triggers another 401 cycle.
        window.location.replace("/login?session_expired=1");
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
