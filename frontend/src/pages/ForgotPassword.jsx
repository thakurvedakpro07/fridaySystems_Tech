import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";
import Alert from "../components/ui/Alert";
import { usePageTitle } from "../hooks/usePageTitle";

export default function ForgotPassword() {
  usePageTitle("Forgot Password");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient.post("/auth/password/reset/", { email });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Reset your password</h1>
            <p className="text-sm text-slate-500">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {submitted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              If an account with that email exists, a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <>
              {error && <Alert severity="error" className="mb-4">{error}</Alert>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="fp-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-auth"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
                >
                  {loading ? "Sending…" : "Send reset link →"}
                </button>
              </form>
            </>
          )}

          <p className="text-sm text-center text-slate-500 mt-6">
            <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
