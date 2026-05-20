import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layouts/MainLayout";
import TicketForm from "../components/tickets/TicketForm";
import { createTicket } from "../api/tickets";
import { useToast } from "../context/ToastContext";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NewTicket() {
  usePageTitle("Open a Ticket");
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setErrors([]);
    try {
      const { data } = await createTicket(formData);
      toast("Ticket created! Redirecting to your ticket…", "success");
      navigate(`/tickets/${data.id}`);
    } catch (err) {
      const responseData = err.response?.data || {};
      const msgs = [];
      Object.entries(responseData).forEach(([key, val]) => {
        const list = Array.isArray(val) ? val : [val];
        list.forEach((m) => {
          msgs.push(key === "detail" || key === "non_field_errors" ? String(m) : `${key}: ${m}`);
        });
      });
      if (msgs.length === 0) msgs.push("Failed to create ticket. Please try again.");
      setErrors(msgs);
      toast(msgs[0], "error");
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

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <TicketForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </MainLayout>
  );
}
