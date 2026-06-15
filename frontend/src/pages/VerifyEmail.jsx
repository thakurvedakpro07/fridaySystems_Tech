import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "../api/client";
import { usePageTitle } from "../hooks/usePageTitle";
import Spinner from "../components/ui/Spinner";

export default function VerifyEmail() {
  usePageTitle("Verify Email");
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("loading"); // loading | success | error | no-params

  useEffect(() => {
    if (!uid || !token) {
      setStatus("no-params");
      return;
    }
    apiClient.post("/auth/verify-email/", { uid, token })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [uid, token]);

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

          {status === "success" && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Email verified!</h1>
              <p className="text-sm text-slate-500">Your email address has been confirmed.</p>
              <Link
                to="/dashboard"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                Go to Dashboard →
              </Link>
            </div>
          )}

          {(status === "error" || status === "no-params") && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Verification failed</h1>
              <p className="text-sm text-slate-500">
                This link is invalid or has expired.
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
