import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import { usePageTitle } from "../hooks/usePageTitle";
import { useToast } from "../context/ToastContext";
import { useAuthStore } from "../store/authStore";
import { previewStaffInvitation, acceptStaffInvitation } from "../api/staffInvitations";
import { BuildingOfficeIcon } from "../components/tickets/ActionIcons";

const STATUS_MESSAGES = {
  accepted: "This invitation has already been accepted.",
  revoked: "This invitation has been revoked.",
  expired: "This invitation has expired. Ask a Super Admin to send a new one.",
};

// Staff roles land at /operations; freelancer (Engineer) lands at /freelancer —
// same post-login home mapping used elsewhere in App.jsx.
function postAcceptPath(role) {
  return role === "freelancer" ? "/freelancer" : "/operations";
}

function articleFor(roleDisplay) {
  return roleDisplay === "Engineer" ? "an" : "a";
}

function CardShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-[420px]">
        <div
          className="bg-white border border-slate-200/80 rounded-2xl p-8"
          style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function StaffInvitationAcceptPage() {
  usePageTitle("Accept Staff Invitation");
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setTokens, setUser, isAuthenticated, user } = useAuthStore();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    previewStaffInvitation(token)
      .then(({ data }) => { if (!cancelled) setPreview(data); })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.response?.data?.detail || "This invitation link is invalid.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async (e) => {
    e?.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = { token };
      if (!preview.account_exists) {
        payload.password = password;
        payload.first_name = firstName;
        payload.last_name = lastName;
      }
      const { data } = await acceptStaffInvitation(payload);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      toast(`Welcome to ResolveHQ as ${preview.role_display}!`, "success");
      navigate(postAcceptPath(data.user.role));
    } catch (err) {
      const responseData = err.response?.data || {};
      const message = responseData.detail
        || responseData.password?.[0]
        || "Could not accept this invitation. Please try again.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <CardShell>
        <div className="text-center">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BuildingOfficeIcon className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid invitation</h1>
          <p className="text-sm text-slate-500 mb-6">{loadError}</p>
          <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 text-sm">
            Go to sign in →
          </Link>
        </div>
      </CardShell>
    );
  }

  if (preview.status !== "pending") {
    return (
      <CardShell>
        <div className="text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BuildingOfficeIcon className="w-6 h-6 text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">ResolveHQ</h1>
          <p className="text-sm text-slate-500 mb-6">{STATUS_MESSAGES[preview.status] || "This invitation is no longer valid."}</p>
          <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 text-sm">
            Go to sign in →
          </Link>
        </div>
      </CardShell>
    );
  }

  // Invited email already has an account — must be logged in as that exact user.
  if (preview.account_exists) {
    const loggedInAsInvitee = isAuthenticated && user?.email?.toLowerCase() === preview.email?.toLowerCase();

    return (
      <CardShell>
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BuildingOfficeIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Join ResolveHQ staff</h1>
          <p className="text-sm text-slate-500">
            {preview.invited_by_email || "A team member"} invited <span className="font-semibold">{preview.email}</span> to
            join as {articleFor(preview.role_display)} <span className="font-semibold">{preview.role_display}</span>.
          </p>
        </div>

        {submitError && <Alert severity="error" className="mb-5">{submitError}</Alert>}

        {loggedInAsInvitee ? (
          <Button onClick={handleAccept} loading={submitting} className="w-full" size="lg">
            Accept Invitation →
          </Button>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-slate-600">
              Please sign in as <span className="font-semibold">{preview.email}</span> to accept this invitation.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
            >
              Sign in →
            </Link>
          </div>
        )}
      </CardShell>
    );
  }

  // Brand-new invitee — create an account and accept in one step.
  return (
    <CardShell>
      <div className="mb-6 text-center">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BuildingOfficeIcon className="w-6 h-6 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Join ResolveHQ staff</h1>
        <p className="text-sm text-slate-500">
          {preview.invited_by_email || "A team member"} invited <span className="font-semibold">{preview.email}</span> to
          join as {articleFor(preview.role_display)} <span className="font-semibold">{preview.role_display}</span>. Create a password to get started.
        </p>
      </div>

      {submitError && <Alert severity="error" className="mb-5">{submitError}</Alert>}

      <form onSubmit={handleAccept} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inv-first" className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
            <input id="inv-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-auth" />
          </div>
          <div>
            <label htmlFor="inv-last" className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
            <input id="inv-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-auth" />
          </div>
        </div>
        <div>
          <label htmlFor="inv-password" className="block text-sm font-medium text-slate-700 mb-1.5">
            Password <span className="text-slate-500 font-normal">(min 10 chars)</span>
          </label>
          <input
            id="inv-password" type="password" required minLength={10}
            value={password} onChange={(e) => setPassword(e.target.value)} className="input-auth"
          />
        </div>
        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Create Account & Join →
        </Button>
      </form>
    </CardShell>
  );
}
