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
});

// ── Request interceptor ───────────────────────────────────────────
// Runs before every request — attaches the JWT access token if one exists
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
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
        localStorage.setItem("access_token", data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest); // retry the original request
      } catch {
        // Refresh failed — clear tokens and redirect to login
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
