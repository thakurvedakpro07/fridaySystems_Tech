import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import TicketForm from "../components/tickets/TicketForm";
import { createTicket } from "../api/tickets";

export default function NewTicket() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await createTicket(formData);
      // TODO: redirect to Razorpay checkout URL (Phase 2)
      // For now, redirect to dashboard
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Open a Support Ticket</h1>
        <p className="text-gray-500 text-sm mb-6">
          Describe your issue and a vetted engineer will be assigned within the SLA window.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <TicketForm onSubmit={handleSubmit} loading={loading} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
