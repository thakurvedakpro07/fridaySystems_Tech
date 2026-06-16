# ResolveHQ — Production Readiness Audit Report

**Date:** 2026-06-15  
**Auditor:** Claude Sonnet 4.6 (automated code review)  
**Scope:** Full codebase audit — backend, frontend, infrastructure, CI/CD  
**Purpose:** Identify every bug, deployment risk, and security issue before go-live  
**Status:** CRITICAL + HIGH ISSUES FIXED — see `docs/CRITICAL_FIX_REPORT.md` and `docs/HIGH_PRIORITY_FIX_REPORT.md`

**Critical fix status (Phase 22 — 2026-06-15):**
| ID | Status |
|----|--------|
| C-01 | ✅ FIXED · VERIFIED · TESTED |
| C-02 | ✅ FIXED · VERIFIED · TESTED |
| C-03 | ✅ FIXED · VERIFIED · TESTED |
| C-04 | ✅ FIXED · VERIFIED · TESTED |
| C-05 | ✅ FIXED · VERIFIED · TESTED |

**High priority fix status (Phase 23 — 2026-06-15):**
| ID | Status |
|----|--------|
| H-02 | ✅ FIXED · VERIFIED |
| H-03 | ✅ FIXED · VERIFIED |
| H-04 | ✅ FIXED · VERIFIED |
| H-05 | ✅ FIXED · VERIFIED |
| H-06 | ✅ FIXED · VERIFIED |
| H-07 | ✅ FIXED · VERIFIED |
| H-08 | ✅ FIXED · VERIFIED |
| H-09 | ✅ FIXED · VERIFIED |

---

## Executive Summary

ResolveHQ is structurally sound and architecturally well-designed. The Docker/Nginx/Gunicorn production stack (Phase 21) is production-ready. However, **5 critical blockers** must be resolved before any paying customer touches the system. An additional **9 high-severity** issues should be fixed in the same sprint. Medium and low issues can be deferred to the first post-launch patch.

**Critical blockers (launch-blocking):** 5  
**High severity:** 9  
**Medium severity:** 8  
**Low severity:** 7  
**Total issues:** 29

---

## Issues Ranked by Launch Risk

---

### CRITICAL — Launch Blockers

These issues will either cause the application to be non-functional or create an unacceptable security gap on day one.

---

#### C-01 · Django admin completely unreachable in production — ✅ FIXED · VERIFIED · TESTED

**Severity:** CRITICAL  
**Area:** Docker/Nginx, Admin workflow  
**Fix commit:** Phase 22 (2026-06-15) — Changed `path("admin/", ...)` → `path("django-admin/", ...)` in `backend/supportmitra/urls.py`. nginx already had `/django-admin/` proxy block. Verified: `/admin/` now returns 404, `/django-admin/` resolves to Django admin index.

**Problem:** `nginx.conf` uses `try_files $uri $uri/ /index.html` as the catch-all location. This means any request to `/admin/` is served by the React SPA, not Django. The Django admin (`path("admin/", admin.site.urls)`) at `backend/supportmitra/urls.py:5` is never reached because nginx intercepts it first.

**Reproduction:**
1. Deploy with current nginx config
2. Navigate to `https://supportmitra.in/admin/`
3. Result: React SPA renders (404 page or Dashboard redirect)
4. Django admin login page never appears

**Root cause:** Nginx `try_files` catch-all in the `location /` block processes `/admin/` before the `location /api/` proxy block has a chance — because `/admin/` does not start with `/api/`.

**Fix:** Add a dedicated nginx location block **before** the catch-all `location /` block:
```nginx
location /django-admin/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
Then change `backend/supportmitra/urls.py` to `path("django-admin/", admin.site.urls)`. Also update `docs/DEPLOYMENT_GUIDE.md` to reference `/django-admin/` instead of the current `/admin/` path (which already correctly uses `/django-admin/` in Step 8 nginx comments).

---

#### C-02 · All Celery tasks are empty stubs — no emails, no SLA monitoring — ✅ FIXED · VERIFIED · TESTED

**Severity:** CRITICAL  
**Area:** Notifications, SLA, Payments  
**File:** `backend/support_app/tasks.py`  
**Fix commit:** Phase 22 (2026-06-15) — All 5 tasks implemented. `send_ticket_opened_email` and `send_ticket_assigned_notification` call the existing `email_service.py` functions with retry logic (max_retries=3). `check_sla_breaches` calls the now-implemented `sla_service.run_sla_check_for_all_open_tickets()`. `process_payout_batch` and `sync_ticket_to_osticket` log their deferred-phase status instead of silently doing nothing.

**Problem:** Every Celery task body is a bare `pass`:
```python
@shared_task
def send_ticket_opened_email(ticket_id):
    pass  # ← nothing happens

