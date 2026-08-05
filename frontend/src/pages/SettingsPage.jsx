import { useEffect, useState } from "react";
import {
  cancelAccountDeletion, changePassword, exportMyData,
  getProfile, requestAccountDeletion, updateProfile,
} from "../api/settings";
import AppShell from "../components/layout/AppShell";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import FormSection from "../components/ui/FormSection";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuthStore } from "../store/authStore";
import { getDisplayName } from "../utils/displayName";
import { UserCircleIcon, LockClosedIcon, ShieldCheckIcon } from "../components/tickets/ActionIcons";

const TABS = [
  { id: "profile",  label: "Profile",       Icon: UserCircleIcon },
  { id: "security", label: "Security",      Icon: LockClosedIcon },
  { id: "privacy",  label: "Privacy & Data", Icon: ShieldCheckIcon },
];

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-start py-3
                    border-b border-slate-100 last:border-0">
      <label className="text-sm font-medium text-slate-600 sm:pt-2">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function ProfileTab({ profile, setProfile, role }) {
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);
  const storeUser = useAuthStore((s) => s.user);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "",
    company: "", phone: "", address: "", gstin: "",
    skills: "", availability: "ad_hoc",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        first_name:   profile.first_name  || "",
        last_name:    profile.last_name   || "",
        company:      profile.company     || "",
        phone:        profile.phone       || "",
        address:      profile.address     || "",
        gstin:        profile.gstin       || "",
        skills:       profile.skills      || "",
        availability: profile.availability || "ad_hoc",
      });
    }
  }, [profile]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { first_name: form.first_name, last_name: form.last_name };
      if (role === "customer") {
        Object.assign(payload, {
          company: form.company, phone: form.phone,
          address: form.address, gstin: form.gstin,
        });
      } else if (role === "freelancer") {
        Object.assign(payload, { skills: form.skills, availability: form.availability });
      }
      await updateProfile(payload);
      setProfile((p) => ({ ...p, ...payload }));
      // Keep the auth store in sync so display names update immediately
      if (storeUser) {
        setUser({
          ...storeUser,
          first_name: form.first_name,
          last_name: form.last_name,
        });
      }
      toast("Profile updated successfully", "success");
    } catch {
      toast("Could not save profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <FormSection title="Personal Information" description="Your name as it appears across ResolveHQ.">
        <FieldRow label="First name">
          <input className="input-base w-full" value={form.first_name} onChange={set("first_name")} placeholder="Rahul" />
        </FieldRow>
        <FieldRow label="Last name">
          <input className="input-base w-full" value={form.last_name} onChange={set("last_name")} placeholder="Sharma" />
        </FieldRow>
        <FieldRow label="Email">
          <input className="input-base w-full bg-slate-50 cursor-not-allowed" value={profile?.email || ""} readOnly />
          <p className="text-xs text-slate-500 mt-1">Email cannot be changed.</p>
        </FieldRow>
        <FieldRow label="Role">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                           bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
            {profile?.is_staff ? "Admin" : profile?.role || "—"}
          </span>
        </FieldRow>
      </FormSection>

      {role === "customer" && (
        <FormSection title="Business Details" description="Used for invoicing and GST compliance.">
          <FieldRow label="Company name">
            <input className="input-base w-full" value={form.company} onChange={set("company")} placeholder="Acme Technologies Pvt. Ltd." />
          </FieldRow>
          <FieldRow label="Phone">
            <input className="input-base w-full" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </FieldRow>
          <FieldRow label="Address">
            <textarea
              className="input-base w-full resize-none"
              rows={3}
              value={form.address}
              onChange={set("address")}
              placeholder="Registered office address…"
            />
          </FieldRow>
          <FieldRow label="GSTIN">
            <input
              className="input-base w-full font-mono"
              value={form.gstin}
              onChange={set("gstin")}
              placeholder="27AAPFU0939F1ZV"
              maxLength={15}
            />
            <p className="text-xs text-slate-500 mt-1">15-digit GST registration number (required for B2B invoices).</p>
          </FieldRow>
        </FormSection>
      )}

      {role === "freelancer" && (
        <FormSection title="Engineer Profile" description="Your skills and current availability.">
          <FieldRow label="Approval status">
            <Badge domain="onboarding" label={profile?.onboarding_status} />
          </FieldRow>
          <FieldRow label="Rating">
            <span className="text-sm text-slate-700">
              {profile?.rating && Number(profile.rating) > 0 ? `★ ${profile.rating}` : "No rating yet"}
            </span>
          </FieldRow>
          <FieldRow label="Skills">
            <input
              className="input-base w-full"
              value={form.skills}
              onChange={set("skills")}
              placeholder="aws, azure, kubernetes, server_admin"
            />
            <p className="text-xs text-slate-500 mt-1">Comma-separated skill tags.</p>
          </FieldRow>
          <FieldRow label="Availability">
            <select className="input-base w-auto" value={form.availability} onChange={set("availability")}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="ad_hoc">Ad Hoc</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </FieldRow>
        </FormSection>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Save Changes</Button>
      </div>
    </form>
  );
}

function SecurityTab() {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    setError("");
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      setError("New passwords do not match.");
      return;
    }
    if (form.new_password.length < 10) {
      setError("New password must be at least 10 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast("Password changed successfully.", "success");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not change password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormSection title="Change Password" description="Choose a strong password of at least 10 characters.">
        <FieldRow label="Current password">
          <input
            type="password"
            className="input-base w-full"
            value={form.current_password}
            onChange={set("current_password")}
            required
            autoComplete="current-password"
          />
        </FieldRow>
        <FieldRow label="New password">
          <input
            type="password"
            className="input-base w-full"
            value={form.new_password}
            onChange={set("new_password")}
            required
            autoComplete="new-password"
            minLength={10}
          />
        </FieldRow>
        <FieldRow label="Confirm password">
          <input
            type="password"
            className="input-base w-full"
            value={form.confirm_password}
            onChange={set("confirm_password")}
            required
            autoComplete="new-password"
          />
        </FieldRow>

        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-rose-600 bg-rose-50
                          border border-rose-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}
      </FormSection>

      <FormSection title="Security Tips" description="">
        <ul className="space-y-2">
          {[
            "Use a password manager to generate and store passwords securely.",
            "Never share your password with anyone — ResolveHQ staff will never ask for it.",
            "Enable two-factor authentication when available.",
            "Sign out of shared or public computers after use.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="text-emerald-500 mt-0.5">✓</span>
              {tip}
            </li>
          ))}
        </ul>
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Update Password</Button>
      </div>
    </form>
  );
}

