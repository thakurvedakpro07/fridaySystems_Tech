import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import MainLayout from "../../components/layouts/MainLayout";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { SkeletonCard } from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import Alert from "../../components/ui/Alert";
import PageHeader from "../../components/ui/PageHeader";
import { usePageTitle } from "../../hooks/usePageTitle";

function RatingStars({ rating }) {
  if (!rating) return <span className="text-slate-500 text-xs">No rating</span>;
  const score = parseFloat(rating);
  return (
    <div className="flex items-center gap-1">
      <span className="text-amber-400 text-sm">★</span>
      <span className="text-sm font-semibold text-slate-700">{score.toFixed(1)}</span>
    </div>
  );
}

const EMPTY_FORM = { email: "", password: "", skills: "" };

function AddFreelancerForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiClient.post("/admin/freelancers/", form);
      setForm(EMPTY_FORM);
      onSuccess();
    } catch (err) {
      const data = err.response?.data ?? {};
      const msg =
        data.email?.[0] ||
        data.password?.[0] ||
        data.detail ||
        "Could not create freelancer. Please check the form.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-6 mb-6"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Add new freelancer</h2>

      {error && <Alert severity="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Work email <span className="text-rose-500">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="engineer@company.com"
            className="input-base"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Initial password <span className="text-rose-500">*</span>
            <span className="ml-1 text-slate-500 font-normal">(min 10 chars)</span>
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={10}
            value={form.password}
            onChange={handleChange}
            placeholder="Share with the engineer"
            className="input-base"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Skills</label>
          <div className="flex gap-2">
            <input
              name="skills"
              type="text"
              value={form.skills}
              onChange={handleChange}
              placeholder="aws, kubernetes, server_admin"
              className="input-base"
            />
            <Button type="submit" disabled={saving} size="md">
              {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function FreelancerList() {
  usePageTitle("Freelancers");
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError("");
    apiClient.get("/admin/freelancers/")
      .then(({ data }) => setFreelancers(data.results ?? data))
      .catch(() => setLoadError("Failed to load freelancers. Please refresh the page."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Freelancers"
          description={!loading ? `${freelancers.length} registered engineer${freelancers.length !== 1 ? "s" : ""}` : "Loading…"}
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4.5v15m7.5-7.5h-15"} />
            </svg>
            {showForm ? "Cancel" : "Add Freelancer"}
          </Button>
          <Link
            to="/operations"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600
                       hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50
                       px-3.5 py-2 rounded-lg transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <AddFreelancerForm
          onSuccess={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loadError && <Alert severity="error" className="mb-4">{loadError}</Alert>}

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : loadError ? null : freelancers.length === 0 ? (
        <EmptyState
          icon="👷"
          title="No freelancers yet"
          description='Click "Add Freelancer" above to register the first engineer.'
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
             style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 bg-slate-50
                          border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <span>Engineer</span>
            <span className="text-right">Rating</span>
            <span className="text-right">Status</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {freelancers.map((f) => (
              <div key={f.id}
                   className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-4 items-center
                              hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{f.email}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.skills || "No skills listed"}</p>
                </div>
                <div className="text-right">
                  <RatingStars rating={f.rating} />
                </div>
                <div className="text-right">
                  <Badge label={f.onboarding_status} domain="onboarding" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