@shared_task
def send_ticket_assigned_notification(ticket_id, freelancer_id):
    pass

@shared_task
def check_sla_breaches():
    pass

@shared_task
def process_payout_batch():
    pass

@shared_task
def sync_ticket_to_osticket(ticket_id):
    pass
```

**Impact:**
- Customers receive **zero emails** after ticket creation, payment, or resolution
- Freelancers receive **zero notifications** after assignment
- SLA deadlines are tracked in the database (`due_at`, `first_response_at`) but **never checked**
- No SLA breach alerts are ever sent
- Freelancer payouts are never processed

**Note:** `email_service.py` functions (`send_ticket_created`, `send_ticket_assigned`, etc.) are fully implemented and call `render_to_string()` with real templates in `backend/templates/email/`. The templates exist. Only the Celery task wiring is missing.

**Fix:** Implement task bodies to call the existing `email_service` functions. Example:
```python
@shared_task
def send_ticket_opened_email(ticket_id):
    from .models import Ticket
    from .services.email_service import send_ticket_created
    try:
        ticket = Ticket.objects.select_related("customer__user").get(pk=ticket_id)
        send_ticket_created(ticket)
    except Ticket.DoesNotExist:
        pass
```

---

#### C-03 · `notification_service.send_email()` raises NotImplementedError — ✅ FIXED · VERIFIED · TESTED

**Severity:** CRITICAL  
**Area:** Notifications  
**File:** `backend/support_app/services/notification_service.py:36-43`  
**Fix commit:** Phase 22 (2026-06-15) — `send_email()` now delegates to `email_service._send()`. `send_whatsapp()` now logs a notice instead of raising when `ENABLE_WHATSAPP_NOTIFICATIONS=false` (the default). Neither function raises `NotImplementedError` anymore.

**Problem:**
```python
def send_email(to: str, template_name: str, context: dict) -> None:
    raise NotImplementedError
```
If any code path calls `notification_service.send_email()` directly, it will raise a 500 error. Currently, `email_service.py` is used directly (not `notification_service.send_email()`), so this is not yet causing crashes — but it's a trap for future developers who see the function and use it.

**Fix:** Either implement the function (delegate to `email_service`) or rename it to `_send_email_not_implemented` to make the stub status obvious.

---

#### C-04 · SLA service is entirely NotImplementedError — ✅ FIXED · VERIFIED · TESTED

**Severity:** CRITICAL  
**Area:** SLA monitoring  
**File:** `backend/support_app/services/sla_service.py`  
**Fix commit:** Phase 22 (2026-06-15) — All three functions implemented. `get_sla_policy()` queries the SLAPolicy table with a two-level fallback (exact plan → "default" plan → None). `check_ticket_sla()` compares `due_at` to `timezone.now()`, marks `sla_breach_notified=True`, writes a `SLALog` breach entry, and sends in-app notifications to all admin users. `run_sla_check_for_all_open_tickets()` queries open/assigned/in_progress tickets with `due_at` set and calls `check_ticket_sla()` on each. `_DEFAULTS` dict provides SLA windows for all 4 severity levels when no DB policy exists.

**Problem:** All three functions raise `NotImplementedError`. The `check_sla_breaches` Celery Beat task (scheduled every 5 minutes) calls `run_sla_check_for_all_open_tickets()` — or would if the task body wasn't also a stub (C-02). The model fields `first_response_at`, `due_at`, `sla_breach_notified` exist on `Ticket` but are never populated or checked.

**Impact:** SLA is advertised as a product feature ("Average 2-hour first response" on the Login page). In production, no SLA is ever tracked, and `due_at` is never set on tickets. Customers who paid for SLA-backed support get no protection.

**Fix:** Implement `get_sla_policy()` to query the `SLAPolicy` model, `check_ticket_sla()` to compare timestamps, and wire both into the Celery Beat task. At minimum, set `due_at` when a ticket is created/opened.

---

#### C-05 · Invoice download returns HTTP 501 — ✅ FIXED · VERIFIED · TESTED

**Severity:** CRITICAL  
**Area:** Payments, Billing  
**File:** `backend/support_app/views.py` (`payment_invoice` view)  
**Fix commit:** Phase 22 (2026-06-15) — `payment_invoice` now returns a structured JSON invoice with full billing details: invoice number, date, seller (business name/GSTIN/email), buyer (customer name/email/company/GSTIN), ticket reference, line items with GST breakdown, payment gateway details, and grand total. Returns `Content-Disposition: attachment; filename="invoice_*.json"`. Permission check ensures only the payment's customer or an admin can download. PDF generation remains a Phase 5 deliverable; this JSON endpoint is the immediate fix.

**Problem:** The invoice download endpoint (`GET /api/payments/{id}/invoice/`) is a stub that returns 501:
```python
def payment_invoice(request, payment_id):
    return Response({"detail": "Invoice generation not yet implemented."}, status=501)
