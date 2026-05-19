import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layouts/MainLayout";
import TicketForm from "../components/tickets/TicketForm";
import { createTicket } from "../api/tickets";
import { useToast } from "../context/ToastContext";

export default function NewTicket() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await createTicket(formData);
      toast("Ticket created! Redirecting to your ticket…", "success");
      navigate(`/tickets/${data.id}`);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to create ticket. Please try again.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout maxWidth="max-w-xl">
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
    </MainLayout>
  );
}
