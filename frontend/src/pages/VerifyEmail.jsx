import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail, resendVerificationEmailByEmail } from "../api/auth";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuthStore } from "../store/authStore";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";

// status: loading | success | already-verified | expired | invalid | no-params
const CODE_TO_STATUS = {
  success: "success",
  already_verified: "already-verified",
  expired_link: "expired",
  invalid_link: "invalid",
  missing_params: "invalid",
};

export default function VerifyEmail() {
  usePageTitle("Verify Email");
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [status, setStatus] = useState("loading");

  // Inline resend-by-email mini-form, shown on the "expired" state — the
  // visitor may not be logged in on this device, so we can't rely on the
  // authenticated resend endpoint here.
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (!uid || !token) {
      setStatus("no-params");
      return;
    }
    verifyEmail(uid, token)
      .then((res) => {
        setStatus(CODE_TO_STATUS[res.data.code] ?? "success");
      })
      .catch((err) => {
        const code = err?.response?.data?.code;
        setStatus(CODE_TO_STATUS[code] ?? "invalid");
      });
  }, [uid, token]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendLoading(true);
    try {
      await resendVerificationEmailByEmail(resendEmail);
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div
          className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center"
          style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
        >
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500">Verifying your email…</p>
            </div>
          )}

          {(status === "success" || status === "already-verified") && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                {status === "already-verified" ? "Already verified" : "Email verified!"}
              </h1>
              <p className="text-sm text-slate-500">
                {status === "already-verified"
                  ? "Your email address was already confirmed."
                  : "Your email address has been confirmed."}
              </p>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                {isAuthenticated ? "Continue to Dashboard →" : "Continue to Login →"}
              </Link>
            </div>
          )}

          {status === "expired" && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Link expired</h1>
              <p className="text-sm text-slate-500">
                This verification link has expired. Enter your email to get a new one.
              </p>

              {resendSent ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                  If an account with that email exists and isn't verified yet, a new link has been sent.
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-3 text-left">
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-auth"
                  />
                  <Button type="submit" loading={resendLoading} className="w-full">
                    Resend verification email
                  </Button>
                </form>
              )}

              <Link to="/login" className="block text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
                ← Back to sign in
              </Link>
            </div>
          )}

          {(status === "invalid" || status === "no-params") && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Verification failed</h1>
              <p className="text-sm text-slate-500">
                This link is invalid. Please sign in to request a new one.
              </p>
              <Link
                to="/login"
                className="block text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
              >
                Sign in to resend verification →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