```

The frontend `BillingPage.jsx` calls `downloadInvoice(id)` via `payments.js:14`. Currently BillingPage doesn't show a download button (it's hidden), but the API endpoint is publicly documented and the frontend module calls it. Any customer who discovers this endpoint gets a 501.

**Fix:** Implement PDF invoice generation using a library like `reportlab` or `weasyprint`. Minimum viable version: return a JSON invoice with all billing fields. Mark the button as "coming soon" in the UI until PDF generation is ready.

---

### HIGH — Should Fix Before Launch

---

#### H-01 · Freelancers get 403 on TicketDetailView — permission class bug

**Severity:** HIGH  
**Area:** Freelancer workflow, Permissions  
**File:** `backend/support_app/permissions.py`

**Problem:** `IsOwnerOrAdmin` only implements `has_object_permission`, not `has_permission`. DRF evaluates `has_permission` **before** running the queryset or calling `has_object_permission`. For freelancers, `has_permission` falls through to the default `BasePermission.has_permission` which returns `True` (since `IsOwnerOrAdmin` doesn't override it). This actually means the permission is more permissive than intended, not less — BUT:

The `TicketDetailView` uses `permission_classes = [IsAuthenticated, IsOwnerOrAdmin]`. `has_object_permission` in `IsOwnerOrAdmin` checks `ticket.customer.user == request.user` — for a freelancer, this is always `False`. There is no `elif request.user.role == "freelancer"` branch. So an approved freelancer who is assigned to a ticket will get a 403 when trying to load `GET /api/tickets/{id}/`.

**Reproduction:**
1. Log in as an approved freelancer
2. Navigate to `/tickets/{uuid}` for a ticket assigned to them
3. `freelancerGetTicket()` calls `GET /api/freelancer/tickets/{id}/` (via `FreelancerTicketView`) — this may work correctly
4. BUT `adminGetTicket()` in `TicketDetailPage.jsx:13` uses `GET /api/tickets/{id}/` for `is_staff` users — confirmed issue for that path

**Note:** `TicketDetailPage.jsx:14` routes freelancers through `freelancerGetTicket()` which uses `/api/freelancer/tickets/{id}/` — a separate endpoint. The 403 primarily affects the admin path where an `is_staff` freelancer exists. However, if `IsOwnerOrAdmin` is applied elsewhere, the gap remains dangerous.

**Fix:** Add a freelancer check to `IsOwnerOrAdmin.has_object_permission()`:
```python
if hasattr(request.user, 'freelancer_profile'):
    return ticket.assigned_to == request.user
```

---

#### H-02 · `change_password` bypasses StrongPasswordValidator

**Severity:** HIGH  
**Area:** Authentication, Security  
**File:** `backend/support_app/views.py` (`change_password` view)

**Problem:** The change password view checks only length:
```python
if len(new_pw) < 10:
    return Response({"detail": "Password must be at least 10 characters."}, status=400)
```
It never calls Django's `validate_password(new_pw, user)`. The `StrongPasswordValidator` in `backend/support_app/validators.py` requires uppercase, lowercase, digit, and special character — but these rules are completely skipped during password change. A user can change to `aaaaaaaaaa` (10 lowercase chars) without error.

**Fix:**
```python
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

try:
    validate_password(new_pw, user)
except DjangoValidationError as e:
    return Response({"detail": "; ".join(e.messages)}, status=400)
