/**
 * FreelancerList — admin view of all registered freelancers.
 */
import { useEffect, useState } from "react";
import apiClient from "../../api/client";
import Header from "../../components/layout/Header";
import Badge from "../../components/ui/Badge";

export default function FreelancerList() {
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/admin/freelancers/")
      .then(({ data }) => setFreelancers(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Freelancers</h1>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {freelancers.map((f) => (
              <div key={f.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{f.email}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{f.skills || "No skills listed"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">★ {f.rating}</span>
                  <Badge label={f.onboarding_status} />
                </div>
              </div>
            ))}
            {freelancers.length === 0 && (
              <p className="text-gray-400 text-center py-12">No freelancers yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
