// Shared pieces of the ticket-creation flow — the single-page form this
// file used to export was replaced by TicketWizard.jsx (multi-step flow,
// see NewTicket.jsx), but the pricing logic and severity catalog are still
// the single source of truth, reused by the wizard's Priority and Review
// steps rather than re-derived.
export const GST_RATE = 0.18;

// sla = how quickly a Support Agent contacts you for a consultation (NOT resolution speed)
export const SEVERITY_OPTIONS = [
  { value: "low",      label: "Low",      hint: "Non-urgent — can wait",                   sla: "Consultation within 4 hours" },
  { value: "medium",   label: "Medium",   hint: "Work affected but partially accessible",   sla: "Consultation within 2 hours" },
  { value: "high",     label: "High",     hint: "System down, blocking your team",          sla: "Consultation within 1 hour"  },
  { value: "critical", label: "Critical", hint: "Complete outage — urgent response needed", sla: "Consultation within 30 minutes" },
];

export const SEVERITY_LABELS = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));

export function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

export function PricingPreview({ service, severity, severitySurcharges, consultingFee }) {
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