```

---

#### H-03 · No password reset flow

**Severity:** HIGH  
**Area:** Authentication  
**File:** `backend/support_app/urls.py`, `frontend/src/pages/Login.jsx`

**Problem:** There is no "Forgot password?" link in `Login.jsx` (line 206 only shows "No account? Create one free"). There are no backend URL routes for password reset. If a customer forgets their password, they have no recovery path — they must contact support.

Django provides `PasswordResetView`, `PasswordResetConfirmView` etc. out of the box. SimpleJWT doesn't, but DRF has `djoser` or the reset can be custom-built.

**Fix:** Add `POST /api/auth/password/reset/` and `POST /api/auth/password/reset/confirm/` endpoints using Django's built-in `send_mail` + `default_token_generator`. Add a "Forgot password?" link to `Login.jsx`. This is a blocker for any production SaaS.

---

#### H-04 · No email verification on registration

**Severity:** HIGH  
**Area:** Authentication, Security  

**Problem:** `RegisterSerializer` creates a user account immediately with no email verification step. Anyone can register with any email address — including `support@razorpay.com` or `admin@yourcompany.com`. There is no `is_verified` flag, no verification email sent, and no token-based verification flow.

**Impact:** Account enumeration, spam registrations, impersonation of email addresses the registrant doesn't own.

**Fix:** After registration, send a verification token via email. Prevent login (or restrict access) until the token is confirmed. The `active` field on `CustomUser` can be set to `False` until verification.

---

#### H-05 · Payout details stored in plaintext despite "Encrypted" claim

**Severity:** HIGH  
**Area:** Security, Freelancer workflow  
**File:** `backend/support_app/models.py` (Freelancer model)

**Problem:** The model comment says `# "Encrypted" — placeholder, real encryption in Phase 5`:
```python
payout_details = models.JSONField(
    default=dict,
    help_text="Encrypted bank/UPI details stored as JSON."  # NOT actually encrypted
)
```
Freelancers enter their bank account numbers and UPI IDs in the Settings page. This data is stored as plaintext JSON in PostgreSQL. A database leak or a compromised Django shell would expose all freelancer financial details.

**Fix:** Use Django's `django-encrypted-fields` or `pgcrypto` extension to encrypt at rest. At minimum, add a clear `TODO: ENCRYPT BEFORE LAUNCH` comment and document the risk. As a stopgap, restrict `payout_details` field from being exposed in any serializer or API response beyond the owner.

---

#### H-06 · `APP_URL` missing from settings — emails link to localhost

**Severity:** HIGH  
**Area:** Notifications, Configuration  
**File:** `backend/support_app/services/email_service.py:15`

**Problem:**
```python
APP_URL = getattr(settings, "APP_URL", "http://localhost:5173")
```
`APP_URL` is not in `settings.py`, `settings_prod.py`, or `.env.example`. In production, all email templates that use `APP_URL` (ticket links, CTA buttons) will generate URLs pointing to `http://localhost:5173` — which customers cannot access.

**Fix:** Add `APP_URL=https://supportmitra.in` to `.env.example` and `settings.py`:
```python
APP_URL = env("APP_URL", default="http://localhost:5173")
```

---

#### H-07 · AdminRoute only checks `is_staff`, not `role == "admin"`

**Severity:** HIGH  
**Area:** Route protection, Admin workflow  
**File:** `frontend/src/App.jsx`

**Problem:**
```jsx
function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_staff) return <Navigate to="/dashboard" replace />;
  return children;
}
```
This allows any Django staff user (`is_staff=True`) to access admin pages, regardless of their `role` field. If a freelancer is accidentally granted `is_staff` in the Django admin, they immediately gain full admin page access including `AdminDashboard`, `FreelancerList`, and `PaymentsDashboard`.

**Fix:** Change the guard to also verify role:
```jsx
if (!user.is_staff || user.role !== "admin") return <Navigate to="/dashboard" replace />;
```
Or, if `is_staff` is the authoritative admin signal, remove the `role` field's relevance from admin checks and document it clearly.

---

#### H-08 · Razorpay webhook signature check bypassed when secret unset

**Severity:** HIGH  
**Area:** Payments, Security  
**File:** `backend/support_app/services/payment_service.py`

