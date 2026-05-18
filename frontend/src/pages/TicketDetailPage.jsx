import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getTicket } from "../api/tickets";
import TicketDetail from "../components/tickets/TicketDetail";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";

export default function TicketDetailPage() {
  // useParams reads the :id segment from the URL.
  // e.g. if the URL is /tickets/a1b2c3d4-... then id = "a1b2c3d4-..."
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Back button — navigate(-1) goes to whichever page the user came from */}
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex items-center gap-1"
        >
          ← Back
        </button>

        {loading && (
          <p className="text-gray-400">Loading ticket…</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Only render TicketDetail once we have data and no error */}
        {!loading && !error && ticket && (
          <TicketDetail ticket={ticket} />
        )}
      </main>

      <Footer />
    </div>
  );
}
