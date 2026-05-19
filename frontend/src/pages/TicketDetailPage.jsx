import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getTicket } from "../api/tickets";
import TicketDetail from "../components/tickets/TicketDetail";
import MainLayout from "../components/layouts/MainLayout";

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTicket(id)
      .then(({ data }) => setTicket(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("Ticket not found.");
        } else {
          setError("Could not load ticket. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <MainLayout maxWidth="max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex items-center gap-1"
      >
        ← Back
      </button>

      {loading && <p className="text-gray-400">Loading ticket…</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && ticket && <TicketDetail ticket={ticket} />}
    </MainLayout>
  );
}
