import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/client";
import { usePageTitle } from "../hooks/usePageTitle";

export default function ResetPassword() {
  usePageTitle("Reset Password");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 max-w-[400px] w-full text-center">
          <p className="text-rose-600 font-medium mb-4">Invalid or missing reset link.</p>
          <Link to="/forgot-password" className="text-indigo-600 font-semibold hover:text-indigo-700">
            Request a new link →
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/password/reset/confirm/", { uid, token, new_password: newPassword });
      setDone(true);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.join(" ") : (detail || "Reset failed. The link may have expired."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div
          className="bg-white border border-slate-200/80 rounded-2xl p-8"
          style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
        >
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Choose a new password</h1>
            <p className="text-sm text-slate-500">Must be at least 10 characters with uppercase, number, and symbol.</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                Password reset successfully!
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                Sign in →
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-4">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="rp-new" className="block text-sm font-medium text-slate-700 mb-1.5">
                    New password
                  </label>
                  <input
                    id="rp-new"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-auth"
                  />
                </div>
                <div>
                  <label htmlFor="rp-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="rp-confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input-auth"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
                >
                  {loading ? "Resetting…" : "Reset password →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
