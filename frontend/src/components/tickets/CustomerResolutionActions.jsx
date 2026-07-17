/**
 * CustomerResolutionActions — shown to the ticket owner when status is "resolved".
 *
 * New flow:
 *   resolved →
 *     [Accept Solution]      → fee quote → Razorpay / sandbox payment →
 *                              CSAT rating → verify-resolution-payment → closed
 *     [Issue Still Exists]   → rejection note → ticket returns to in_progress
 */
import { useEffect, useRef, useState } from "react";
import { getResolutionQuote, initiateResolutionPayment, verifyResolutionPayment, rejectResolution } from "../../api/tickets";
import { useToast } from "../../context/ToastContext";
import { useAuthStore } from "../../store/authStore";
import { CONTACT } from "../../config/contact";
import Button from "../ui/Button";
import { CreditCardIcon } from "./ActionIcons";

// ── Razorpay loader ───────────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function InvoiceRow({ label, amount, bold = false, border = false }) {
  return (
    <div className={`flex justify-between text-sm ${border ? "border-t border-slate-200 pt-2 mt-1" : ""}`}>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>{fmt(amount)}</span>
    </div>
  );
}

const SCORES = [
  { value: 5, label: "Excellent", emoji: "😄" },
  { value: 4, label: "Good",      emoji: "🙂" },
  { value: 3, label: "Neutral",   emoji: "😐" },
  { value: 2, label: "Poor",      emoji: "😕" },
  { value: 1, label: "Terrible",  emoji: "😞" },
];

