/**
 * TicketForm — the form customers fill in to open a new support ticket.
 */
import { useEffect, useState } from "react";
import { listServices } from "../../api/tickets";
import Button from "../ui/Button";

const SEVERITIES = [
  { value: "low",      label: "Low — minor issue, no urgency" },
  { value: "medium",   label: "Medium — service degraded" },
  { value: "high",     label: "High — service down" },
  { value: "critical", label: "Critical — production outage" },
];

export default function TicketForm({ onSubmit, loading }) {
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    service_type: "",
    severity: "medium",
  });

  useEffect(() => {
    listServices()
      .then(({ data }) => setServices(data))
      .catch(() => setServiceError(true));
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summary *
        </label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          placeholder="e.g. Cannot SSH into production server after reboot"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Service type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Service Category *
        </label>
        {serviceError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            Could not load service categories. Please refresh the page.
          </div>
        ) : (
          <select
            name="service_type"
            value={form.service_type}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a category…</option>
            {services.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} — ₹{s.resolution_fee} resolution fee
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Severity *
        </label>
        <select
          name="severity"
          value={form.severity}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
          placeholder="Describe the issue in detail — what happened, when, and what you've already tried."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Consulting fee notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        A <strong>₹299 consulting fee</strong> is charged at ticket creation to cover
        initial diagnosis. You will be redirected to complete payment.
      </div>

      <Button type="submit" disabled={loading || serviceError} className="w-full">
        {loading ? "Creating…" : "Open Ticket & Pay ₹299"}
      </Button>
    </form>
  );
}
