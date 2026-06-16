# ResolveHQ — Billing System

**Last updated:** 2026-06-16  
**Phase:** 23 (PDF invoice generation — P1-02 fix)

---

## Overview

ResolveHQ's billing system covers the full lifecycle from ticket payment through GST-compliant PDF invoice delivery. Payments are processed via Razorpay (TEST or LIVE mode depending on credentials in `.env`).

---

## Invoice Generation

### Endpoint

```
GET /api/payments/{payment_id}/invoice/
Authorization: Bearer <JWT>

Response:
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="invoice_INV-202606-000001.pdf"
  Body: raw PDF bytes
```

**Who can access:**
- The customer who owns the payment
- Any staff user (`is_staff=True`) — admin can download invoices for any customer

**Unauthorised access returns:** `403 Forbidden`

### PDF Contents

The generated PDF is a GST Tax Invoice compliant with Indian IT service invoice requirements:

| Section | Contents |
|---------|----------|
| **Header** | ResolveHQ logo text, business name, GSTIN, email, SAC code (998313) |
| **Invoice meta** | Invoice number, date, payment status |
| **Bill To** | Customer name, company, email, phone, GSTIN, address |
| **Ticket** | Ticket number, service type, title |
| **Line Items** | Description, SAC 998313, base amount, IGST (18%), total |
| **Totals** | Subtotal, IGST amount, grand total |
| **Payment** | Gateway (Razorpay), Payment ID, Order ID, currency |
| **Footer** | Statutory note, SAC code, billing contact |

### GST treatment

IGST @ 18% applied uniformly (SAC 998313 — IT consulting/support services). A production deployment that has customer state information can split into CGST 9% + SGST 9% for intra-state supplies; IGST is used here to avoid requiring state data from customers.

### PDF library

**ReportLab 4.2.0** — already in `requirements.txt` and installed in the Docker image. No additional dependencies needed.

Generator module: [`backend/support_app/invoice_pdf.py`](../backend/support_app/invoice_pdf.py)

---

## Frontend Integration

### Customer — Billing page (`/billing`)

`BillingPage.jsx` lists all payments for the logged-in customer.  
For each **completed** payment, a "PDF Invoice" download button appears inline.  
Clicking it calls `downloadInvoice(payment.id)` with `responseType: "blob"`, then triggers a browser file download.

### Admin — Payments dashboard (`/admin/payments`)

`PaymentsDashboard.jsx` lists all payments across all customers.  
For each **completed** payment, a "PDF" button with a download icon appears in the actions column.  
Same blob-download mechanism as the customer page.

### API function

```js
// frontend/src/api/payments.js
export const downloadInvoice = (id) =>
  apiClient.get(`/payments/${id}/invoice/`, { responseType: "blob" });
```

The `responseType: "blob"` is critical — without it Axios tries to parse the binary PDF as text/JSON and corrupts it.

---

## Payment Flow

```
Customer submits ticket
  ↓
POST /api/tickets/{id}/initiate-payment/
  → Razorpay order created (or sandbox mock)
  → Returns { order_id, key_id, amount_paise, mode, invoice_number }
  ↓
Frontend loads Razorpay Checkout (live) or "Simulate Payment" button (sandbox)
  ↓
Customer completes payment
  ↓
POST /api/tickets/{id}/verify-payment/
  → HMAC-SHA256 signature verified
  → Payment.status → "completed"
  → Ticket.status → "open"
  → Invoice number auto-assigned (INV-YYYYMM-NNNNNN)
  ↓
GET /api/payments/{id}/invoice/  ← PDF download available
```

---

## Invoice Numbering

Format: `INV-YYYYMM-NNNNNN` (e.g. `INV-202606-000003`)

Set in `payment_service.py` when the payment is first created:
```python
now = timezone.now()
seq = Payment.objects.filter(
    created_at__year=now.year, created_at__month=now.month
).count() + 1
payment.invoice_number = f"INV-{now.strftime('%Y%m')}-{seq:06d}"
```

---

## Payment Modes

| Setting | Mode | Behaviour |
|---------|------|-----------|
| `RAZORPAY_KEY_ID` set in `.env` | **live** | Real Razorpay orders; TEST keys = test mode, no real charges |
| `RAZORPAY_KEY_ID` not set | **sandbox** | Mock order, simulated payment, no external call |

Switch from TEST to LIVE: replace `rzp_test_*` keys with `rzp_live_*` keys and recreate containers (`docker compose up -d`).

---

## Business Settings

Set in `backend/.env`:

```
GST_RATE=0.18
BUSINESS_GSTIN=22AAAAA0000A1Z5
BUSINESS_NAME=Friday Tech Systems
DEFAULT_FROM_EMAIL=support@supportmitra.in
```

These are injected into every invoice via `django.conf.settings`.

---

## Automated Tests

File: `backend/tests/test_payments.py`

| Test | What it checks |
|------|----------------|
| `test_invoice_returns_pdf_content_type` | HTTP 200, `Content-Type: application/pdf`, magic bytes `%PDF` |
| `test_invoice_filename_contains_invoice_number` | `Content-Disposition: attachment; filename=*.pdf` |
| `test_invoice_admin_can_download_any_payment` | Staff user gets 200 for another customer's invoice |
| `test_invoice_other_customer_cannot_download` | Cross-customer access returns 403 |

Run: `docker exec fridaysystems_tech-backend-1 sh -c "cd /app && python -m pytest tests/test_payments.py -v"`

---

## Troubleshooting

### "Received a JSON blob instead of a PDF in the browser"

The frontend forgot `responseType: "blob"` in the Axios call. Without it, Axios decodes binary as UTF-8 and the resulting string is not a valid PDF.

### "PDF opens blank / garbled"

Check that `Content-Type: application/pdf` is present in the response headers (not `application/octet-stream`). ReportLab errors during generation would surface as a 500, not a blank PDF.

### "403 Forbidden when admin tries to download"

Before Phase 23, the invoice endpoint had `@permission_classes([permissions.IsAuthenticated, IsCustomer])` which blocked all staff users. Fixed by changing to `@permission_classes([permissions.IsAuthenticated])` with a manual owner-or-staff check inside the view.
