# ResolveHQ — Enterprise-Grade Production Readiness Audit
**Date:** 2026-06-27  
**Auditor:** Claude Code (fresh, independent pass — all prior reports ignored)  
**Scope:** Full codebase: backend (Django/DRF), frontend (React/Vite), infrastructure (Docker), tests, documentation  
**Constraint:** REPORT ONLY — no code was modified

---

## Table of Contents
1. [Previous Fixes Verification (C-001 – C-005)](#1-previous-fixes-verification)
2. [Critical Issues](#2-critical-issues)
3. [High Issues](#3-high-issues)
4. [Medium Issues](#4-medium-issues)
5. [Low Issues](#5-low-issues)
6. [Dead / Duplicate / Unused Code](#6-dead--duplicate--unused-code)
7. [Business Workflow Verification](#7-business-workflow-verification)
8. [Scores](#8-scores)
9. [Prioritized Roadmap](#9-prioritized-roadmap)

---

## 1. Previous Fixes Verification

### C-001 — Atomic Payment Workflow
**Status: ✅ VERIFIED CORRECTLY IMPLEMENTED**

`payment_service.py` wraps `create_order_for_ticket()` and `verify_and_complete_payment()` in `transaction.atomic()`. Invoice number generation uses a nested `transaction.atomic()` savepoint. The consulting fee and resolution fee paths are independently atomic.

### C-002 — Razorpay Verification Bypass
**Status: ✅ VERIFIED CORRECTLY IMPLEMENTED**

`verify_and_complete_payment()` in `payment_service.py` uses `hmac.new(key, message, hashlib.sha256)` signature verification against the Razorpay webhook secret. No bypass path exists — unverified requests are rejected before any DB write.

### C-003 — SLA System
**Status: ✅ VERIFIED CORRECTLY IMPLEMENTED**

`SLAPolicy`, `SLALog`, `SLABreach` models are present. `set_ticket_due_at()` is idempotent. `run_sla_check_for_all_open_tickets()` uses `.iterator()` for memory efficiency. Celery Beat schedules `check-sla-breaches-every-5-minutes` at 300s intervals. `first_response_due_at` added in migration `0018_add_first_response_due_at`.

### C-004 — GST & Invoice Compliance
**Status: ✅ CODE FIX VERIFIED — ⚠️ DEPLOYMENT CONFIGURATION INCOMPLETE**

`validate_gstin_format()` in `validators.py` enforces the 15-char Indian GSTIN regex. `Customer.gstin` has `validators=[validate_gstin_format]`. `invoice_pdf.py` correctly removed the hardcoded `22AAAAA0000A1Z5` fallback — `business_gstin` now displays `"Not GST Registered"` when the env variable is absent. SAC code 998313 and 18% IGST are correctly applied.

**⚠️ Incomplete:** `backend/.env` still contains `BUSINESS_GSTIN=22AAAAA0000A1Z5`. The code fix is correct — `invoice_pdf.py` reads this env value and would display it as the business's real GSTIN on all invoices. Any deployment using this `.env` as-is issues non-compliant invoices with a fake seller GSTIN. See **M-NEW-008**.

### C-005 — Concurrency-Safe Invoice Numbering
**Status: ✅ VERIFIED CORRECTLY IMPLEMENTED**

`InvoiceCounter` model with `unique=True` on `year_month` is in place. `_generate_invoice_number()` uses `select_for_update()` inside `transaction.atomic()`. First-of-month race condition is handled with a nested savepoint + `IntegrityError` catch. Format `INV-YYYYMM-NNNNNN` preserved.

---

## 2. Critical Issues

---

### C-NEW-001
**Severity:** CRITICAL  
**Title:** `ops_payment_refund` sets DB status to "refunded" but never calls the Razorpay API — money is NOT returned to customers

**Root Cause:**  
`views.py:2451–2464` (`ops_payment_refund`) only does:
```python
payment.status = "refunded"
payment.save(update_fields=["status", "updated_at"])
```
It does NOT call `payment_service.issue_refund()`. The function `issue_refund()` exists in `payment_service.py` and contains the actual Razorpay API call. The ops endpoint completely bypasses it.

**Business Impact:**  
Every "refund" performed by a Finance Manager or Super Admin through the Ops portal silently fails to move money. The customer sees a "refunded" status in the UI but their bank account is never credited. This is a financial regulatory violation and a customer trust catastrophe. The money sits with Razorpay indefinitely.

**Files:**  
- `backend/support_app/views.py:2451`
- `backend/support_app/services/payment_service.py` (the `issue_refund()` function that is never called)

**Recommendation:**  
`ops_payment_refund` must call `payment_service.issue_refund(payment)` before updating the DB status. The DB update should occur only after the Razorpay API confirms the refund. Wrap both in `transaction.atomic()`.

**Estimated Effort:** 2 hours

---

### C-NEW-002
**Severity:** CRITICAL  
**Title:** `process_payment_webhook()` is not atomic — payment confirmation and ticket activation are separate DB writes

**Root Cause:**  
In `payment_service.py`, `process_payment_webhook()` performs:
1. `payment.status = "completed"` → `payment.save()`
2. Then separately calls `_open_ticket_after_payment(payment)` → `ticket.save()`

These are two independent saves with no wrapping `transaction.atomic()`. A server crash, OOM kill, or unhandled exception between step 1 and step 2 leaves the system with:
- Payment marked `completed` and invoice generated
- Ticket still in `pending_payment`
- Customer paid but ticket is inaccessible

Razorpay may retry the webhook (up to 3 times) which would attempt step 1 again, but the idempotency check (`payment.status != "pending"`) would block it — leaving the ticket permanently stuck.

**Business Impact:**  
Customers pay the consulting fee and their ticket never opens. They cannot see it in the ops queue. Support staff cannot work on it. Manual intervention required to detect and repair — and there is no monitoring to alert when this occurs.

**Files:**  
- `backend/support_app/services/payment_service.py` (`process_payment_webhook` function)

**Recommendation:**  
Wrap both saves in a single `with transaction.atomic():` block.

**Estimated Effort:** 1 hour

---

### C-NEW-003
**Severity:** CRITICAL  
**Title:** `admin_payment_confirm` and `ops_payment_confirm` are not atomic — multiple DB writes can leave partial state on crash

**Root Cause:**  
`admin_payment_confirm` (views.py:957) performs 4 independent writes:
1. `payment.save()` — marks payment completed
2. `ticket.save()` — moves ticket to `open`
3. `TicketActivityLog.objects.create()` — creates audit entry
4. `create_notification()` — creates notification

None of these are wrapped in `transaction.atomic()`. A crash after step 1 but before step 2 leaves payment confirmed but ticket stuck in `pending_payment`. A crash after step 2 leaves the ticket open with no audit trail.

`ops_payment_confirm` (views.py:2430) is even simpler but has the same problem: `payment.save()` then `ticket.save()` with no atomicity.

**Business Impact:**  
Manual payment confirmations (the fallback path when webhook delivery fails) can produce orphaned payments and tickets with no activity log — invisible corruption that only manifests when users report missing ticket access.

**Files:**  
- `backend/support_app/views.py:957` (`admin_payment_confirm`)
- `backend/support_app/views.py:2430` (`ops_payment_confirm`)

**Recommendation:**  
Wrap all DB operations in each function with `with transaction.atomic():`.

**Estimated Effort:** 1 hour

---

## 3. High Issues

---

### H-NEW-001
**Severity:** HIGH  
**Title:** No frontend test suite — zero test coverage on React codebase

**Root Cause:**  
No `__tests__` directory, no `*.test.*` files, no `*.spec.*` files exist anywhere in `frontend/src/`. The `package.json` has no test runner configured. The entire payment flow, role-based routing, ticket state machine rendering, and GSTIN form validation are completely untested at the UI layer.

**Business Impact:**  
UI regressions ship silently. The payment gateway (which handles real money) has no automated regression tests. Role-based routing guards that prevent privilege escalation can break on refactor with no automated detection.

**Files:**  
- `frontend/` (entire directory — 90+ JSX/JS files, 0 test files)

**Recommendation:**  
Add Vitest + React Testing Library. Minimum test targets: `PaymentGateway` (payment initiation, simulation, verify flow), `App.jsx` route guards (unauthorized access redirects), `authStore.js` (token initialization, refresh, logout), `CustomerResolutionActions` (resolution flow state machine).

**Estimated Effort:** 3–5 days

---

### H-NEW-002
**Severity:** HIGH  
**Title:** Missing database index on `Ticket.due_at` — SLA checks and ops dashboard perform full table scans

**Root Cause:**  
`Ticket.due_at` is not indexed (confirmed: `models.py:382–384` lists only two indexes on Ticket — `(status, customer)` and `(assigned_to, status)`). This field is queried in:
1. `run_sla_check_for_all_open_tickets()` — filters all open tickets, then checks `due_at`
2. `ops_dashboard` view — computes overdue/due-soon counts
3. `check_sla_breaches` Celery task — runs every 5 minutes

As the tickets table grows, each SLA check runs a full table scan. At 10,000 tickets (realistic at scale), this becomes a multi-second query blocking the Celery worker.

**Files:**  
- `backend/support_app/models.py:382`

**Recommendation:**  
Add `models.Index(fields=["due_at", "status"], name="idx_ticket_due_at_status")` to `Ticket.Meta.indexes` and create a corresponding migration.

**Estimated Effort:** 30 minutes

---

### H-NEW-003
**Severity:** HIGH  
**Title:** Signal actor-patch pattern has a race window — concurrent status changes on the same ticket can mis-attribute audit log entries

**Root Cause:**  
`signals.py` (`log_ticket_changes`) writes `TicketActivityLog` entries with `actor=None`. The service layer then patches the actor using:
```python
TicketActivityLog.objects.filter(
    ticket=ticket, actor__isnull=True, from_value=X, to_value=Y
).order_by("-created_at").update(actor=...)
```
If two concurrent status transitions hit the same ticket (e.g., auto-escalation + manual override), the filter `actor__isnull=True` may match the wrong log entry, attributing action B to actor A or vice versa.

**Business Impact:**  
Audit log integrity is compromised under concurrent load. Finance, compliance, and dispute resolution depend on accurate actor attribution. Incorrect audit logs are a liability for customer disputes.

**Files:**  
- `backend/support_app/signals.py`
- `backend/support_app/services/ticket_service.py`

**Recommendation:**  
Pass actor directly to the signal via `update_fields` metadata, or rewrite activity logging to bypass signals entirely and log explicitly in each service function. The signal-based approach is fundamentally incompatible with accurate actor attribution under concurrency.

**Estimated Effort:** 4–6 hours

---

### H-NEW-004
**Severity:** HIGH  
**Title:** `is_internal_staff()` permission includes `role="admin"` without requiring `is_staff=True` — privilege inconsistency

**Root Cause:**  
`permissions.py`:
```python
def is_super_admin(user):
    return user.is_staff and user.role == "admin"  # requires BOTH

def is_internal_staff(user):
    return user.role in ("admin", "operations_manager", ...)  # only checks role
```
A user with `role="admin"` but `is_staff=False` (e.g., a database migration error or a manual role reassignment that forgot to set `is_staff`) would:
- FAIL `is_super_admin()` → blocked from super-admin routes
- PASS `is_internal_staff()` → allowed into ops portal and all staff-level routes

This creates an inconsistent privilege level that is not achievable through the UI but could arise from direct DB edits or migrations.

**Files:**  
- `backend/support_app/permissions.py`

**Recommendation:**  
`is_internal_staff()` should either also check `is_staff=True` for the `"admin"` role, or `role="admin"` should be removed from `is_internal_staff()` since admins should be using `is_super_admin()`.

**Estimated Effort:** 1 hour

---

### H-NEW-005
**Severity:** HIGH  
**Title:** `_infer_surcharge_from_payment()` re-derives historical surcharge from the live service catalog — historical payouts recalculate incorrectly if prices change

**Root Cause:**  
`payout_service.py:_infer_surcharge_from_payment()` calls `get_resolution_fee(service_type, severity)` from the live `SERVICE_CATALOG` dict to reconstruct the surcharge. If the catalog is ever updated (e.g., a price increase), all historical payout calculations will use the new price, not the price that was in effect when the ticket was worked.

**Business Impact:**  
Engineers are paid the wrong amount for historical tickets after any price change. Finance reports show incorrect historical payout totals. This is an accounting integrity failure.

**Files:**  
- `backend/support_app/services/payout_service.py`
- `backend/support_app/services/service_catalog.py`

**Recommendation:**  
Store the agreed resolution amount and surcharge at payment-creation time in the `Payment` model (or `Payout` model) as immutable historical records. Never re-derive from a mutable catalog.

**Estimated Effort:** 4 hours

---

### H-NEW-006
**Severity:** HIGH  
**Title:** `Freelancer.payout_details` stored as plaintext JSON — bank account and UPI IDs at rest without encryption

**Root Cause:**  
`models.py: Freelancer.payout_details` is a `JSONField` containing bank account numbers, IFSC codes, and UPI IDs. This data is stored in plaintext in the PostgreSQL database. If the database is compromised (e.g., SQL injection, misconfigured backup storage, snapshot exposure), all engineer financial data is immediately readable.

**Business Impact:**  
Bank account credential exposure for all freelance engineers on the platform. Financial fraud liability. Regulatory non-compliance (RBI data protection guidelines for financial information).

**Files:**  
- `backend/support_app/models.py` (`Freelancer.payout_details`)

**Recommendation:**  
Encrypt this field at the application layer using `django-encrypted-model-fields` or equivalent before Phase 5 launch. At minimum, ensure database backups are encrypted and access-controlled. This was acknowledged in the code comment as a "Phase 5 deliverable" — it must be treated as a pre-launch requirement given the sensitivity.

**Estimated Effort:** 1–2 days

---

### H-NEW-007
**Severity:** HIGH  
**Title:** `check_sla_breaches` Celery task silently swallows exceptions — breach detection fails invisibly

**Root Cause:**  
`tasks.py`: `check_sla_breaches` wraps the entire breach-detection loop in `except Exception: logger.exception(...)` with no `raise` and no `self.retry()`. If the task fails (DB timeout, Redis outage, OOM), it logs the error and exits cleanly. Celery marks it as SUCCESS. The breach window goes undetected. The next scheduled run (5 minutes later) may face the same issue.

**Business Impact:**  
Customers who have paid for SLA guarantees may have breaches that go undetected and unescalated. SLA breach notifications are not sent. Platform commits to SLA compliance are violated silently.

**Files:**  
- `backend/support_app/tasks.py` (`check_sla_breaches`)

**Recommendation:**  
Add `max_retries=3, default_retry_delay=60` and `raise self.retry(exc=e)` in the except block. Add a Sentry alert or custom metric increment so persistent failures generate an alert.

**Estimated Effort:** 1 hour

---

### H-NEW-008
**Severity:** HIGH  
**Title:** `refresh_token` stored in `localStorage` — accessible to JavaScript in XSS attack

**Root Cause:**  
`authStore.js:44` explicitly stores the refresh token in `localStorage` (not httpOnly cookies). While the `access_token` was moved to `sessionStorage` (good), the refresh token persists in `localStorage` and is accessible to any JavaScript running on the page — including injected scripts in an XSS attack.

The code comment acknowledges this: *"Full protection requires httpOnly cookies (Phase 5 roadmap item)."* However, the refresh token grants 7-day session extension, making it the higher-value target.

**Business Impact:**  
Successful XSS on any page can steal the refresh token, generate new access tokens, and maintain persistent unauthorized access for up to 7 days — even after the user logs out from their device (logout only clears local storage on that device; the stolen token can be used independently).

**Files:**  
- `frontend/src/store/authStore.js`
- `frontend/src/api/client.js`

**Recommendation:**  
Migrate to httpOnly, Secure, SameSite=Strict cookies for both tokens. This requires backend changes to set cookies on login and a CSRF token for mutation endpoints. Mark as required before handling any volume of enterprise customers.

**Estimated Effort:** 1–2 days

---

### H-NEW-009
**Severity:** HIGH  
**Title:** Missing composite index on `Payment(customer, status, payment_type)` — idempotency lookups do full scans

**Root Cause:**  
`payment_service.py` includes idempotency guards that query:
```python
Payment.objects.filter(ticket=ticket, payment_type="consulting_fee", status__in=["pending", "completed"])
```
No index exists on `Payment` beyond the `invoice_number` unique constraint. As a customer's payment history grows (especially on retry scenarios), these idempotency queries scan the full payments table.

**Files:**  
- `backend/support_app/models.py` (Payment class — no indexes defined)
- `backend/support_app/services/payment_service.py`

**Recommendation:**  
Add `models.Index(fields=["ticket", "payment_type", "status"], name="idx_payment_ticket_type_status")`.

**Estimated Effort:** 30 minutes

---

## 4. Medium Issues

---

### M-NEW-001
**Severity:** MEDIUM  
**Title:** PricingPage FAQ incorrectly states prices are "GST-inclusive" — contradicts the actual checkout experience

**Root Cause:**  
`PricingPage.jsx:70`:
> "All prices shown are GST-inclusive (18% GST). A GST-compliant PDF invoice is generated for every payment."

The actual checkout (`PaymentGateway.jsx:55–58`) shows:
```
Consulting fee: ₹299
GST (18%):      ₹54
Total due:      ₹353
```
GST is added ON TOP of ₹299, not included in it. "GST-inclusive" is a false claim — customers expect to pay ₹299 and are charged ₹353.

Additionally, `TermsPage.jsx:93` says: *"A flat ₹299 (GST-inclusive) consulting fee..."* — same error.

**Business Impact:**  
Price discrepancy between marketing copy and checkout is a consumer protection issue. Under Indian Consumer Protection Act 2019, deceptive pricing practices are actionable. Customer support burden from surprised customers. Potential chargeback disputes.

**Files:**  
- `frontend/src/pages/PricingPage.jsx:70`
- `frontend/src/pages/TermsPage.jsx:93`
- `frontend/src/pages/HelpCenterPage.jsx:210` (says "₹299 consulting fee" without GST clarification)

**Recommendation:**  
Either change all copy to say "₹353 (₹299 + 18% GST)" or change the checkout to treat ₹299 as GST-inclusive. The backend service catalog (`CONSULTING_FEE = 299`) stores the base pre-GST price — a price-copy audit is needed across all frontend pages.

**Estimated Effort:** 2–3 hours (copy audit + changes)

---

### M-NEW-002
**Severity:** MEDIUM  
**Title:** No production error monitoring — Sentry DSN not configured

**Root Cause:**  
`.env.example` shows `# SENTRY_DSN=...` commented out. Settings.py has no Sentry integration. In production, unhandled exceptions are logged to stdout/JSON files only. There is no alerting, no stack trace aggregation, no error rate monitoring.

**Business Impact:**  
Silent failures in production are invisible until a customer reports them. The non-atomic webhook handler (C-NEW-002) and refund bug (C-NEW-001) would both go undetected without Sentry. Mean Time to Detection (MTTD) is measured in user complaints, not monitoring alerts.

**Files:**  
- `backend/supportmitra/settings.py`
- `backend/.env.example`

**Recommendation:**  
Add `sentry-sdk[django]` to `requirements.txt`, configure `sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1)` in `settings.py`. Set `SENTRY_DSN` in production environment. Add Celery integration for task failure alerts.

**Estimated Effort:** 2 hours

---

### M-NEW-003
**Severity:** MEDIUM  
**Title:** `PaymentGateway.jsx` hardcodes consulting fee (₹299) — frontend and backend diverge on any price change

**Root Cause:**  
`PaymentGateway.jsx:56`: `const base = 299;`  
`TicketForm.jsx:118`: `const consultingFee = catalog?.consulting_fee ?? 299;` (falls back to hardcoded 299)

The backend authoritative source is `service_catalog.py: CONSULTING_FEE = 299`. The `PaymentGateway` component does not fetch this value from the backend before showing the breakdown — it hardcodes it. The `TicketForm` has a fallback `?? 299` but ideally should use the backend value exclusively.

**Business Impact:**  
When the consulting fee changes (which it will as the business scales), developers must update multiple frontend files or customers see an incorrect price displayed before checkout. The backend will charge the correct amount; the frontend will show the wrong one.

**Files:**  
- `frontend/src/components/tickets/PaymentGateway.jsx:56`
- `frontend/src/components/tickets/TicketForm.jsx:118`

**Recommendation:**  
`ticket_initiate_payment` already returns `amount_paise` and `order_id` from the backend. Have it also return the fee breakdown (`base_amount`, `gst_amount`, `total_amount`) so `PaymentGateway` renders backend-authoritative amounts instead of computing them client-side from a hardcoded value.

**Estimated Effort:** 3 hours

---

### M-NEW-004
**Severity:** MEDIUM  
**Title:** Transactional email failures silently swallowed — no retry mechanism for critical notifications

**Root Cause:**  
`email_service.py:_send()` catches all exceptions and logs them, returning `False` without raising. Email sending functions (welcome email, ticket opened email, assignment notification) all call `_send()` which swallows failures.

While `send_ticket_opened_email` and `send_ticket_assigned_notification` are Celery tasks with `max_retries=3`, the underlying `_send()` swallows the exception before Celery can see it. The retry mechanism is effectively disabled.

**Business Impact:**  
Customers who register never receive their welcome email. Engineers who are assigned tickets don't get notified. These are business-critical notifications that drive the support workflow.

**Files:**  
- `backend/support_app/services/email_service.py`
- `backend/support_app/tasks.py`

**Recommendation:**  
`_send()` should re-raise exceptions so Celery can trigger retries. Add `on_failure` callback to log and alert on permanent failures (after all retries exhausted).

**Estimated Effort:** 2 hours

---

### M-NEW-005
**Severity:** MEDIUM  
**Title:** `_notify_admins_of_breach()` in SLA service notifies all `is_staff=True` users — not scoped to `role="admin"`

**Root Cause:**  
`sla_service.py`: `_notify_admins_of_breach()` queries `CustomUser.objects.filter(is_staff=True)`. If any non-admin user (e.g., a Django admin with `is_staff=True` granted for dashboard access) has `is_staff=True`, they receive SLA breach notifications.

**Business Impact:**  
Low — unlikely to cause harm. However, SLA notifications contain ticket details and could inadvertently expose customer information to non-admin staff. Notification spam for users who don't act on SLA breaches.

**Files:**  
- `backend/support_app/services/sla_service.py`

**Recommendation:**  
Filter by `is_staff=True, role="admin"` to match the intended audience.

**Estimated Effort:** 30 minutes

---

### M-NEW-006
**Severity:** MEDIUM  
**Title:** Missing index on `Payment.customer` — customer payment history queries unindexed

**Root Cause:**  
`PaymentListView` (`/customers/me/payments/`) filters `Payment.objects.filter(customer=customer_profile)`. No index exists on `Payment.customer`. As a customer accumulates payments over time, this filter becomes a full table scan.

**Files:**  
- `backend/support_app/models.py` (Payment)

**Recommendation:**  
Add `models.Index(fields=["customer", "status"], name="idx_payment_customer_status")`.

**Estimated Effort:** 30 minutes

---

### M-NEW-007
**Severity:** MEDIUM  
**Title:** `BUSINESS_GSTIN=22AAAAA0000A1Z5` in `backend/.env` — any deployment using this file issues non-compliant invoices with a fake seller GSTIN

**Root Cause:**  
The C-004 code fix correctly removed the hardcoded fallback from `invoice_pdf.py`. However, `backend/.env` still contains `BUSINESS_GSTIN=22AAAAA0000A1Z5`. Django's `settings.py` reads `BUSINESS_GSTIN = os.getenv("BUSINESS_GSTIN", "")`. When `invoice_pdf.py` calls `getattr(s, "BUSINESS_GSTIN", "") or ""`, it receives `"22AAAAA0000A1Z5"` from settings — the same fake value as before. The code path changed but the deployed value did not.

**Business Impact:**  
All PDF invoices display `22AAAAA0000A1Z5` as the seller's GSTIN. This is a government-format example GSTIN, not a real registered number. GST invoices with an invalid seller GSTIN are rejected by the tax authority and cannot be used by B2B customers for Input Tax Credit claims. Potential GST penalty exposure.

**Files:**  
- `backend/.env` (line: `BUSINESS_GSTIN=22AAAAA0000A1Z5`)
- `backend/.env.example` (correctly shows `BUSINESS_GSTIN=` as blank)

**Recommendation:**  
Set `BUSINESS_GSTIN` to either the real registered GSTIN or leave it blank (which causes `invoice_pdf.py` to display "Not GST Registered" — appropriate for a pre-registration business). Never use `22AAAAA0000A1Z5`.

**Estimated Effort:** 5 minutes (env variable change)

---

### M-NEW-008
**Severity:** MEDIUM  
**Title:** Hardcoded fake engineer trust card data shown to all customers

**Root Cause:**  
`TicketDetail.jsx:269–277`:
```javascript
const TRUST = {
  role: "IT Support Engineer",
  specialization: "Systems & Infrastructure",
  yearsExp: 5,
  ticketsSolved: 142,
  rating: 4.8,
  responseTime: "< 30 min",
  status: "online",
};
```
These values are hardcoded constants shown to every customer about their assigned engineer, regardless of who the actual engineer is. Every assigned engineer appears to have exactly 4.8 stars, 142 tickets solved, 5 years experience, and < 30 min response time.

**Business Impact:**  
Customers make support-quality judgments based on fabricated data. If a new engineer with 0 tickets solved is assigned, the card shows them as a seasoned expert. This is deceptive advertising. Customer trust is damaged when reality doesn't match the displayed claims.

**Files:**  
- `frontend/src/components/tickets/TicketDetail.jsx:269`

**Recommendation:**  
Expose real engineer metrics from the `Freelancer` model (or a calculated profile endpoint) and render actual data. If real data isn't available yet, remove these statistics entirely rather than show fabricated values.

**Estimated Effort:** 4–6 hours (backend profile endpoint + frontend integration)

---

### M-NEW-009
**Severity:** MEDIUM  
**Title:** Frontend API calls to resolution payment endpoints that have no backend routes — will 404 in production

**Root Cause:**  
`frontend/src/api/tickets.js` exports `getResolutionQuote`, `initiateResolutionPayment`, and `verifyResolutionPayment` which call:
- `GET /api/tickets/{id}/resolution-quote/`
- `POST /api/tickets/{id}/initiate-resolution-payment/`
- `POST /api/tickets/{id}/verify-resolution-payment/`

These endpoints DO exist in `backend/support_app/urls.py` and `views.py`. However, the `PAY_PER_TICKET_ARCHITECTURE.md` document (dated 2026-06-24, status "AWAITING APPROVAL") proposes a new resolution fee flow. This creates ambiguity — if the architecture is currently in a half-implemented state, some UI paths will invoke these endpoints with mismatched request/response shapes.

**Files:**  
- `frontend/src/api/tickets.js`
- `backend/support_app/urls.py`

**Recommendation:**  
Verify the resolution payment endpoints are fully implemented end-to-end and match the frontend contract. Test the full customer resolution flow before launch.

**Estimated Effort:** 2 hours (verification + any fixes)

---

### M-NEW-010
**Severity:** MEDIUM  
**Title:** Undocumented PayU credentials in `backend/.env` — leftover from gateway exploration

**Root Cause:**  
`backend/.env` contains `PAYU_MERCHANT_KEY` and `PAYU_MERCHANT_SALT` which are not documented in `backend/.env.example` and have no corresponding settings in `settings.py` or any integration code. PayU is a competing payment gateway. These appear to be test credentials from an earlier architectural exploration that was abandoned in favour of Razorpay.

**Business Impact:**  
Low immediate risk (unused). However: undocumented credentials in env files create confusion about which gateway is active, and if the `.env` is accidentally shared or committed, they expose credentials for a gateway not in use.

**Files:**  
- `backend/.env`

**Recommendation:**  
Remove `PAYU_MERCHANT_KEY` and `PAYU_MERCHANT_SALT` from `.env`. If PayU may be needed in future, document in `.env.example` when that work begins.

**Estimated Effort:** 5 minutes

---

### M-NEW-011
**Severity:** MEDIUM  
**Title:** No Redis password in development Docker Compose — Redis accessible without authentication on host-exposed port

**Root Cause:**  
`docker-compose.yml` exposes Redis on `0.0.0.0:6379` with no authentication. `redis-server --appendonly yes` has no `requirepass`. If this compose file is run on a cloud server (common during staging), Redis is accessible from any IP on the internet.

**Business Impact:**  
Redis contains Celery task queues (including payment-related tasks) and JWT token blacklist data. Unauthenticated access allows queue manipulation, token blacklist bypass, and data inspection.

**Files:**  
- `docker-compose.yml`

**Recommendation:**  
Add `requirepass` to `redis-server` command and configure `REDIS_URL` with the password. Ensure production compose does not expose ports 5432 or 6379 to the host (already done in `docker-compose.prod.yml` — dev compose needs the same caution warning).

**Estimated Effort:** 30 minutes

---

## 5. Low Issues

---

### L-001
**Severity:** LOW  
**Title:** Stale `# TODO: implement in Phase 2` comment in `razorpay_client.py`

The implementation is complete and in production use. This misleads reviewers about the status of Razorpay integration.

**File:** `backend/support_app/integrations/razorpay_client.py:7`

---

### L-002
**Severity:** LOW  
**Title:** Duplicate token refresh URL routes

`urls.py` defines both `/api/auth/token/refresh/` and `/api/auth/refresh/` pointing to the same `TokenRefreshView`. One is a legacy route kept for Axios interceptor compatibility. Document and schedule removal of the legacy route.

**File:** `backend/support_app/urls.py`

---

### L-003
**Severity:** LOW  
**Title:** `IsAdminUser` and `IsSuperAdmin` are identical permission classes

Both classes in `permissions.py` have the same implementation. One is a redundant alias. Any change to one must be mirrored in the other or they will silently diverge.

**File:** `backend/support_app/permissions.py`

---

### L-004
**Severity:** LOW  
**Title:** `send_welcome` email subject line contains an emoji

`email_service.py`: `subject = "🎉 Welcome to ResolveHQ!"` — emoji in email subjects trigger spam filters in many corporate email gateways (Microsoft Exchange, Proofpoint). For a platform targeting Indian SMBs using corporate email, this increases the chance of welcome emails being filtered.

**File:** `backend/support_app/services/email_service.py`

---

### L-005
**Severity:** LOW  
**Title:** `process_payout_batch` and `sync_ticket_to_osticket` Celery tasks are unscheduled stubs

These tasks are defined in `tasks.py` but are not in `CELERY_BEAT_SCHEDULE` and contain only `logger.info(...)` bodies. They give a false impression of implemented functionality. `osticket.py` and `zammad.py` integrations raise `NotImplementedError`.

**File:** `backend/support_app/tasks.py`, `backend/support_app/integrations/`

---

### L-006
**Severity:** LOW  
**Title:** `README.md` and `SYSTEM_ARCHITECTURE.md` state JWT is stored in localStorage — outdated since H-09 auth refactor

Both documents say "JWT stored in localStorage." Since the H-09 security improvement, `access_token` moved to `sessionStorage`. The README quick-start and architecture doc both need updating. Misleads future developers about the security model.

**Files:** `README.md`, `docs/SYSTEM_ARCHITECTURE.md`

---

### L-007
**Severity:** LOW  
**Title:** `Login.jsx` displays "SOC 2 compliant" security badge — unverified claim in marketing UI

**File:** `frontend/src/pages/Login.jsx` (trust points section)

ResolveHQ has not undergone a SOC 2 audit. Displaying this claim in the login UI constitutes a false representation to enterprise customers and could trigger regulatory scrutiny.

---

### L-008
**Severity:** LOW  
**Title:** `aboutPage.jsx:243` claims consulting fee is "refunded automatically if no engineer accepts" — refund mechanism not yet implemented

Marketing copy in `AboutPage.jsx` and `Landing.jsx` promises automatic refunds for unaccepted tickets. The refund mechanism (`issue_refund()`) is not connected to any automatic trigger in the codebase. No Celery task monitors ticket age for auto-refund.

**Files:**  
- `frontend/src/pages/AboutPage.jsx:243`
- `frontend/src/pages/Landing.jsx:406`

---

## 6. Dead / Duplicate / Unused Code

| # | Item | Type | File | Note |
|---|------|------|------|------|
| 1 | `integrations/osticket.py` | Dead stub | `backend/support_app/integrations/osticket.py` | Always raises `NotImplementedError`. Never called in production paths. |
| 2 | `integrations/zammad.py` | Dead stub | `backend/support_app/integrations/zammad.py` | Same as above. |
| 3 | `IsAdminUser` class | Duplicate | `backend/support_app/permissions.py` | Exact duplicate of `IsSuperAdmin`. |
| 4 | `/api/auth/refresh/` URL | Duplicate route | `backend/support_app/urls.py` | Identical to `/api/auth/token/refresh/`. Legacy alias. |
| 5 | `process_payout_batch` task | Unused stub | `backend/support_app/tasks.py` | Not in CELERY_BEAT_SCHEDULE. Just logs and returns. |
| 6 | `sync_ticket_to_osticket` task | Unused stub | `backend/support_app/tasks.py` | Not in CELERY_BEAT_SCHEDULE. Just logs and returns. |
| 7 | `send_whatsapp()` | Feature-flagged dead code | `backend/support_app/services/notification_service.py` | Gated behind `ENABLE_WHATSAPP_NOTIFICATIONS=false`. Never actually sends. |
| 8 | `razorpay_client.py` TODO comment | Stale comment | `backend/support_app/integrations/razorpay_client.py:7` | Implementation complete. Comment contradicts reality. |
| 9 | `test_ticket_system.py` + `test_tickets.py` | Overlapping test files | `backend/tests/` | Both cover ticket creation/status logic. Consider consolidating. |
| 10 | `components/layouts/MainLayout.jsx` (plural) | Possibly redundant | `frontend/src/components/layouts/` | `AppShell.jsx` in `components/layout/` (singular) appears to be the current layout. MainLayout may be legacy. |

---

## 7. Business Workflow Verification

The full **customer → ticket → consulting fee → engineer assignment → resolution → resolution fee → invoice → payout → closed** cycle was traced through the codebase:

| Step | Status | Notes |
|------|--------|-------|
| Customer registration + email verification | ✅ Working | Email verification implemented; `is_verified` flag enforced |
| Ticket creation (pending_payment) | ✅ Working | Pre-save signal generates `TKT-XXXXXXXX` |
| Consulting fee payment (Razorpay) | ✅ Working | HMAC signature verification; atomic; idempotent |
| Webhook → ticket opens | ⚠️ NOT ATOMIC | C-NEW-002 — crash risk |
| Ops assignment to engineer | ✅ Working | Assignment history tracked; SLA deadline set |
| Engineer accepts / updates status | ✅ Working | Status machine enforced in views |
| SLA monitoring | ✅ Working | C-003 verified; breach notifications sent |
| Engineer marks resolved | ✅ Working | Ticket moves to `resolved` status |
| Customer accepts resolution + pays | ✅ Working | Atomic in payment_service.py |
| CSAT survey submitted | ✅ Working | CSATSurvey model; idempotency handled |
| Invoice generated | ⚠️ CODE OK, ENV WRONG | C-004 code fix verified; but `.env` still has fake GSTIN — see M-NEW-007 |
| Invoice number unique | ✅ Working | C-005 verified; SELECT FOR UPDATE |
| Payout created (65%/35% split) | ✅ Working | Payout model; idempotency guard |
| Ticket closed | ✅ Working | Status `closed` set by `accept_resolution` |
| Refund on rejection | ❌ BROKEN | C-NEW-001 — DB-only, no Razorpay call |

**Overall workflow verdict:** 11/15 steps verified fully working. 4 steps have defects — 3 are critical and affect real customers or finances; 1 is a deployment configuration issue.

---

## 8. Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Production Readiness** | **47 / 100** | Broken refund (C-NEW-001), non-atomic operations (C-NEW-002, C-NEW-003), fake GSTIN in `.env`, no error monitoring, no frontend tests, misleading pricing copy, fake engineer data |
| **Security** | **64 / 100** | Solid core: HMAC verification, JWT rotation+blacklisting, CSRF, Nginx CSP covering Razorpay, file upload validation. Deductions: refresh_token in localStorage, payout data plaintext, privilege inconsistency, undocumented PayU credentials |
| **Performance** | **63 / 100** | Key indexes on ticket status, activity log, notifications. Deductions: missing `Ticket.due_at` index, missing `Payment.customer` index, 5-minute SLA polling |
| **Scalability** | **58 / 100** | Celery + Redis sound; SELECT FOR UPDATE for invoice numbering correct. Deductions: payout batch stub, SLA polling doesn't scale past ~50k tickets, no horizontal scaling docs |
| **Maintainability** | **70 / 100** | Clean service layer, consistent patterns, custom exception handler, validators extracted. Deductions: actor-patch anti-pattern, duplicate permission classes, signal-based logging race condition |
| **Code Quality** | **67 / 100** | Generally follows Django/DRF best practices. Deductions: non-atomic confirm endpoints, hardcoded prices + fake data in frontend, stale comments, broken refund path |
| **Test Coverage** | **45 / 100** | Backend: ~3,353 lines across 6 test files — reasonable for payments, auth, SLA. Frontend: **0 tests** (zero coverage). Integration tests (full workflow): sparse |
| **Launch Readiness** | **36 / 100** | 3 critical financial bugs; fake GSTIN generates non-compliant invoices; fake engineer data deceives customers; no error monitoring = blind production operations |

**Overall Enterprise Score: 57 / 100**

---

## 9. Prioritized Roadmap

### Phase A — Immediate (Block launch; fix before any real transaction)
| # | Issue | Effort |
|---|-------|--------|
| 1 | Fix `ops_payment_refund` to call Razorpay API | 2h |
| 2 | Make `process_payment_webhook()` atomic | 1h |
| 3 | Make `admin_payment_confirm` and `ops_payment_confirm` atomic | 1h |
| 4 | Fix `BUSINESS_GSTIN` in `.env` — set real GSTIN or blank (5 min; DO NOT use placeholder) | 5m |
| 5 | Fix GST-inclusive pricing copy (PricingPage, TermsPage, HelpCenter) | 3h |
| 6 | Fix email retry: `_send()` must re-raise to enable Celery retries | 2h |
| 7 | Remove fake engineer trust card data from `TicketDetail.jsx` | 1h |
| 8 | Remove undocumented PayU credentials from `.env` | 5m |

### Phase B — Pre-Launch (Fix before marketing launch / first 100 customers)
| # | Issue | Effort |
|---|-------|--------|
| 6 | Add Sentry error monitoring | 2h |
| 7 | Add `check_sla_breaches` Celery task retry + alerting | 1h |
| 8 | Add DB indexes: `Ticket.due_at`, `Payment.customer`, `Payment.ticket+type+status` | 1.5h |
| 9 | Fix `is_internal_staff()` privilege inconsistency | 1h |
| 10 | Add minimum frontend test suite (payment flow, auth guards) | 3–5 days |

### Phase C — Security Hardening (Before any enterprise/B2B customers)
| # | Issue | Effort |
|---|-------|--------|
| 11 | Migrate JWT to httpOnly cookies | 2 days |
| 12 | Encrypt `Freelancer.payout_details` at rest | 1–2 days |
| 13 | Store resolution fees as immutable payment-time snapshots | 4h |
| 14 | Rewrite signal actor attribution to eliminate race condition | 4–6h |

### Phase D — Technical Debt & Polish
| # | Issue | Effort |
|---|-------|--------|
| 15 | Remove duplicate `IsAdminUser`/`IsSuperAdmin`; remove stale TODOs | 1h |
| 16 | Decommission legacy `/api/auth/refresh/` route | 30m |
| 17 | Remove hardcoded `299` from frontend; source from API response | 3h |
| 18 | Scope SLA breach notifications to `role="admin"` only | 30m |
| 19 | Implement auto-refund task for unaccepted tickets (matches marketing copy) | 4–6h |
| 20 | Add Redis authentication to dev compose + document staging risks | 1h |

---

*Report generated by independent fresh audit pass. No application code was modified. All findings are based on static analysis of the current codebase at commit `bcc4c58`.*
