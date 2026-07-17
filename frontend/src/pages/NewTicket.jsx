import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import TicketForm from "../components/tickets/TicketForm";
import Alert from "../components/ui/Alert";
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
    <AppShell maxWidth="max-w-xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-page-title">Open a Support Ticket</h1>
        <p className="text-page-subtitle">
          Describe your issue and a Support Agent will contact you within your chosen response window.
        </p>
      </div>

      {errors.length > 0 && (
        <Alert severity="error" className="mb-5">
          {errors.length === 1 ? errors[0] : (
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </Alert>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        <TicketForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </AppShell>
  );
}
