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
 * Token storage (H-09 — 2026-06-15):
 *   access_token  → sessionStorage  (cleared on tab close; XSS cannot persist it across sessions)
 *   refresh_token → localStorage    (persistent; used to re-issue access_token on page load)
 *   user          → localStorage    (needed for role-based rendering before any API call)
 *
 * Trade-off: XSS can still read sessionStorage within the active tab. Full
 * protection requires httpOnly cookies (Phase 5 roadmap item). This change
 * reduces the window of token theft by clearing access_token when tabs close.
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

function safeSessionStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function loadStoredUser() {
  try {
    const raw = safeLocalStorage("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Validate the stored object has the required shape.
    // If any key is missing the state is corrupt — clear it on next init.
    if (!user?.id || !user?.email || !user?.role) return null;
    return user;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  try { sessionStorage.removeItem("access_token"); } catch {}
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

export const useAuthStore = create((set) => ({
  // ── State ─────────────────────────────────────────────────────
  // Optimistic initial value: if either sessionStorage has an access_token
  // (same-tab refresh) or localStorage has a refresh_token (returning user),
  // the user may be authenticated. initializeAuth() always validates server-side.
  isAuthenticated: !!(safeSessionStorage("access_token") || safeLocalStorage("refresh_token")),
  user: loadStoredUser(),   // { id, email, is_staff, role, is_verified }
  loading: false,
  error: null,
  initializing: true,       // true until the startup auth check finishes

  // ── Actions ───────────────────────────────────────────────────

  setTokens: (accessToken, refreshToken) => {
    // access_token goes to sessionStorage (tab-scoped, clears on close)
    try { sessionStorage.setItem("access_token", accessToken); } catch {}
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
    clearAuthStorage();
    set({ isAuthenticated: false, user: null });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  /**
   * Called once on app mount (App.jsx).
   *
   * Always validates the stored token against /auth/me/ on startup.
   * This catches deactivated accounts, admin-revoked sessions, and
   * rotated secrets without waiting for the next API call to fail.
   *
   * If access_token is missing from sessionStorage (e.g. new tab or browser
   * restart), client.js interceptor automatically refreshes it using
   * localStorage.refresh_token before /auth/me/ is retried.
   *
   * On network error (offline / server down): falls back to the cached
   * user so the app stays usable without forcing a logout.
   */
  initializeAuth: async () => {
    const hasSession = !!(safeSessionStorage("access_token") || safeLocalStorage("refresh_token"));
    if (!hasSession) {
      // No tokens at all — user has never logged in or fully logged out.
      clearAuthStorage();
      set({ isAuthenticated: false, user: null, initializing: false });
      return;
    }

    try {
      // Always validate against server — catches revoked/deactivated tokens.
      // If access_token is absent from sessionStorage, client.js will
      // refresh automatically and retry, so this call is safe either way.
      const { getMe } = await import("../api/auth");
      const { data } = await getMe();
      const user = {
        id: data.id,
        email: data.email,
        is_staff: data.is_staff,
        role: data.role,
        is_verified: data.is_verified ?? true,
      };
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, isAuthenticated: true, initializing: false });
    } catch (err) {
      // 401 means token is expired or revoked — clear and redirect to login.
      if (err?.response?.status === 401) {
        clearAuthStorage();
        set({ isAuthenticated: false, user: null, initializing: false });
        return;
      }
      // Network error or server down — fall back to cached user (offline tolerance).
      const storedUser = loadStoredUser();
      if (storedUser) {
        set({ user: storedUser, isAuthenticated: true, initializing: false });
      } else {
        clearAuthStorage();
        set({ isAuthenticated: false, user: null, initializing: false });
      }
    }
  },
}));