**Problem:**
```python
def verify_webhook_signature(payload_body: bytes, signature: str) -> bool:
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        return True   # ← accepts ANY webhook if secret not configured
```
If `RAZORPAY_WEBHOOK_SECRET` is left empty in production `.env` (easy to forget), any HTTP client can POST a fake webhook to `/api/payments/webhook/` and trigger payment completion for any ticket.

**Fix:** If `RAZORPAY_WEBHOOK_SECRET` is empty in production (where `DEBUG=False`), the webhook handler should return 400 or raise an `ImproperlyConfigured` error at startup, not silently accept all webhooks.

---

#### H-09 · JWT tokens stored in localStorage — XSS attack surface

**Severity:** HIGH  
**Area:** Authentication, Security  
**File:** `frontend/src/api/client.js`, `frontend/src/store/authStore.js`

**Problem:** Access tokens, refresh tokens, and the serialized user object are all stored in `localStorage`. Any XSS vulnerability (injected scripts, third-party dependency compromise, malicious attachment served from media URL) can steal tokens and hijack sessions. `localStorage` is accessible to any JavaScript on the same origin.

**Impact:** Token theft via XSS leads to full account takeover with no way to detect or revoke without explicitly revoking the refresh token.

**Note:** This is a known trade-off for SPAs and is common in the industry. However for a payments-handling app with sensitive business data, httpOnly cookies are the industry security baseline.

**Fix (ideal):** Switch to httpOnly cookies (requires backend changes to `TokenObtainPairView` to set `Set-Cookie` headers and frontend to send `credentials: "include"`). **Fix (pragmatic for now):** Ensure Content Security Policy headers in nginx block all inline scripts and restrict `script-src`. Add SameSite cookie handling. Document the risk.

---

### MEDIUM — Fix in First Post-Launch Patch

---

#### M-01 · Admin can accidentally reset ticket to `pending_payment`

**Severity:** MEDIUM  
**Area:** Admin workflow, Ticket lifecycle  
**File:** `backend/support_app/serializers.py` (`AdminStatusSerializer`)

**Problem:** `AdminStatusSerializer` validates `new_status` against all 7 `STATUS_CHOICES` including `pending_payment`. An admin using "Change Status" can move a ticket from `open` back to `pending_payment`, which removes customer access to the ticket until they pay again — for a ticket they may have already paid for.

