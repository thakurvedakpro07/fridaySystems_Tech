/**
 * Authentication state — managed with Zustand.
 *
 * Zustand is a simple state management library.
 * Think of it as a shared "box" that any component can read from or write to
 * without passing props through every level of the component tree.
 *
 * Usage in any component:
 *   import { useAuthStore } from "../store/authStore";
 *   const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
 *   const logout = useAuthStore((s) => s.logout);
 */
import { create } from "zustand";
import { getMyProfile } from "../api/auth";

export const useAuthStore = create((set) => ({
  // ── State ─────────────────────────────────────────────────────
  isAuthenticated: !!localStorage.getItem("access_token"),
  user: null,         // { id, email, is_staff }
  loading: false,
  error: null,
  initializing: true, // true until the startup auth check finishes

  // ── Actions ───────────────────────────────────────────────────

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ isAuthenticated: true, error: null });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ isAuthenticated: false, user: null });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  /**
   * Called once on app mount (App.jsx).
   * If a stored token exists, fetches the user's profile to rehydrate `user`
   * state after a page refresh. Clears stale tokens if the fetch fails.
   */
  initializeAuth: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      set({ initializing: false });
      return;
    }
    try {
      const { data } = await getMyProfile();
      set({
        user: { id: data.id, email: data.email, is_staff: data.is_staff },
        isAuthenticated: true,
        initializing: false,
      });
    } catch {
      // Token is invalid or expired — clear storage and force re-login
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      set({ isAuthenticated: false, user: null, initializing: false });
    }
  },
}));
