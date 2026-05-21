import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import MainLayout from "../../components/layouts/MainLayout";
import Badge from "../../components/ui/Badge";
import { SkeletonCard } from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { usePageTitle } from "../../hooks/usePageTitle";

function RatingStars({ rating }) {
  if (!rating) return <span className="text-slate-400 text-xs">No rating</span>;
  const score = parseFloat(rating);
  return (
    <div className="flex items-center gap-1">
      <span className="text-amber-400 text-sm">★</span>
      <span className="text-sm font-semibold text-slate-700">{score.toFixed(1)}</span>
    </div>
  );
}

export default function FreelancerList() {
  usePageTitle("Freelancers");
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/admin/freelancers/")
      .then(({ data }) => setFreelancers(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout maxWidth="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Freelancers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {!loading ? `${freelancers.length} registered engineer${freelancers.length !== 1 ? "s" : ""}` : "Loading…"}
          </p>
        </div>
        <Link
          to="/admin"
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

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : freelancers.length === 0 ? (
        <EmptyState
          icon="👷"
          title="No freelancers yet"
          description="Freelancers will appear here once they register and complete onboarding."
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
                  <p className="text-xs text-slate-400 mt-0.5">{f.skills || "No skills listed"}</p>
                </div>
                <div className="text-right">
                  <RatingStars rating={f.rating} />
                </div>
                <div className="text-right">
                  <Badge label={f.onboarding_status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