The frontend `AdminTicketActions.jsx` does guard this (its `STATUS_TRANSITIONS` dict doesn't include `pending_payment` as a target from any state), but the backend serializer doesn't enforce the same constraint. A direct API call can exploit this.

**Fix:** In `AdminStatusSerializer.validate_new_status()`, reject `pending_payment` as a transition target: `if value == "pending_payment": raise ValidationError("Cannot manually set pending_payment status.")`.

---

#### M-02 · FreelancerDashboard shows system-wide stats, not freelancer-scoped stats

**Severity:** MEDIUM  
**Area:** Freelancer workflow, Analytics  
**File:** `frontend/src/pages/freelancer/FreelancerDashboard.jsx:64-73`

**Problem:** The freelancer stats cards call `getAnalytics()` which returns system-wide aggregates:
```javascript
getAnalytics()
  .then(({ data }) => setStats({
    total:    data.total,      // ALL tickets in system
    active:   data.in_progress, // ALL in-progress tickets
    waiting:  data.open,        // ALL open tickets
    resolved: data.resolved,    // ALL resolved tickets
  }))
```
A freelancer sees "Total Assigned: 1,247" when they actually have 3 tickets. The stat card label says "Total Assigned" but the value is the system total.

**Fix:** The backend analytics view should filter by `request.user` for non-admin users. Verify `backend/support_app/views.py`'s `get_analytics` view applies the correct filter — the dashboard stat cards should either call a separate `/api/freelancer/stats/` endpoint or the analytics endpoint must scope results to the caller.

---

#### M-03 · BillingPage stats computed from first page only (pagination bug)

**Severity:** MEDIUM  
**Area:** Billing, Customer workflow  
**File:** `frontend/src/pages/BillingPage.jsx:119-121`

**Problem:**
```javascript
const totalPaid = payments.filter((p) => p.status === "completed")
                          .reduce((s, p) => s + p.total_amount, 0);
```
`payments` state is set from `data.results ?? data`. If the API paginates (returns `{count, results: [...first 20...]}`), only the first page is loaded. A customer with 50 payments will see wrong "Total Paid" amounts.

**Fix:** Either fetch all payments (no pagination), or move the aggregation to the backend and return summary stats separately. The backend `list_my_payments` view should include `total_paid`, `pending_count`, `failed_count` in the response alongside paginated results.

---

#### M-04 · No "Forgot password?" link in Login UI

**Severity:** MEDIUM  
**Area:** Authentication UX  
**File:** `frontend/src/pages/Login.jsx`

**Problem:** `Login.jsx` has no "Forgot password?" or "Reset password" link. When combined with H-03 (no backend reset endpoint), users who forget their password have zero recovery path visible in the UI. Even if H-03 is implemented, the UI link must be added.

**Fix:** Add a "Forgot password?" link below the password field pointing to `/forgot-password` route.

---

#### M-05 · `adminConfirmPayment` frontend call has no matching backend URL

**Severity:** MEDIUM  
**Area:** Admin workflow, Payments  
**File:** `frontend/src/api/payments.js:27-28`

**Problem:**
```javascript
export const adminConfirmPayment = (paymentId) =>
  apiClient.post(`/admin/payments/${paymentId}/confirm/`);
```
There is no `admin/payments/<id>/confirm/` URL in `backend/support_app/urls.py`. This function exists in the frontend API module but calling it will always result in a 404. No current UI component calls it (the `PaymentsDashboard.jsx` admin page wasn't read, but it imports from `payments.js`).

**Fix:** Either implement the backend endpoint or remove the dead frontend function to avoid developer confusion.

---

#### M-06 · File uploads use client-supplied MIME type without magic bytes check

**Severity:** MEDIUM  
**Area:** Security, File uploads  
**File:** `backend/support_app/models.py` (`TicketAttachment.ALLOWED_MIME_TYPES`)

**Problem:** The model defines `ALLOWED_MIME_TYPES` but the MIME type validation relies on `content_type` from the HTTP multipart header — a field that the client controls entirely. An attacker can upload a PHP script with `Content-Type: image/png` and bypass the type check. The `AttachmentSection.jsx` frontend also validates by extension only.

**Fix:** Use Python's `python-magic` library to read the first few bytes (magic bytes) and verify the actual file type, not the declared type:
```python
import magic
actual_mime = magic.from_buffer(file.read(1024), mime=True)
file.seek(0)
if actual_mime not in ALLOWED_MIME_TYPES:
    raise ValidationError("File type not allowed.")
```

---

#### M-07 · Invoice number generation has race condition

**Severity:** MEDIUM  
**Area:** Payments  
**File:** `backend/support_app/services/payment_service.py` (`_generate_invoice_number`)

**Problem:** The invoice number generation queries the last invoice number then increments it in Python. Under concurrent payment processing (two requests within milliseconds of each other), both can read the same last invoice number and generate a duplicate. `invoice_number` has `unique=True` in the DB, so one transaction will fail with an IntegrityError — but this is an unhandled crash path in `verify_and_complete_payment`.

**Fix:** Use `SELECT ... FOR UPDATE` or generate invoice numbers from a PostgreSQL sequence:
```python
from django.db import transaction
with transaction.atomic():
    last = Payment.objects.select_for_update().order_by("-created_at").first()
    ...
```

---

#### M-08 · Auth state trusts localStorage on page refresh without server validation

**Severity:** MEDIUM  
**Area:** Authentication  
**File:** `frontend/src/store/authStore.js` (`initializeAuth`)

**Problem:** On page load, `initializeAuth` reads the stored user object from localStorage and uses it directly without making a server request to validate the token or user state. If a user is deactivated in the Django admin (`is_active=False`) or their role is changed, the frontend will continue showing them as logged in with their old permissions until their access token expires (15 minutes by default).

**Fix:** During `initializeAuth`, make a lightweight call to `/api/auth/me/` or `/api/profile/` to verify the token is still valid and refresh the user object. If the call fails with 401, clear auth state and redirect to login.

---

### LOW — Backlog / Polish

---

#### L-01 · `mfa_enabled` model field has no effect in auth system

**Severity:** LOW  
**Area:** Security  
**File:** `backend/support_app/models.py` (Customer model)

**Problem:** `mfa_enabled = models.BooleanField(default=False)` exists on `Customer` but the authentication flow never checks it. Login proceeds with username+password regardless of whether MFA is enabled. The Settings page tells users "Enable two-factor authentication when available" — implying it's not yet available, which is accurate but misleading.

**Fix (backlog):** Implement TOTP-based MFA using `django-otp` in a future phase, or remove the field until the feature is built.

---

#### L-02 · Extra database SELECT on every ticket save (signal performance)

**Severity:** LOW  
**Area:** Performance  
**File:** `backend/support_app/signals.py` (`log_ticket_changes`)

**Problem:** The `log_ticket_changes` post_save signal issues a `sender.objects.get(pk=instance.pk)` query on **every ticket save** to detect field changes. This doubles the DB queries for any ticket update. Under load (SLA checks updating 100 tickets at once), this becomes 200 queries instead of 100.

**Fix:** Use Django's `pre_save` signal instead to capture old values before saving, then compare in `post_save` without the extra SELECT.

---

#### L-03 · FreelancerTicketActions returns null for non-actionable states — no user message

**Severity:** LOW  
**Area:** Freelancer workflow, UX  
**File:** `frontend/src/components/tickets/FreelancerTicketActions.jsx:40`

**Problem:** `if (nextStatuses.length === 0) return null;` — for `closed`, `pending_payment`, or `open` (unassigned) tickets, the component renders nothing. A freelancer viewing a closed ticket has no visual indication of why there are no action buttons.

**Fix:** Return a small informational message instead of null: "This ticket is closed. No further actions available."

---

#### L-04 · Login always redirects to `/dashboard`, ignores intended destination

**Severity:** LOW  
**Area:** UX, Authentication  
**File:** `frontend/src/pages/Login.jsx:36-38`

**Problem:** After login, the app navigates to `/admin` (staff) or `/dashboard` (everyone else). If a user was trying to access `/tickets/abc123` and got redirected to login (session expired), they land on `/dashboard` and must navigate again.

**Fix:** Use a `from` location state to redirect back to the intended page after login. Set `from` in the `PrivateRoute` redirect and read it in `Login.jsx`.

---

#### L-05 · SOC 2 compliance claim in Login.jsx is factually incorrect

**Severity:** LOW  
**Area:** Legal, UX  
**File:** `frontend/src/pages/Login.jsx:216`

**Problem:** The security badge reads "256-bit SSL encryption · SOC 2 compliant". ResolveHQ has not undergone a SOC 2 audit. This is a false claim that could create legal liability.

**Fix:** Change to "256-bit SSL encryption · Data stays in India" or remove the second claim entirely.

---

#### L-06 · Dashboard analytics error silently swallowed — stats show zeros

**Severity:** LOW  
**Area:** Customer workflow, Error handling  
**File:** `frontend/src/pages/Dashboard.jsx:86`

**Problem:**
```javascript
getAnalytics()
  .then(...)
  .catch(() => {})   // ← error ignored entirely
  .finally(() => setStatsLoading(false));
```
If the analytics API fails, stat cards show `0` for everything with no error message. The user doesn't know if they truly have zero tickets or if there was a loading error.

**Fix:** On error, show a small "Could not load stats" message in the stat cards area, similar to how `tickets` loading errors are handled.

---

#### L-07 · Attachment delete permission excludes assigned freelancers

**Severity:** LOW  
**Area:** Freelancer workflow, File uploads  
**File:** `frontend/src/components/tickets/AttachmentSection.jsx:195`

**Problem:**
```javascript
canDelete={isStaff || att.uploaded_by_email === userEmail}
```
An assigned freelancer who didn't upload a file cannot delete it even if it's irrelevant or incorrectly attached. Only the uploader or admin can delete. This may be intentional but creates friction for freelancers managing ticket context.

**Fix (if desired):** Allow `isFreelancerAssigned` as a third condition. Whether to do this is a product decision.

---

## Summary Table

| ID | Area | Severity | Description |
|----|------|----------|-------------|
| C-01 | Nginx/Admin | CRITICAL | Django admin unreachable — nginx serves React for /admin/ |
| C-02 | Notifications/SLA | CRITICAL | All 5 Celery tasks are empty stubs |
| C-03 | Notifications | CRITICAL | `notification_service.send_email()` raises NotImplementedError |
| C-04 | SLA | CRITICAL | Entire SLA service is NotImplementedError |
| C-05 | Payments | CRITICAL | Invoice download returns HTTP 501 |
| H-01 | Permissions | HIGH | `IsOwnerOrAdmin` missing `has_permission` — freelancer 403 risk |
| H-02 | Auth/Security | HIGH | `change_password` bypasses StrongPasswordValidator |
| H-03 | Auth | HIGH | No password reset flow anywhere |
| H-04 | Auth/Security | HIGH | No email verification on registration |
| H-05 | Security | HIGH | Payout details stored plaintext despite "Encrypted" claim |
| H-06 | Config | HIGH | `APP_URL` missing — email links use localhost in production |
| H-07 | Auth/Routes | HIGH | AdminRoute only checks `is_staff`, not `role == "admin"` |
| H-08 | Payments/Security | HIGH | Webhook signature check bypassed when RAZORPAY_WEBHOOK_SECRET unset |
| H-09 | Auth/Security | HIGH | JWT in localStorage — XSS attack surface |
| M-01 | Admin workflow | MEDIUM | Admin can accidentally set ticket back to `pending_payment` |
| M-02 | Freelancer/Analytics | MEDIUM | Freelancer stats show system-wide totals, not personal stats |
| M-03 | Billing | MEDIUM | Billing total computed from first page only (pagination bug) |
| M-04 | Auth UX | MEDIUM | No "Forgot password?" link in Login UI |
| M-05 | Admin/Payments | MEDIUM | `adminConfirmPayment` API call has no matching backend URL |
| M-06 | Security/Uploads | MEDIUM | File uploads validated by content-type header, not magic bytes |
| M-07 | Payments | MEDIUM | Invoice number race condition (no SELECT FOR UPDATE) |
| M-08 | Auth | MEDIUM | Auth state trusts localStorage on refresh without server check |
| L-01 | Security | LOW | `mfa_enabled` field has no effect in auth system |
| L-02 | Performance | LOW | Extra SELECT on every ticket save in signal |
| L-03 | Freelancer UX | LOW | FreelancerTicketActions renders null with no message for closed tickets |
| L-04 | UX | LOW | Login ignores intended destination after session expiry |
| L-05 | Legal | LOW | SOC 2 compliance claim is false |
| L-06 | UX | LOW | Dashboard analytics errors silently swallowed — stats show zeros |
| L-07 | Freelancer UX | LOW | Attached freelancer cannot delete files they didn't upload |

---

## What Is Working Well

- **Payment flow (Razorpay):** Full dual-mode sandbox/live implementation with HMAC-SHA256 signature verification. PaymentGateway.jsx handles both modes cleanly.
- **Ticket state machine:** Well-structured 7-state lifecycle with frontend guards matching backend transitions. `AdminTicketActions.jsx` STATUS_TRANSITIONS correctly prevents invalid moves in the UI.
- **JWT refresh interceptor:** `client.js` properly handles 401 responses, refreshes tokens, retries the original request, and clears state on refresh failure. No race conditions.
- **Production infrastructure (Phase 21):** Multi-stage Docker builds, Gunicorn auto-worker count, SECURE_PROXY_SSL_HEADER fix, restart policies, healthchecks, named volumes — all correct.
- **Custom exception handler:** Normalised error shape `{detail, errors, status}` with structured logging. All 4xx/5xx properly logged.
- **CSAT system:** Complete flow from widget to API to model storage. Score visible in analytics.
- **Activity timeline:** Immutable audit log, actor patching pattern is sound.
- **Notification bell:** In-app notification creation via `create_notification()` is properly implemented.
- **Role-based routing:** Frontend `PrivateRoute`, `AdminRoute`, `FreelancerRoute` guard all pages. Backend `IsCustomer`, `IsFreelancer`, `IsAdminUser` permission classes are consistent.
- **Registration:** Password validated with StrongPasswordValidator on registration (but bypassed on change — see H-02).
- **CORS settings:** `settings_prod.py` correctly overrides `CORS_ALLOW_ALL_ORIGINS = False` from the base settings.

---

## Recommended Fix Order

**Sprint 1 (before any user touches the system):**  
C-01 → H-06 → H-08 → C-02 (basic email implementation) → H-03 → H-02

**Sprint 2 (before public launch):**  
C-05 (invoice stub) → H-04 → H-05 (payout encryption) → M-04 → H-07 → M-07 → M-01

**Sprint 3 (first patch after soft launch):**  
C-03, C-04 (SLA implementation) → M-02 → M-03 → M-06 → M-05 → M-08

**Backlog:**  
L-01 through L-07 → H-09 (httpOnly cookies — significant refactor)