function PrivacyTab({ profile, setProfile }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await exportMyData();
      const url = window.URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `resolvehq-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast("Could not download your data. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async (e) => {
    e.preventDefault();
    setError("");
    setRequesting(true);
    try {
      const { data } = await requestAccountDeletion({ current_password: password });
      setProfile((p) => ({ ...p, deletion_requested_at: data.deletion_requested_at }));
      setShowConfirm(false);
      setPassword("");
      toast("Account deletion requested.", "success");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not request deletion. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelAccountDeletion();
      setProfile((p) => ({ ...p, deletion_requested_at: null }));
      toast("Account deletion cancelled.", "success");
    } catch {
      toast("Could not cancel deletion request. Please try again.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const deletionRequestedAt = profile?.deletion_requested_at;
  const scheduledFor = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="space-y-5">
      <FormSection title="Your Data" description="Download a copy of everything ResolveHQ has on file for your account.">
        <p className="text-sm text-slate-600 mb-4">
          Includes your profile, tickets, comments, and payment/payout history — a machine-readable JSON file, in
          line with your rights under India's DPDP Act 2023.
        </p>
        <Button variant="secondary" onClick={handleExport} loading={exporting}>
          Download my data
        </Button>
      </FormSection>

      <FormSection title="Delete Account" description="Permanently remove your personal data from ResolveHQ.">
        {deletionRequestedAt ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span>
                Your account is scheduled for deletion on{" "}
                <strong>
                  {scheduledFor?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </strong>
                . You can cancel any time before then.
              </span>
            </div>
            <Button variant="secondary" onClick={handleCancel} loading={cancelling}>
              Cancel deletion request
            </Button>
          </div>
        ) : showConfirm ? (
          <form onSubmit={handleRequestDeletion} className="space-y-3">
            <p className="text-sm text-slate-600">
              This starts a 30-day grace period. Your account stays fully active until then, and you can cancel any
              time. Enter your password to confirm.
            </p>
            <input
              type="password"
              className="input-base w-full"
              value={password}
              onChange={(e) => { setError(""); setPassword(e.target.value); }}
              placeholder="Current password"
              autoComplete="current-password"
              required
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="danger" loading={requesting}>Confirm deletion request</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowConfirm(false); setPassword(""); setError(""); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-4">
              Deleting your account starts a 30-day grace period, after which your personal data is permanently
              anonymized. Records we're legally required to keep (like GST invoices) are retained in an anonymized
              form, as Indian tax law requires.
            </p>
            <Button variant="danger" onClick={() => setShowConfirm(true)}>Delete my account</Button>
          </>
        )}
      </FormSection>
    </div>
  );
}

export default function SettingsPage() {
  usePageTitle("Account Settings");
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    getProfile()
      .then(({ data }) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  const role = user?.is_staff ? "admin" : (user?.role || "customer");

  return (
    <AppShell maxWidth="max-w-2xl">
      {/* Page header */}
      <div className="mb-6">
        <PageHeader title={getDisplayName(user, "full") || "Account Settings"} description={user?.email} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium
                        py-2 rounded-lg transition-all duration-150
              ${activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
              }`}
          >
            <tab.Icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="animate-fade-in">
        {loadingProfile ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : activeTab === "profile" ? (
          <ProfileTab profile={profile} setProfile={setProfile} role={role} />
        ) : activeTab === "security" ? (
          <SecurityTab />
        ) : (
          <PrivacyTab profile={profile} setProfile={setProfile} />
        )}
      </div>
    </AppShell>
  );
}
