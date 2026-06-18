/**
 * useAuth — custom hook for login/register/logout actions.
 *
 * Custom hooks let you extract reusable logic from components.
 * Any component can call useAuth() and get the login/logout functions
 * without knowing anything about Zustand or localStorage.
 */
import { login as loginApi, register as registerApi } from "../api/auth";
import { useToast } from "../context/ToastContext";
import { useAuthStore } from "../store/authStore";

export function useAuth() {
  const {
    setTokens, setUser, logout: storeLogout,
    setLoading, setError,
    isAuthenticated, user,
  } = useAuthStore();

  const toast = useToast();

  const loginUser = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await loginApi(email, password);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      toast(`Welcome back, ${data.user.email}!`, "success");
      // Return role so the login page can redirect to the right place:
      // admins → /admin, everyone else → /dashboard
      return { success: true, role: data.user.role, is_staff: data.user.is_staff };
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Login failed. Please check your credentials.";
      setError(message);
      toast(message, "error");
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async ({ name = "", email, role = "customer", company = "", phone = "", password, password2, skills = "" }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await registerApi(name, email, role, company, phone, password, password2, skills);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      toast("Account created! Welcome to ResolveHQ.", "success");
      return { success: true, role: data.user.role };
    } catch (err) {
      const responseData = err.response?.data || {};
      const errors = [];
      Object.entries(responseData).forEach(([key, val]) => {
        const msgs = Array.isArray(val) ? val : [val];
        msgs.forEach((msg) => {
          if (key === "detail" || key === "non_field_errors") {
            errors.push(String(msg));
          } else {
            errors.push(`${key}: ${msg}`);
          }
        });
      });
      if (errors.length === 0) errors.push("Registration failed. Please try again.");
      const message = errors[0];
      setError(message);
      toast(message, "error");
      return { success: false, message, errors };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await storeLogout();  // blacklists token server-side, clears localStorage + Zustand state
    toast("You have been signed out.", "info");
  };

  const loading = useAuthStore((s) => s.loading);
  return { loginUser, registerUser, logout, isAuthenticated, user, loading };
}