export default function CustomerResolutionActions({ ticket, onUpdate }) {
  const toast = useToast();
  const user  = useAuthStore((s) => s.user);

  // view: "decision" | "quote" | "payment_ready" | "rating" | "rejecting"
  const [view,         setView]        = useState("decision");
  const [quote,        setQuote]       = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [orderData,    setOrderData]   = useState(null);
  // paymentResponse holds the data needed for verify-resolution-payment
  const [paymentResponse, setPaymentResponse] = useState(null);
  const [score,        setScore]       = useState(null);
  const [comment,      setComment]     = useState("");
  const [note,         setNote]        = useState("");
  const [saving,       setSaving]      = useState(false);
  const [error,        setError]       = useState(null);
  const submittingRef = useRef(false);

  // Orphaned-state detection: CSAT exists but ticket not yet closed
  const isOrphaned = ticket.status === "resolved" && ticket.csat_score != null;
  useEffect(() => {
    if (isOrphaned) onUpdate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrphaned]);

  if (ticket.status !== "resolved") return null;
  if (isOrphaned) return null;

  // ── Step 1: load quote ────────────────────────────────────────────
  const handleShowQuote = async () => {
    setQuoteLoading(true);
    setError(null);
    try {
      const { data } = await getResolutionQuote(ticket.id);
      setQuote(data);
      setView("quote");
    } catch (err) {
      setError(err.response?.data?.detail ?? "Could not load fee details. Please try again.");
    } finally {
      setQuoteLoading(false);
    }
  };

  // ── Step 2: initiate payment ──────────────────────────────────────
  const handleInitiatePayment = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await initiateResolutionPayment(ticket.id);
      setOrderData(data);

      if (data.mode === "sandbox") {
        setSaving(false);
        setView("payment_ready");
        return;
      }

      // Live: load Razorpay and open checkout
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load payment gateway. Please refresh and try again.");

      const rzp = new window.Razorpay({
        key:         data.key_id,
        amount:      data.amount_paise,
        currency:    data.currency,
        order_id:    data.order_id,
        name:        "ResolveHQ",
        description: `Resolution fee — ${ticket.ticket_number}`,
        prefill:     { email: user?.email ?? "" },
        theme:       { color: "#4F46E5" },
        handler: (response) => {
          // Razorpay paid — collect CSAT before final verify
          setPaymentResponse({
            payment_db_id:       data.payment_db_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_signature:  response.razorpay_signature,
          });
          setSaving(false);
          setView("rating");
        },
        modal: {
          ondismiss: () => setSaving(false),
        },
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? "Could not initiate payment.");
      setSaving(false);
    }
  };

  // ── Step 2b: sandbox simulate ─────────────────────────────────────
  const handleSimulate = () => {
    setPaymentResponse({
      payment_db_id:       orderData.payment_db_id,
      razorpay_payment_id: `pay_sandbox_${Date.now()}`,
      razorpay_order_id:   orderData.order_id,
      razorpay_signature:  "sandbox_signature",
    });
    setView("rating");
  };

  // ── Step 3: CSAT + verify ─────────────────────────────────────────
  const handleVerifyAndClose = async () => {
    if (!score || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const { data: updatedTicket } = await verifyResolutionPayment(ticket.id, {
        ...paymentResponse,
        score,
        comment,
      });
      toast("Payment confirmed — ticket closed. Thank you!", "success");
      onUpdate(updatedTicket);
    } catch (err) {
      setError(err.response?.data?.detail ?? "Could not confirm payment. Please contact support.");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  // ── Reject flow ───────────────────────────────────────────────────
  const handleReject = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const { data: updatedTicket } = await rejectResolution(ticket.id, note);
      toast("Ticket reopened — your engineer has been notified.", "info");
      onUpdate(updatedTicket);
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not reopen ticket.", "error");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  // ── View: fee quote ───────────────────────────────────────────────
  if (view === "quote") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        <div className="flex items-center gap-2">
          <CreditCardIcon className="w-4 h-4 text-slate-600" />
          <p className="text-sm font-semibold text-slate-800">Resolution Fee</p>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Pay to confirm the fix and close the ticket. Your engineer will be paid after.
        </p>

        {quote && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <InvoiceRow label={`Base fee (${ticket.service_type})`} amount={quote.base_fee} />
            {quote.severity_surcharge > 0 && (
              <InvoiceRow
                label={`Severity add-on (${quote.severity_label})`}
                amount={quote.severity_surcharge}
              />
            )}
            <InvoiceRow label="GST (18%)"    amount={quote.gst_amount} />
            <InvoiceRow label="Total due"    amount={quote.total} bold border />
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleInitiatePayment} loading={saving} disabled={saving} className="flex-1">
            {saving ? "Loading…" : `Pay ${quote ? fmt(quote.total) : ""}  →`}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setView("decision")}>Back</Button>
        </div>
      </div>
    );
  }

  // ── View: sandbox payment ready ───────────────────────────────────
  if (view === "payment_ready") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
        <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs text-indigo-700">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span><strong>Sandbox mode</strong> — no real charge. Click below to simulate payment.</span>
        </div>

        {quote && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <InvoiceRow label={`Base fee (${ticket.service_type})`} amount={quote.base_fee} />
            {quote.severity_surcharge > 0 && (
              <InvoiceRow label={`Severity add-on (${quote.severity_label})`} amount={quote.severity_surcharge} />
            )}
            <InvoiceRow label="GST (18%)"  amount={quote.gst_amount} />
            <InvoiceRow label="Total due"  amount={quote.total} bold border />
          </div>
        )}

        <Button onClick={handleSimulate} className="w-full">
          Simulate Payment (Sandbox)
        </Button>
      </div>
    );
  }

  // ── View: CSAT rating ─────────────────────────────────────────────
  if (view === "rating") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-emerald-800">Payment received — rate your experience</p>
        </div>
        <p className="text-xs text-emerald-700 mb-4 ml-6">Your rating closes the ticket and helps us improve service quality.</p>

        <div className="flex gap-3 mb-4">
          {SCORES.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => setScore(value)}
              title={label}
              className={`flex flex-col items-center text-2xl transition-transform hover:scale-110 ${
                score === value ? "scale-110 opacity-100" : "opacity-50"
              }`}
            >
              {emoji}
              <span className="text-xs text-slate-500 mt-1">{label}</span>
            </button>
          ))}
        </div>

        <label htmlFor="accept-comment" className="sr-only">Additional feedback (optional)</label>
        <textarea
          id="accept-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Optional: share any additional feedback…"
          className="input-base resize-none mb-3"
        />

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
            {error} Contact {CONTACT.supportEmail} if the problem persists.
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            disabled={!score || saving}
            loading={saving}
            onClick={handleVerifyAndClose}
          >
            {saving ? "Closing ticket…" : "Submit & Close Ticket"}
          </Button>
        </div>
      </div>
    );
  }

  // ── View: rejection note ──────────────────────────────────────────
  if (view === "rejecting") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-semibold text-amber-800">Describe what's still not working</p>
        </div>
        <p className="text-xs text-amber-700 mb-4 ml-6">This is optional but helps your engineer fix the right thing.</p>

        <label htmlFor="reject-note" className="sr-only">What's still not working (optional)</label>
        <textarea
          id="reject-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. The login page still shows error 403 after logging in…"
          className="input-base resize-none mb-3"
        />

        <div className="flex items-center gap-2">
          <Button
            variant="warning"
            loading={saving}
            disabled={saving}
            onClick={handleReject}
          >
            {saving ? "Reopening…" : "Reopen Ticket"}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setView("decision")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ── View: decision ────────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm font-semibold text-slate-800">Has your issue been resolved?</p>
      </div>
      <p className="text-xs text-slate-500 mb-4 ml-6">
        Your engineer has marked this ticket as resolved. Accepting will trigger the resolution fee payment.
      </p>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleShowQuote} loading={quoteLoading} disabled={quoteLoading} className="flex-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Accept Solution
        </Button>
        <Button variant="secondary" onClick={() => setView("rejecting")} className="flex-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Issue Still Exists
        </Button>
      </div>
    </div>
  );
}
