/**
 * PaymentGateway — payment CTA banner for pending_payment tickets.
 *
 * Dual-mode:
 *   sandbox  (RAZORPAY_KEY_ID not set): shows invoice breakdown + "Simulate Payment" button.
 *            The backend accepts any signature in sandbox mode.
 *   live     (RAZORPAY_KEY_ID set):     dynamically loads Razorpay checkout.js
 *            and opens the real checkout dialog.
 *
 * Props:
 *   ticket          — ticket object (renders nothing if status !== "pending_payment")
 *   onPaymentSuccess(updatedTicket) — called after the ticket moves to "open"
 */
import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { initiatePayment, verifyPayment } from "../../api/payments";

// ── Razorpay script loader ────────────────────────────────────────

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

// ── Invoice breakdown row ─────────────────────────────────────────

function InvoiceRow({ label, amount, bold = false, border = false }) {
  return (
    <div className={`flex justify-between text-sm ${border ? "border-t border-amber-100 pt-2 mt-1" : ""}`}>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>₹{amount}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function PaymentGateway({ ticket, onPaymentSuccess }) {
  const user = useAuthStore((s) => s.user);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [succeeded, setSucceeded] = useState(false);

  if (ticket.status !== "pending_payment") return null;

  // ── Consulting fee breakdown (matches backend CONSULTING_FEE = 299)
  const base  = 299;
  const gst   = Math.round(base * 0.18);   // 18% GST
  const total = base + gst;                 // ₹353

  // ── Verify payment with backend after gateway success ────────────
  const handleVerify = async (verifyData) => {
    const { data: updatedTicket } = await verifyPayment(ticket.id, verifyData);
    setLoading(false);
    setSucceeded(true);
    onPaymentSuccess(updatedTicket);
  };

  // ── Initiate: call backend, then open checkout ───────────────────
  const handleInitiate = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await initiatePayment(ticket.id);
      setOrderData(data);

      if (data.mode === "sandbox") {
        setLoading(false);
        return; // render the "Simulate" button
      }

      // Live mode: load Razorpay JS and open checkout
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load payment gateway. Please refresh and try again.");

      const rzp = new window.Razorpay({
        key:         data.key_id,
        amount:      data.amount_paise,
        currency:    data.currency,
        order_id:    data.order_id,
        name:        "SupportMitra",
        description: `Consulting fee — ${ticket.ticket_number}`,
        prefill:     { email: user?.email ?? "" },
        theme:       { color: "#4F46E5" },
        handler: async (response) => {
          try {
            await handleVerify({
              payment_db_id:       data.payment_db_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_signature:  response.razorpay_signature,
            });
          } catch {
            setError("Payment was received but confirmation failed. Please contact support.");
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? "Could not initiate payment.");
      setLoading(false);
    }
  };

  // ── Sandbox simulate ─────────────────────────────────────────────
  const handleSimulate = async () => {
    if (!orderData) return;
    setLoading(true);
    setError(null);
    try {
      await handleVerify({
        payment_db_id:       orderData.payment_db_id,
        razorpay_payment_id: `pay_sandbox_${Date.now()}`,
        razorpay_order_id:   orderData.order_id,
        razorpay_signature:  "sandbox_signature",
      });
    } catch (err) {
      setError(err.response?.data?.detail ?? "Simulation failed. Try again.");
      setLoading(false);
    }
  };

  // ── Success state ────────────────────────────────────────────────
  if (succeeded) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-lg">✅</span>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Payment confirmed!</p>
          <p className="text-xs text-emerald-600 mt-0.5">Your ticket is now open and in our queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-lg shrink-0">💳</span>
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Payment required to open your ticket</h3>
          <p className="text-xs text-amber-700 mt-0.5 leading-snug">
            A one-time consulting fee confirms your support request and secures your place in the queue.
          </p>
        </div>
      </div>

      {/* ── Invoice breakdown ────────────────────────────────── */}
      <div className="bg-white/80 border border-amber-100 rounded-xl p-4 space-y-1.5">
        <InvoiceRow label="Consulting fee" amount={base} />
        <InvoiceRow label="GST (18%)"      amount={gst} />
        <InvoiceRow label={`Total due`}    amount={total} bold border />
        <p className="text-[11px] text-slate-400 pt-0.5">
          Invoice {orderData?.invoice_number ?? "will be generated on payment"}
        </p>
      </div>

      {/* ── Sandbox notice ───────────────────────────────────── */}
      {orderData?.mode === "sandbox" && (
        <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs text-indigo-700">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span><strong>Sandbox mode</strong> — Razorpay keys not configured. Click below to simulate a payment without any real charge.</span>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5 text-xs text-rose-700">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── CTA button ───────────────────────────────────────── */}
      {!orderData ? (
        <button
          onClick={handleInitiate}
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-semibold text-sm py-2.5 rounded-xl
                     hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-colors
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading payment…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              Pay ₹{total}
            </>
          )}
        </button>
      ) : orderData.mode === "sandbox" ? (
        <button
          onClick={handleSimulate}
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-semibold text-sm py-2.5 rounded-xl
                     hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-colors
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Processing…
            </>
          ) : (
            "Simulate Payment (Sandbox)"
          )}
        </button>
      ) : null}

      {/* ── Trust footer ─────────────────────────────────────── */}
      <p className="text-[11px] text-amber-600 text-center flex items-center justify-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Secured by Razorpay · 256-bit SSL · PCI DSS compliant
      </p>
    </div>
  );
}
