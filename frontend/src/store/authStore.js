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

function loadStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  // ── State ─────────────────────────────────────────────────────
  isAuthenticated: !!localStorage.getItem("access_token"),
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

  logout: () => {
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
   *      try the customer profile endpoint as fallback.
   *
   * WHY we don't call /api/customers/me/ for everyone:
   *   Admins and freelancers don't have a customer_profile, so that
   *   endpoint returns 403 for them. Calling it would log them out on
   *   every page refresh — a critical bug in the original code.
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

    // Fallback: no stored user object — try customer profile endpoint.
    // If it fails, clear tokens (token is expired/invalid).
    try {
      const { getMyProfile } = await import("../api/auth");
      const { data } = await getMyProfile();
      const user = {
        id: data.id,
        email: data.email,
        is_staff: data.is_staff,
        role: "customer",
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
