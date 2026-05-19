/**
 * FreelancerList — admin view of all registered freelancers.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import MainLayout from "../../components/layouts/MainLayout";
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
    <MainLayout maxWidth="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Freelancers</h1>
        <Link to="/admin" className="text-sm text-blue-600 hover:text-blue-800">
          ← Admin Dashboard
        </Link>
      </div>

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
                <span className="text-sm text-gray-500">★ {f.rating ?? "—"}</span>
                <Badge label={f.onboarding_status} />
              </div>
            </div>
          ))}
          {freelancers.length === 0 && (
            <p className="text-gray-400 text-center py-12">No freelancers yet.</p>
          )}
        </div>
      )}
    </MainLayout>
  );
}
