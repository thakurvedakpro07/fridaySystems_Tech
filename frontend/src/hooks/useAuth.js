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
      return { success: true };
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

  const registerUser = async (email, password, company, phone) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await registerApi(email, password, company, phone);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      toast("Account created! Welcome to SupportMitra.", "success");
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.email?.[0] ||
        err.response?.data?.password?.[0] ||
        err.response?.data?.detail ||
        "Registration failed. Please try again.";
      setError(message);
      toast(message, "error");
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await storeLogout();  // blacklists token server-side, clears localStorage + Zustand state
    toast("You have been signed out.", "info");
  };

  return { loginUser, registerUser, logout, isAuthenticated, user };
}
