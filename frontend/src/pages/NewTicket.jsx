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

  const FIELD_LABELS = {
    title:        "Issue title",
    description:  "Problem description",
    service_type: "Service",
    severity:     "Urgency",
  };

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
          const label = key === "detail" || key === "non_field_errors"
            ? null
            : (FIELD_LABELS[key] ?? null);
          msgs.push(label ? `${label}: ${m}` : String(m));
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
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Open a Support Ticket</h1>
        <p className="text-sm text-slate-500">
          Describe your issue and a vetted engineer will be assigned within 2 hours.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-5">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            {errors.length === 1 ? errors[0] : (
              <ul className="list-disc list-inside space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        <TicketForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </MainLayout>
  );
}
