import { useEffect, useState } from "react";
import { listServices } from "../../api/tickets";
import Button from "../ui/Button";

const SEVERITIES = [
  { value: "low",      label: "Low — minor issue, no urgency" },
  { value: "medium",   label: "Medium — service degraded" },
  { value: "high",     label: "High — service down" },
  { value: "critical", label: "Critical — production outage" },
];

const PRIORITIES = [
  { value: "low",    label: "Low — can wait" },
  { value: "medium", label: "Medium — normal priority" },
  { value: "high",   label: "High — needs fast resolution" },
  { value: "urgent", label: "Urgent — business blocked" },
];

export default function TicketForm({ onSubmit, loading }) {
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    service_type: "",
    severity: "medium",
    priority: "medium",
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
      <div>
        <label htmlFor="ticket-title" className="block text-sm font-medium text-slate-700 mb-1.5">
          Summary *
        </label>
        <input
          id="ticket-title"
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          placeholder="e.g. Cannot SSH into production server after reboot"
          className="input-base"
        />
      </div>

      <div>
        <label htmlFor="ticket-service" className="block text-sm font-medium text-slate-700 mb-1.5">
          Service Category *
        </label>
        {serviceError ? (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Could not load service categories. Please refresh.
          </div>
        ) : (
          <select
            id="ticket-service"
            name="service_type"
            value={form.service_type}
            onChange={handleChange}
            required
            className="input-base"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="ticket-severity" className="block text-sm font-medium text-slate-700 mb-1.5">
            Severity *
          </label>
          <select
            id="ticket-severity"
            name="severity"
            value={form.severity}
            onChange={handleChange}
            className="input-base"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ticket-priority" className="block text-sm font-medium text-slate-700 mb-1.5">
            Priority *
          </label>
          <select
            id="ticket-priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="input-base"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ticket-description" className="block text-sm font-medium text-slate-700 mb-1.5">
          Description
        </label>
        <textarea
          id="ticket-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
          placeholder="Describe the issue in detail — what happened, when, and what you've already tried."
          className="input-base resize-none"
        />
      </div>

      {/* Consulting fee notice */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
        <svg className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span>
          A <strong>₹299 consulting fee</strong> is charged at ticket creation to cover initial diagnosis.
          Refunded if no engineer is assigned within 2 hours.
        </span>
      </div>

      <Button type="submit" disabled={loading || serviceError} className="w-full" size="lg">
        {loading ? "Creating ticket…" : "Open Ticket & Pay ₹299"}
      </Button>
    </form>
  );
}
