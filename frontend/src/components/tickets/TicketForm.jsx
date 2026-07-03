import { useEffect, useState } from "react";
import { listServices } from "../../api/tickets";
import Button from "../ui/Button";

const GST_RATE = 0.18;

// sla = how quickly a Support Agent contacts you for a consultation (NOT resolution speed)
const SEVERITY_OPTIONS = [
  { value: "low",      label: "Low",      hint: "Non-urgent — can wait",                   sla: "Consultation within 4 hours" },
  { value: "medium",   label: "Medium",   hint: "Work affected but partially accessible",   sla: "Consultation within 2 hours" },
  { value: "high",     label: "High",     hint: "System down, blocking your team",          sla: "Consultation within 1 hour"  },
  { value: "critical", label: "Critical", hint: "Complete outage — urgent response needed", sla: "Consultation within 30 minutes" },
];

const SEVERITY_LABELS = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function PricingPreview({ service, severity, severitySurcharges, consultingFee }) {
  if (!service || !severitySurcharges) return null;

  const baseFee   = service.resolution_fee;
  const surcharge = severitySurcharges[severity] ?? 0;
  const subtotal  = baseFee + surcharge;
  const gst       = Math.round(subtotal * GST_RATE);
  const resTotal  = subtotal + gst;
  const cfGst     = Math.round(consultingFee * GST_RATE);
  const cfTotal   = consultingFee + cfGst;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-indigo-200 bg-indigo-100/60">
        <span className="font-semibold text-indigo-800 text-xs uppercase tracking-wider">
          Fee Breakdown
        </span>
      </div>

      {/* Consulting fee — due today */}
      <div className="px-4 py-3 border-b border-indigo-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Due today</p>
          <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
            Charged on submit
          </span>
        </div>
        <div className="space-y-1 text-slate-600">
          <div className="flex justify-between">
            <span>Consulting fee</span><span>{fmt(consultingFee)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs">
            <span>GST (18%)</span><span>{fmt(cfGst)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-indigo-200 mt-1">
            <span>Pay today</span><span>{fmt(cfTotal)}</span>
          </div>
        </div>
      </div>

      {/* Resolution fee — after fix */}
      <div className="px-4 py-3 border-b border-indigo-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">After resolution</p>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
            Only charged after fix
          </span>
        </div>
        <div className="space-y-1 text-slate-600">
          <div className="flex justify-between">
            <span>Base fee ({service.name})</span>
            <span>{fmt(baseFee)}</span>
          </div>
          {surcharge > 0 && (
            <div className="flex justify-between">
              <span>Priority surcharge ({SEVERITY_LABELS[severity]})</span>
              <span>+{fmt(surcharge)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500 text-xs">
            <span>GST (18%)</span><span>{fmt(gst)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 pt-1.5 border-t border-indigo-200 mt-1">
            <span>Due after you confirm resolution</span><span>{fmt(resTotal)}</span>
          </div>
        </div>
      </div>

      {/* Refund assurance */}
      <div className="px-4 py-2.5 flex items-start gap-2">
        <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <p className="text-[11px] text-slate-500 leading-snug">
          Refunded automatically if your Support Agent consultation doesn't begin within 4 hours.
        </p>
      </div>
    </div>
  );
}

export default function TicketForm({ onSubmit, loading }) {
  const [catalog,      setCatalog]      = useState(null);
  const [serviceError, setServiceError] = useState(false);
  const [form, setForm] = useState({
    title:        "",
    description:  "",
    service_type: "",
    severity:     "medium",
  });

  useEffect(() => {
    listServices()
      .then(({ data }) => setCatalog(data))
      .catch(() => setServiceError(true));
  }, []);

  const services           = catalog?.services ?? [];
  const severitySurcharges = catalog?.severity_surcharges ?? null;
  const consultingFee      = catalog?.consulting_fee ?? 299;
  const selectedService    = services.find((s) => s.key === form.service_type) ?? null;

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 1 — Service */}
      <div>
        <label htmlFor="ticket-service" className="block text-sm font-semibold text-slate-700 mb-1.5">
          What do you need help with? <span className="text-rose-500">*</span>
        </label>
        {serviceError ? (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Could not load services. Please refresh the page.
          </div>
        ) : !catalog ? (
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <select
            id="ticket-service"
            name="service_type"
            value={form.service_type}
            onChange={handleChange}
            required
            className="input-base"
          >
            <option value="">Choose a service…</option>
            {services.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        )}
        {selectedService?.scope && (
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{selectedService.scope}</p>
        )}
      </div>

      {/* 2 — Urgency (severity) */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          How urgent is this? <span className="text-rose-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-2.5">
          Priority determines how quickly a Support Agent contacts you — it does not affect resolution speed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SEVERITY_OPTIONS.map((opt) => {
            const selected = form.severity === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150
                  ${selected
                    ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
              >
                <input
                  type="radio"
                  name="severity"
                  value={opt.value}
                  checked={selected}
                  onChange={handleChange}
                  className="mt-0.5 accent-indigo-600 shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${selected ? "text-indigo-900" : "text-slate-800"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 leading-snug mt-0.5">{opt.hint}</p>
                  <p className={`text-[10px] font-semibold mt-1 ${selected ? "text-indigo-600" : "text-slate-500"}`}>
                    {opt.sla}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3 — Issue title */}
      <div>
        <label htmlFor="ticket-title" className="block text-sm font-semibold text-slate-700 mb-1.5">
          What's the issue? <span className="text-rose-500">*</span>
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

      {/* 4 — Description */}
      <div>
        <label htmlFor="ticket-description" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Describe the problem <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="ticket-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          required
          rows={4}
          placeholder="What happened? When did it start? What have you already tried?"
          className="input-base resize-none"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          The more detail you provide, the faster your engineer can help.
          You can attach screenshots and log files after submitting.
        </p>
      </div>

      {/* 5 — Fee breakdown */}
      {selectedService ? (
        <PricingPreview
          service={selectedService}
          severity={form.severity}
          severitySurcharges={severitySurcharges}
          consultingFee={consultingFee}
        />
      ) : (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>
            A <strong>₹299 + GST consulting fee</strong> is charged when you open your ticket.
            Select a service above to see the full fee breakdown.
          </span>
        </div>
      )}

      {/* 6 — Submit */}
      <div>
        <Button
          type="submit"
          disabled={loading || serviceError || !catalog}
          className="w-full"
          size="lg"
        >
          {loading ? "Opening ticket…" : "Open Ticket →"}
        </Button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Payment is collected on the next screen.
        </p>
      </div>
    </form>
  );
}
