# ResolveHQ — Payment & Billing System Report
_Implemented: 2026-05-24_

---

## Overview

This phase built the production-grade payment and billing foundation for ResolveHQ.
The architecture is fully Razorpay-ready: switch live keys on in `.env` and the entire
checkout flow activates with no code changes.  Without keys, every flow works in
**sandbox mode** — a simulated checkout that exercises the full order→verify→open
pipeline in development.

---

## What Changed

### Backend

| File | Change |
|---|---|
| `support_app/services/payment_service.py` | Full implementation — order creation, signature verify, webhook processing, refund stub |
| `support_app/serializers.py` | Added `PaymentSerializer` enhancements (total_amount, ticket_number), `AdminPaymentSerializer`, `PaymentVerifySerializer` |
| `support_app/views.py` | Added `ticket_initiate_payment`, `ticket_verify_payment`, `AdminPaymentListView`, `admin_payment_confirm`; improved `payment_webhook` |
| `support_app/urls.py` | Registered 4 new endpoints; fixed webhook URL ordering |

### Frontend

| File | Change |
|---|---|
| `src/api/payments.js` | Added `initiatePayment`, `verifyPayment`, `listAdminPayments`, `adminConfirmPayment` |
| `src/components/tickets/PaymentGateway.jsx` | **NEW** — sandbox + live dual-mode checkout component |
| `src/components/tickets/TicketDetail.jsx` | PaymentGateway wired for customer role on pending_payment tickets |
| `src/pages/BillingPage.jsx` | **NEW** — customer payment history with stats |
| `src/pages/admin/PaymentsDashboard.jsx` | **NEW** — admin payment controls with manual confirm |
| `src/App.jsx` | Added `/billing` and `/admin/payments` routes |
| `src/components/layout/Header.jsx` | Added "Billing" (customer) and "Payments" (admin) nav links |

---

## Payment Architecture

### Ticket lifecycle

```
Customer submits ticket
        ↓
  status = pending_payment
        ↓
  Customer opens ticket page
        ↓
  PaymentGateway component shown
        ↓
  POST /tickets/{id}/initiate-payment/
  → backend creates Payment record (status=pending)
  → returns Razorpay order (or mock in sandbox)
        ↓
  ┌── sandbox ──────────────────────────────────┐
  │  "Simulate Payment" button shown            │
  │  POST /tickets/{id}/verify-payment/         │
  │  (any signature accepted in sandbox mode)   │
  └─────────────────────────────────────────────┘
  ┌── live ──────────────────────────────────────┐
  │  Razorpay checkout.js loads dynamically      │
  │  Customer completes real payment             │
  │  handler() calls POST verify-payment/       │
  │  with razorpay_payment_id + signature       │
  └─────────────────────────────────────────────┘
        ↓
  verify_and_complete_payment()
  → HMAC-SHA256 signature verified (skipped sandbox)
  → Payment.status = completed
  → Ticket.status = pending_payment → open
  → TicketActivityLog entry written
  → payment_confirmed notification sent to customer
```

### Webhook path (production)

```
Razorpay server → POST /api/payments/webhook/
    → verify_webhook_signature() — HMAC-SHA256
    → process_payment_webhook() — handles payment.captured
    → same downstream: Payment completed, ticket opened
```

### Admin fallback

```
Admin sees pending payment in /admin/payments
    → clicks "Confirm" button
    → POST /api/admin/payments/{id}/confirm/
    → Payment marked completed manually
    → Ticket opened, notification sent
    → Audit note: "manually confirmed by admin"
```

---

## Fee Schedule

| Type | Amount | GST (18%) | Total |
|---|---|---|---|
| Consulting fee | ₹299 | ₹54 | ₹353 |

Resolution fees (future phase):

| Service | Fee |
|---|---|
| Desktop / Laptop | ₹499 |
| Linux Provisioning | ₹999 |
| Windows Provisioning | ₹999 |
| OS Patching | ₹799 |
| Security Hardening | ₹1,499 |
| VMware / Hypervisor | ₹1,299 |
| SAP Basis Lite | ₹1,999 |

---

## API Contract

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/tickets/{id}/initiate-payment/` | POST | Customer | Create/retrieve pending order |
| `/api/tickets/{id}/verify-payment/` | POST | Customer | Verify sig + complete payment |
| `/api/customers/me/payments/` | GET | Customer | Own payment history |
| `/api/payments/{id}/` | GET | Customer | Single payment detail |
| `/api/payments/webhook/` | POST | None | Razorpay webhook receiver |
| `/api/admin/payments/` | GET | Admin | All payments with filters |
| `/api/admin/payments/{id}/confirm/` | POST | Admin | Manual payment confirmation |

### initiate-payment response

```json
{
  "order_id": "order_mock_abc123",
  "payment_db_id": "uuid",
  "amount": 353,
  "amount_paise": 35300,
  "currency": "INR",
  "key_id": null,
  "invoice_number": "INV-202605-000001",
  "mode": "sandbox"
}
```

`key_id` is `null` in sandbox; the real Razorpay key when live.
`mode` is `"sandbox"` or `"live"` — the frontend switches behavior based on this.

---

## Sandbox vs Live Mode

| Behaviour | Sandbox (no keys) | Live (keys configured) |
|---|---|---|
| Order creation | Mock `order_mock_*` ID | Real Razorpay order |
| Frontend checkout | "Simulate Payment" button | Razorpay checkout.js dialog |
| Signature verification | Skipped | HMAC-SHA256 verified |
| Webhook verification | Skipped | HMAC-SHA256 verified |
| Payment record | Created + completed | Created + completed |
| Ticket status | Opens on verify | Opens on verify or webhook |

To go live: set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in `backend/.env`.

---

## Invoice Numbering

Format: `INV-YYYYMM-NNNNNN`

Examples:
- `INV-202605-000001` — first payment in May 2026
- `INV-202605-000002` — second payment

Sequential per-month counter, zero-padded to 6 digits.

---

## Verification

Full end-to-end sandbox flow tested post-implementation:

| Check | Result |
|---|---|
| `POST /tickets/{id}/initiate-payment/` (customer) | 200 ✓ — sandbox order returned |
| `POST /tickets/{id}/verify-payment/` (customer) | 200 ✓ — ticket status = open |
| `GET /customers/me/payments/` (customer) | 200 ✓ — completed payment visible |
| `GET /admin/payments/` (admin) | 200 ✓ — payment with invoice, ticket_number |
| `GET /admin/payments/` (freelancer) | 403 ✓ |
| `GET /admin/payments/` (customer) | 403 ✓ |
| `POST /admin/payments/{id}/confirm/` (admin) | 200 ✓ — ticket moves to open |
| Invoice sequential numbering | ✓ INV-202605-000001, INV-202605-000002 |
| Activity log on payment | ✓ pending_payment → open logged |
| Customer notification on payment | ✓ payment_confirmed category |
| Frontend build (`npm run build`) | ✓ 149 modules, 0 errors |
| Django system check | ✓ 0 issues |

---

## Not Changed (by design)

- Razorpay live keys (not configured — sandbox only)
- Existing dashboard layouts
- Auth system
- Freelancer payout logic (Phase 4)
- PDF invoice generation (Phase 5)
- Subscription recurring billing (Phase 4)
- Deployment configs
- Landing page
