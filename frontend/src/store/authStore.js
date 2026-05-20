/**
 * Authentication state — managed with Zustand.
 *
 * Zustand is a simple state management library.
 * Think of it as a shared "box" that any component can read from or write to
 * without passing props through every level of the component tree.
 *
 * Usage in any component:
 *   import { useAuthStore } from "../store/authStore";
 *   const user = useAuthStore((s) => s.user);
 *   const logout = useAuthStore((s) => s.logout);
 *
 * WHY localStorage for user data?
 *   When a user refreshes the page, React state is wiped.
 *   We need to know the user's role (customer/admin/freelancer) to render
 *   the correct navigation and protect admin routes — BEFORE making any
 *   API calls. Storing the user object in localStorage lets us rehydrate
 *   instantly without a round-trip to the server.
 */
import { create } from "zustand";

function safeLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    // SecurityError in private-browsing modes that block localStorage entirely
    return null;
  }
}

function loadStoredUser() {
  try {
    const raw = safeLocalStorage("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  // ── State ─────────────────────────────────────────────────────
  isAuthenticated: !!safeLocalStorage("access_token"),
  user: loadStoredUser(),   // { id, email, is_staff, role }
  loading: false,
  error: null,
  initializing: true,       // true until the startup auth check finishes

  // ── Actions ───────────────────────────────────────────────────

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ isAuthenticated: true, error: null });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ user });
  },

  logout: async () => {
    const refresh = localStorage.getItem("refresh_token");
    // Blacklist the refresh token on the server so it can't be reused.
    // Fire-and-forget: even if the API call fails (e.g. server unreachable),
    // we still clear local state so the user is logged out in the browser.
    if (refresh) {
      try {
        const { default: apiClient } = await import("../api/client");
        await apiClient.post("/auth/logout/", { refresh });
      } catch {
        // Intentionally swallowed — local logout always proceeds.
      }
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    set({ isAuthenticated: false, user: null });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  /**
   * Called once on app mount (App.jsx).
   *
   * Strategy:
   *   1. If no token → not authenticated, done.
   *   2. If we have a stored user object (from a previous login) → use it
   *      immediately. No API call needed. The token will be validated on
   *      the next real API request — if it fails the response interceptor
   *      in client.js handles the refresh/redirect automatically.
   *   3. If token exists but no stored user (e.g. localStorage cleared) →
   *      call /auth/me/ which works for ALL roles (customer, freelancer, admin).
   *
   * WHY we use /auth/me/ and not /customers/me/:
   *   /customers/me/ returns 403 for admins and freelancers because they
   *   have no customer_profile. Using it would log out every admin on page
   *   refresh — a critical bug fixed by the /auth/me/ endpoint added in
   *   Phase 9 (2026-05-20).
   */
  initializeAuth: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      set({ initializing: false });
      return;
    }

    const storedUser = loadStoredUser();
    if (storedUser) {
      // User is already in localStorage — rehydrate instantly.
      set({ user: storedUser, isAuthenticated: true, initializing: false });
      return;
    }

    // Fallback: no stored user — call /auth/me/ which works for all roles.
    // If this fails the token is expired/invalid → clear and redirect to login.
    try {
      const { getMe } = await import("../api/auth");
      const { data } = await getMe();
      const user = {
        id: data.id,
        email: data.email,
        is_staff: data.is_staff,
        role: data.role,
      };
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, isAuthenticated: true, initializing: false });
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      set({ isAuthenticated: false, user: null, initializing: false });
    }
  },
}));
