/**
 * useAuth — custom hook for login/register/logout actions.
 *
 * Custom hooks let you extract reusable logic from components.
 * Any component can call useAuth() and get the login/logout functions.
 */
import { login as loginApi, register as registerApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export function useAuth() {
  const { setTokens, setUser, logout, setLoading, setError, isAuthenticated, user } =
    useAuthStore();

  const loginUser = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await loginApi(email, password);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.detail || "Login failed. Please try again.";
      setError(message);
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
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.email?.[0] || "Registration failed.";
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  return { loginUser, registerUser, logout, isAuthenticated, user };
}
