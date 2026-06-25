# ResolveHQ — Production Readiness Audit Report

**Date:** 2026-06-25
**Auditor:** Claude Sonnet 4.6 (automated code review)
**Scope:** Full codebase audit — backend (Django/DRF), frontend (React/Zustand), services, integrations
**Purpose:** Identify every bug, deployment risk, and security issue before go-live
**Prior report:** Supersedes the 2026-06-15 report. Previous critical/high fixes applied. This audit reflects current codebase state.

---

## Executive Summary

ResolveHQ has a solid architectural foundation — UUID primary keys, role-based permission classes, JWT with refresh rotation, Razorpay payment integration, and a structured service layer. Test coverage is meaningful for happy paths and permission boundaries.

However, **five critical issues** threaten production correctness and legal compliance:
1. Non-atomic financial operations that can create partial payment records
2. Hardcoded sandbox payment defaults that bypass signature verification
3. SLA deadline system fully implemented but never invoked (SLA timers never start)
4. Fraudulent GSTIN placeholder on all customer invoices
5. Race condition in invoice number generation

**Issue counts by severity:**
| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 8 |
| Medium | 9 |
| Low | 7 |
| Dead Code | 8 items |
| Performance | 5 items |
| Documentation | 4 items |

**Recommended production deployment:** Block on all Critical + High issues before go-live.

---

## Critical Issues

### C-001 — Non-Atomic Resolution Payment Flow Allows Partial Commits

- **Status: VERIFIED ✓ and FIXED ✓** (2026-06-25)
- **Category:** Financial / Data Integrity
- **File:** `backend/support_app/services/payment_service.py` lines 324–424

**Verified root cause (two distinct attack surfaces):**

1. **`verify_and_complete_payment()` (lines 167-172)** — `payment.save()` and `_open_ticket_after_payment()` (which calls `ticket.save()`, `TicketActivityLog.create()`, and `create_notification()`) were all executed sequentially with no wrapping transaction. If `_open_ticket_after_payment()` failed after `payment.save()` committed, the payment row was permanently "completed" while the ticket remained stuck in `pending_payment`. Customer charged; ticket never opened.

2. **`verify_resolution_payment_service()` (lines 390-424)** — Five writes (payment, ticket close, `TicketActivityLog`, `CSATSurvey`, payout) with no transaction envelope. Any failure after the first `payment.save()` left the payment committed but the ticket, CSAT, or payout in a broken state. Payout creation failures were silently swallowed with `except Exception: pass` — engineers go unpaid with no log, no alert.

**Fix applied:**

- **`payment_service.py:15-27`** — Added `import logging`, `from django.db import transaction`, and `_logger = logging.getLogger(__name__)` at module level.

- **`payment_service.py:171-176` (`verify_and_complete_payment`)** — Wrapped `payment.save()` + `_open_ticket_after_payment()` call in `with transaction.atomic():`. If the ticket update fails, the payment save rolls back atomically.

- **`payment_service.py:394-442` (`verify_resolution_payment_service`)** — Wrapped the core financial writes (payment, ticket close, `TicketActivityLog`, `CSATSurvey`) in `with transaction.atomic():`. Payout creation is left **outside** the atomic block by design — its failure must not re-trigger a payment reversal (the customer has already paid). Replaced `except Exception: pass` with `_logger.exception("Payout creation failed for ticket %s", ticket.pk)`.

**Files modified:**
- `backend/support_app/services/payment_service.py` (lines 15-27, 171-176, 394-442)
- `backend/tests/test_payments.py` (4 new C-001 tests, `Freelancer` added to imports)

**Tests added (`tests/test_payments.py`):**
| Test | Result |
|------|--------|
| `test_verify_and_complete_payment_is_atomic` | PASSED |
| `test_verify_resolution_payment_service_is_atomic` | PASSED |
| `test_payout_failure_does_not_rollback_resolution_payment` | PASSED |
| `test_payout_failure_is_logged` | PASSED |

**No regressions:** 11 tests pass in `test_payments.py` (up from 7 before C-001 fix). 8 pre-existing failures are all Redis/Docker infrastructure errors (no change).

**Remaining risks:**
- `_open_ticket_after_payment` calls `create_notification()` inside the atomic block. If notification creation ever does external I/O (email, push), a network failure would roll back the payment. Currently `create_notification` only writes a DB row — safe. Monitor if this changes.
- Payout failures are now logged but still do not trigger an ops alert or retry queue. Log monitoring must be set up for `payment_service` logger at ERROR level.

---

### C-002 — Hardcoded Sandbox Defaults Bypass Payment Signature Verification

- **Status: VERIFIED ✓ and FIXED ✓** (2026-06-25)
- **Category:** Security
- **File:** `backend/support_app/views.py` lines ~717–730; `backend/support_app/services/payment_service.py` lines ~40–60

**Verified root cause (two distinct attack surfaces):**

1. **`views.py:742-744`** — `verify_resolution_payment` used `.get("razorpay_payment_id", "sandbox_pay")` etc., meaning a POST body with only `payment_db_id` + `score` would pass `"sandbox_pay"`, `"sandbox_order"`, `"sandbox_sig"` directly to the service. The consulting fee endpoint (`ticket_verify_payment`) already used `PaymentVerifySerializer` which required all three fields — the resolution fee endpoint did not.

2. **`payment_service.py:151-158`, `368-375`** — Both verify functions gated HMAC on `if key_secret:` (is `RAZORPAY_KEY_SECRET` set?), **not** on `if RAZORPAY_KEY_ID:` (are we in live mode?). If `RAZORPAY_KEY_SECRET` was absent in production while `RAZORPAY_KEY_ID` was set, real Razorpay orders would be created but payment verification would be completely bypassed — any signature accepted.

**Fix applied:**

- **`views.py:741-757`** — Removed all three hardcoded defaults. Added explicit 400 validation guards for `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` before calling the service. Frontend sandbox mode is unaffected (it always sends all three fields with mock values).

- **`payment_service.py:151-164`, `370-383`** — Changed sandbox detection from `if key_secret:` to `if RAZORPAY_KEY_ID:` (live mode). In live mode, if `RAZORPAY_KEY_SECRET` is absent, raises `ImproperlyConfigured` (500) rather than silently skipping verification. In sandbox mode (no `RAZORPAY_KEY_ID`), signature check is explicitly skipped as intended.

**Files modified:**
- `backend/support_app/views.py` (lines 742-757)
- `backend/support_app/services/payment_service.py` (lines 151-164, 370-383)
- `backend/tests/test_payments.py` (6 new C-002 tests added)

**Tests added (`tests/test_payments.py`):**
| Test | Result |
|------|--------|
| `test_verify_resolution_payment_missing_razorpay_payment_id_returns_400` | PASSED |
| `test_verify_resolution_payment_missing_razorpay_order_id_returns_400` | PASSED |
| `test_verify_resolution_payment_missing_razorpay_signature_returns_400` | PASSED |
| `test_verify_and_complete_payment_rejects_bad_signature_in_live_mode` | PASSED |
| `test_verify_resolution_payment_service_rejects_bad_signature_in_live_mode` | PASSED |
| `test_verify_and_complete_payment_sandbox_skips_signature_check` | PASSED |

**No regressions:** 38 previously passing tests still pass. 81 pre-existing failures are all Redis/Docker infrastructure errors (no change).

---

### C-003 — SLA Deadlines Never Set: Entire SLA System is Non-Functional

- **Category:** Feature Broken
- **File:** `backend/support_app/services/sla_service.py` lines 55–78; `backend/supportmitra/settings.py`
- **Description:** `set_ticket_due_at()` is correctly implemented — it looks up SLAPolicy by service type and severity, then sets `ticket.due_at`. However, this function is **never called from any code path** in `payment_service.py`, `ticket_service.py`, `views.py`, `signals.py`, or `tasks.py`. Every ticket has `due_at = null`.

  Additionally, the Celery Beat schedule for `check_sla_breaches` is **not defined in `settings.py`** — the task exists but never runs automatically. Consequence: SLA breach detection never fires, no breach notifications are sent, `SLALog` is never populated, and the entire SLA feature is silently dead.

- **Impact:** SLA commitments advertised to customers are never enforced. Tickets can breach SLA with zero alerting to ops/admin. Breach log is always empty.
- **Reproduction:** Create a ticket, wait for any SLA window to pass. `ticket.due_at` is null; no breach notification sent.
- **Fix:** Call `set_ticket_due_at(ticket)` at the end of `verify_and_complete_payment()` after ticket moves to "open". Add `CELERY_BEAT_SCHEDULE` entry for `check_sla_breaches` in `settings.py`.

---

### C-004 — Fraudulent GSTIN Placeholder on All Customer Invoices

- **Category:** Legal / Compliance (CGST Act)
- **File:** `backend/support_app/invoice_pdf.py` lines 100, 307
- **Description:**
  ```python
  business_gstin = getattr(s, "BUSINESS_GSTIN", "22AAAAA0000A1Z5")
  ```
  `22AAAAA0000A1Z5` is the Indian government's canonical example/test GSTIN used in documentation. It is not a valid GST registration. If `BUSINESS_GSTIN` is not set in the production environment, every GST-compliant invoice sent to customers will display a fraudulent GSTIN. This is a statutory violation under the CGST Act. Line 307 also contains hardcoded placeholder contact details (`1800-123-4567`, `billing@resolvehq.in`).

- **Impact:** Statutory violation. Customers receive legally invalid invoices. Potential GST authority action.
- **Reproduction:** Do not set `BUSINESS_GSTIN` env var. Generate any invoice. GSTIN shows `22AAAAA0000A1Z5`.
- **Fix:** Require `BUSINESS_GSTIN` in settings with `ImproperlyConfigured` if absent. Read phone/email from environment variables — remove hardcoded placeholders.

---

### C-005 — Race Condition in Non-Atomic Invoice Number Generation

- **Category:** Data Integrity / Concurrency
- **File:** `backend/support_app/services/payment_service.py` lines 33–47
- **Description:** `_generate_invoice_number()` performs a non-atomic read-then-write:
  1. `Payment.objects.filter(invoice_number__startswith=prefix).count()` — reads current count
  2. Constructs `INV-YYYYMM-NNNN` from that count
  3. Saves the new payment record

  Under concurrent requests (two customers paying simultaneously), both threads read the same count, generate the same invoice number, and both attempt to save. The `unique=True` constraint on `invoice_number` means one raises `IntegrityError` — surfacing as a 500 to the user mid-payment.

- **Impact:** Random payment failures during concurrent load. Bad UX for paying customers. Risk of lost payments.
- **Reproduction:** Hammer the payment endpoint with 2+ concurrent requests in the same month.
- **Fix:** Use `select_for_update()` within `transaction.atomic()`, or use a PostgreSQL sequence for the numeric suffix.

---

## High Issues

### H-001 — Unverified Users Can Access All Private Routes

- **Category:** Security / Auth
- **File:** `frontend/src/App.jsx` — `PrivateRoute` component
- **Description:** `PrivateRoute` only checks `isAuthenticated` from Zustand store. It does **not** check `is_verified`. A user who registered but has not confirmed their email can log in (the backend issues tokens without checking `is_verified`) and access all customer-facing routes including creating tickets and initiating payments. The `is_verified` field is present in `authStore.js` but never read by any route guard.
- **Impact:** Unverified email accounts can create tickets and initiate payments. Orphaned/uncontactable ticket records.
- **Fix:** In `PrivateRoute`, add `&& user.is_verified` check. On backend login view, reject users with `is_verified=False`.

---

### H-002 — Activity Log Actor-Patching Is Race-Prone

- **Category:** Data Integrity / Concurrency
- **File:** `backend/support_app/services/ticket_service.py` lines 221–270; `backend/support_app/signals.py` lines 83–89
- **Description:** The activity log pattern: `pre_save` signal creates a `TicketActivityLog` with `actor=None`, then the service immediately calls `.update(actor=actor)` on the most-recent NULL-actor log entry for that ticket. This blind "patch latest entry" approach is not keyed to a specific log PK. If two concurrent status changes hit the same ticket, one actor patch can overwrite the log entry from the other — misattributing actions in the audit trail.
- **Impact:** Corrupted audit trail under load. Wrong actors attributed to status changes.
- **Fix:** Pass `actor` through the signal (thread-local or `update_fields`), or create `TicketActivityLog` directly in the service layer and suppress signal logging for those calls.

---

### H-003 — Ticket Assignment Race Condition

- **Category:** Concurrency
- **File:** `backend/support_app/services/ticket_service.py` lines 47–117
- **Description:** `assign_ticket()` checks `if ticket.assigned_to is not None: raise ...` then sets `ticket.assigned_to = freelancer`. No `select_for_update()` on the ticket row. Two concurrent admin requests can both pass the guard and assign the ticket to different freelancers, with last-write winning silently. The first freelancer is notified of an assignment that is immediately overwritten.
- **Impact:** Double-assignment under concurrent admin usage. First freelancer mislead.
- **Fix:** Wrap in `with transaction.atomic():` and add `ticket = Ticket.objects.select_for_update().get(pk=ticket.pk)` at the start.

---

### H-004 — Incomplete State Machine: Invalid Status Transitions Allowed

- **Category:** Business Logic
- **File:** `backend/support_app/services/ticket_service.py` lines 221–270
- **Description:** `update_status()` only blocks transitions _from_ `"closed"`. All other transitions are permitted, enabling:
  - `pending_payment` → `resolved` (bypasses payment entirely)
  - `pending_payment` → `in_progress` (bypasses assignment)
  - `assigned` → `closed` (bypasses resolution flow)

  The existing test only validates an invalid status string, not an invalid transition.
- **Impact:** Tickets can reach terminal states without completing required workflow steps. Revenue loss (resolution payment skipped).
- **Fix:** Implement an `ALLOWED_TRANSITIONS` dict and validate `(old_status, new_status)` pairs in `update_status()`.

---

### H-005 — Admin vs Ops Payment Confirm: Inconsistent Audit Trail

- **Category:** Consistency / Compliance
- **File:** `backend/support_app/views.py` lines ~960 (`admin_payment_confirm`), ~2419 (`ops_payment_confirm`)
- **Description:** `admin_payment_confirm` creates a `TicketActivityLog` entry and sends a `Notification` to the customer after confirming payment. `ops_payment_confirm` does neither — it confirms payment and updates status but produces no audit trail entry and no customer notification. A customer whose payment is confirmed by an Ops Manager receives no notification.
- **Impact:** Customers unaware their payment was confirmed. Incomplete audit trail for Ops confirmations.
- **Fix:** Extract the activity log + notification logic into a shared helper `_on_payment_confirmed(ticket, actor)` and call it from both views.

---

### H-006 — AuditLog Model Is Never Populated

- **Category:** Dead Feature / Compliance
- **File:** `backend/support_app/models.py` — `AuditLog` model
- **Description:** `AuditLog` has fields for `action`, `entity_type`, `entity_id`, `old_values`, `new_values`. A search across all views, services, signals, and tasks reveals **zero writes** to `AuditLog`. The model exists and migrations have been run, but no audit records are ever created. Notably, `user_id` is a raw `UUIDField` (not a ForeignKey), preventing Django ORM joins to user data.
- **Impact:** Admin compliance/audit trail is entirely empty. No record of role changes, payment operations, or user management actions.
- **Fix:** Either wire up writes to `AuditLog` in relevant service calls (role changes, payments, user mgmt) or drop the model and migration if intentionally replaced by `RoleChangeAudit` + `TicketActivityLog`.

---

### H-007 — EngineerTrustCard Displays Fabricated Statistics

- **Category:** Misleading UI / Customer Trust
- **File:** `frontend/src/components/tickets/TicketDetail.jsx` lines 256–343
- **Description:** The `EngineerTrustCard` shown to customers on ticket assignment always displays hardcoded values:
  ```javascript
  const TRUST = {
    yearsExp: 5, ticketsSolved: 142, rating: 4.8,
    responseTime: "< 30 min", status: "online",
  };
  ```
  Every engineer, regardless of their actual profile, always appears as 5 years of experience, 142 tickets solved, 4.8/5 rating, always "Online". This is materially false and misleading to customers making trust decisions about who is handling their IT infrastructure.
- **Impact:** False advertising. Customer trust broken on discovery. Potential legal exposure.
- **Fix:** Fetch real stats from a `GET /api/freelancer/{id}/public-profile/` endpoint. Show a skeleton while loading.

---

### H-008 — Old CSAT Endpoint Creates Dual Submission Path, Can Skip Resolution Payment

- **Category:** Business Logic / Revenue
- **File:** `backend/support_app/urls.py` line 58
- **Description:** The old `/api/tickets/<uuid>/csat/` endpoint still exists alongside the new `/accept-resolution/` and `/reject-resolution/` endpoints. A customer can POST directly to the old CSAT endpoint after a ticket moves to `resolved`, recording CSAT without going through the accept/reject resolution workflow. This means the resolution payment step is skipped and the freelancer gets no payout trigger.
- **Impact:** Revenue loss (resolution payment bypassed). Freelancer not paid. Billing records inconsistent.
- **Fix:** Remove the old `/csat/` URL route and view, or add a guard requiring `ticket.status == "closed"` (post-acceptance) before allowing CSAT submission.

---

## Medium Issues

### M-001 — Analytics View N+1 Query

- **Category:** Performance
- **File:** `backend/support_app/views.py` lines ~1800–1850
- **Description:** Analytics view iterates `Freelancer.objects.all()` accessing `freelancer.user.email` without `select_related("user")`. With 50 freelancers: 51 queries. With 500: 501 queries.
- **Fix:** `Freelancer.objects.all().select_related("user")`

---

### M-002 — SLA Breach Notification N+1 Query

- **Category:** Performance
- **File:** `backend/support_app/services/sla_service.py` lines 124–143
- **Description:** `_notify_admins_of_breach()` queries `User.objects.filter(role="admin")` inside the per-ticket loop. If 20 tickets breach simultaneously, fires 20 identical admin-list queries.
- **Fix:** Fetch admin list once before the loop in `run_sla_check_for_all_open_tickets()` and pass it in.

---

### M-003 — Redundant COUNT(*) Before Iterator in SLA Check

- **Category:** Performance
- **File:** `backend/support_app/services/sla_service.py` lines 146–177
- **Description:** `tickets.count()` fires a separate `SELECT COUNT(*)` query before `tickets.iterator()`, with the count only used in a log line. Two DB round-trips where one suffices.
- **Fix:** Remove the `.count()` call or compute count from iteration results.

---

### M-004 — Dashboard Profile Fetch Error Silently Swallowed

- **Category:** UX / Reliability
- **File:** `frontend/src/pages/Dashboard.jsx` lines ~45–55
- **Description:**
  ```javascript
  getProfile().then(({ data }) => setProfile(data)).catch(() => {})
  ```
  If `getProfile()` fails (403, network error), the catch does nothing. Dashboard renders with `profile = null`, potentially causing downstream `Cannot read properties of null` crashes in child components.
- **Fix:** Set error state in catch block and render a fallback UI, or at minimum `console.error` the failure.

---

### M-005 — finance_manager Cannot Be Promoted Directly to admin

- **Category:** Business Logic
- **File:** `backend/support_app/views.py` lines 2112–2119
- **Description:** `_ALLOWED_TRANSITIONS` maps `finance_manager` only to `["operations_manager"]`. A finance_manager who should become an admin requires a two-step role change with no documentation of why this constraint exists. Meanwhile, `operations_manager → admin` is a single step.
- **Fix:** Either document the intentional two-step path, or add `"admin"` to `finance_manager`'s allowed transitions.

---

### M-006 — Payout Idempotency Guard Race Condition

- **Category:** Concurrency
- **File:** `backend/support_app/services/payout_service.py` lines 44–84
- **Description:** `create_payout_for_ticket()` checks `Payout.objects.get(ticket=ticket)` before creating. Without `select_for_update()`, two concurrent calls both pass the guard and both attempt `Payout.objects.create()`. The `OneToOneField` constraint causes one to raise `IntegrityError`, surfacing as a 500 to the caller.
- **Fix:** Wrap in `transaction.atomic()` with `select_for_update()`, or use `get_or_create()`.

---

### M-007 — Stub Celery Tasks Registered but Never Implemented

- **Category:** Dead Code / Misleading
- **File:** `backend/support_app/tasks.py` lines 84–108
- **Description:** `process_payout_batch` (lines 84–96) and `sync_ticket_to_osticket` (lines 98–108) are registered Celery tasks containing only `pass`. They appear in Celery worker logs and Flower dashboards, creating the false impression of working batch processing and osTicket sync. No Beat schedule defined for either.
- **Fix:** Implement or remove. If removing, delete the task registrations.

---

### M-008 — No Minimum Length Validation on Ticket Description

- **Category:** Validation
- **File:** `backend/support_app/serializers.py` — `TicketCreateSerializer`
- **Description:** `description` is `TextField(blank=True, default="")` on the model. A ticket with an empty description is operationally useless for support engineers. No minimum length is enforced at the serializer level. The existing test creates a ticket with no description field.
- **Fix:** Add `MinLengthValidator(20)` on `description` in `TicketCreateSerializer` with a clear error message.

---

### M-009 — PrivateRoute Does Not Check is_verified (frontend complement of H-001)

- **Category:** Security
- **File:** `frontend/src/App.jsx`
- **Description:** Subset of H-001. Without the `is_verified` check, even non-malicious unverified users who receive a resend-verification email while still logged in can reach protected pages, creating orphaned records.
- **Fix:** See H-001 fix.

---

## Low Issues

### L-001 — Notification Polling Never Backs Off on Error

- **Category:** Reliability
- **File:** `frontend/src/hooks/useNotifications.js`
- **Description:** Polls `/notifications/unread-count/` every 30 seconds regardless of error state. If the backend returns 5xx, the frontend continues firing at full rate, amplifying load on a struggling server.
- **Fix:** Implement exponential backoff on consecutive failures (30s → 60s → 120s → cap 300s), resetting on success.

---

### L-002 — Dashboard Makes Two API Calls That Could Be One

- **Category:** Performance
- **File:** `frontend/src/pages/Dashboard.jsx` lines ~40–60
- **Description:** `getAnalytics()` and `getProfile()` fire as separate requests on mount. Each round-trip adds 50–100ms latency on Indian mobile connections.
- **Fix:** Combine into a single `/api/dashboard/` endpoint, or confirm both fire simultaneously via `Promise.all`.

---

### L-003 — `is_engineer()` Permission Function Is Unused

- **Category:** Dead Code
- **File:** `backend/support_app/permissions.py` lines 23–25
- **Description:** `is_engineer()` is defined but never referenced in any view, permission class, or test. Confuses future developers.
- **Fix:** Remove the function.

---

### L-004 — `IsOwnerOrAdmin` Imported but Never Applied

- **Category:** Dead Code
- **File:** `backend/support_app/permissions.py` lines 205–218; `backend/support_app/views.py` import block
- **Description:** `IsOwnerOrAdmin` is defined and imported but never set as `permission_classes` on any view.
- **Fix:** Remove the import and class, or apply it to appropriate views.

---

### L-005 — DEFAULT_FROM_EMAIL Placeholder Causes All Emails to Fail

- **Category:** Configuration
- **File:** `backend/supportmitra/settings.py` line 286
- **Description:** If left as the Django default (`webmaster@localhost`) in production, all outbound emails (password reset, ticket notifications) will come from an undeliverable address and be rejected or flagged as spam.
- **Fix:** Require `DEFAULT_FROM_EMAIL` from environment variable with a startup check.

---

### L-006 — `is_internal_staff()` Inconsistency with AdminRoute

- **Category:** Consistency
- **File:** `backend/support_app/permissions.py` lines 64–70
- **Description:** `is_internal_staff()` returns `True` for users with `role in ["admin", ...]` without checking `is_staff=True`. The `IsAdminUser` class requires both. A user with `role="admin"` but `is_staff=False` (misconfigured) passes `is_internal_staff()` but fails `IsAdminUser`, creating inconsistent access.
- **Fix:** Align — either always check both fields for admin role, or document the intentional split.

---

### L-007 — Subscription Model Has No API Surface

- **Category:** Dead Code
- **File:** `backend/support_app/models.py` — `Subscription` model; `backend/support_app/urls.py`
- **Description:** The `Subscription` model (plan, start_date, end_date, is_active) has no URL routes, views, serializers, or frontend components. It is created in migrations but never read from or written to in application code.
- **Fix:** Implement the subscription feature or remove the model and migration to reduce schema clutter.

---

## Dead Code Inventory

| # | Type | Location | Description |
|---|------|----------|-------------|
| D-001 | Unused model | `models.py` — `AuditLog` | Model defined, migrated, zero writes anywhere. `user_id` is raw UUIDField (not FK). |
| D-002 | Unused model | `models.py` — `Subscription` | No views, serializers, or URL routes reference it. |
| D-003 | Unused function | `permissions.py` lines 23–25 | `is_engineer()` defined but never called. |
| D-004 | Unused class + import | `permissions.py` lines 205–218, `views.py` import | `IsOwnerOrAdmin` imported but never applied to any view. |
| D-005 | Stub Celery task | `tasks.py` lines 84–96 | `process_payout_batch` — body is `pass`, no Beat schedule. |
| D-006 | Stub Celery task | `tasks.py` lines 98–108 | `sync_ticket_to_osticket` — body is `pass`, no Beat schedule. |
| D-007 | Orphaned endpoint | `urls.py` line 58 | Old `/api/tickets/<uuid>/csat/` superseded by accept/reject resolution workflow but not removed. |
| D-008 | Unscheduled task | `tasks.py` + `settings.py` | `check_sla_breaches` task defined but `CELERY_BEAT_SCHEDULE` absent from `settings.py` — never auto-runs. |

---

## Performance Issues

| # | File | Lines | Description |
|---|------|-------|-------------|
| P-001 | `views.py` | ~1800–1850 | N+1: iterates `Freelancer.objects.all()` accessing `.user` without `select_related`. 1 + N queries per analytics load. |
| P-002 | `sla_service.py` | 124–143 | N+1 in `_notify_admins_of_breach`: admin list queried once per breaching ticket. |
| P-003 | `sla_service.py` | 146–177 | Redundant `SELECT COUNT(*)` before `.iterator()` — two DB round-trips where one suffices. |
| P-004 | `Dashboard.jsx` | ~40–60 | Two separate API calls on every dashboard mount that could be parallelized or combined. |
| P-005 | `useNotifications.js` | polling logic | 30-second polling with no error backoff amplifies load during backend degradation. |

---

## Documentation Issues

| # | File | Lines | Description |
|---|------|-------|-------------|
| DOC-001 | `invoice_pdf.py` | 100 | Hardcoded placeholder GSTIN `22AAAAA0000A1Z5` has no warning comment. No indication this is a test value. |
| DOC-002 | `tasks.py` | 84–108 | Stub tasks have no TODO comments, issue tracker links, or indication of intended implementation. |
| DOC-003 | `settings.py` | 286 | `DEFAULT_FROM_EMAIL` placeholder acknowledged but no guidance on required format or email service. |
| DOC-004 | `ticket_service.py` | 221–270 | `update_status()` has no comment on which transitions are valid; missing validation appears intentional but is undocumented. |

---

## Summary Table

| ID | Severity | Category | File | Title |
|----|----------|----------|------|-------|
| C-001 | Critical | Financial/Data Integrity | `payment_service.py:324–424` | ~~Non-atomic resolution payment — partial commit risk~~ **FIXED 2026-06-25** |
| C-002 | Critical | Security | `views.py:~717`, `payment_service.py:~40` | ~~Sandbox defaults bypass payment signature verification~~ **FIXED 2026-06-25** |
| C-003 | Critical | Feature Broken | `sla_service.py:55`, `settings.py` | SLA due_at never set; entire SLA system non-functional |
| C-004 | Critical | Legal/Compliance | `invoice_pdf.py:100,307` | Fraudulent GSTIN placeholder on all customer invoices |
| C-005 | Critical | Data Integrity | `payment_service.py:33–47` | Race condition in non-atomic invoice number generation |
| H-001 | High | Security | `App.jsx:PrivateRoute` | Unverified users can access all private routes |
| H-002 | High | Data Integrity | `ticket_service.py:221`, `signals.py:83` | Activity log actor-patching is race-prone |
| H-003 | High | Concurrency | `ticket_service.py:47–117` | Ticket assignment race condition without select_for_update |
| H-004 | High | Business Logic | `ticket_service.py:221–270` | Incomplete state machine — invalid status transitions allowed |
| H-005 | High | Consistency | `views.py:~960,~2419` | Ops payment confirm has no audit trail or customer notification |
| H-006 | High | Dead Feature | `models.py:AuditLog` | AuditLog model never populated anywhere |
| H-007 | High | Misleading UI | `TicketDetail.jsx:256–343` | EngineerTrustCard shows entirely fabricated statistics |
| H-008 | High | Business Logic | `urls.py:58` | Old CSAT endpoint allows resolution payment bypass |
| M-001 | Medium | Performance | `views.py:~1800` | Analytics view N+1 on freelancer.user |
| M-002 | Medium | Performance | `sla_service.py:124–143` | SLA breach N+1: admin query per breaching ticket |
| M-003 | Medium | Performance | `sla_service.py:146–177` | Redundant COUNT(*) before iterator in SLA check |
| M-004 | Medium | UX/Reliability | `Dashboard.jsx:~45` | Profile fetch error silently swallowed → null crash |
| M-005 | Medium | Business Logic | `views.py:2112–2119` | finance_manager cannot be promoted directly to admin |
| M-006 | Medium | Concurrency | `payout_service.py:44–84` | Payout idempotency guard race condition |
| M-007 | Medium | Dead Code | `tasks.py:84–108` | Stub Celery tasks registered with no implementation |
| M-008 | Medium | Validation | `serializers.py:TicketCreateSerializer` | No minimum length on ticket description |
| M-009 | Medium | Security | `App.jsx:PrivateRoute` | PrivateRoute does not check is_verified (see H-001) |
| L-001 | Low | Reliability | `useNotifications.js` | No exponential backoff on notification polling errors |
| L-002 | Low | Performance | `Dashboard.jsx:~40` | Two API calls on dashboard mount that could be one |
| L-003 | Low | Dead Code | `permissions.py:23–25` | `is_engineer()` defined but never used |
| L-004 | Low | Dead Code | `permissions.py:205–218` | `IsOwnerOrAdmin` imported and defined but never applied |
| L-005 | Low | Config | `settings.py:286` | DEFAULT_FROM_EMAIL placeholder — emails sent from invalid address |
| L-006 | Low | Consistency | `permissions.py:64–70` | `is_internal_staff()` checks admin role without is_staff |
| L-007 | Low | Dead Code | `models.py:Subscription` | Subscription model has no API surface |

---

## Recommended Fix Priority Order

1. ~~**C-002** — Sandbox payment bypass~~ **FIXED 2026-06-25**
2. ~~**C-001** — Non-atomic payment flow~~ **FIXED 2026-06-25**
3. **C-004** — Fake GSTIN on invoices (legal — CGST Act violation)
4. **C-005** — Invoice number race condition (data integrity under concurrent load)
5. **C-003** — SLA system never starts
6. **H-001 / M-009** — Unverified user access (security)
6. **C-003** — SLA system never starts (feature correctness — contractual obligation)
7. **H-008** — Old CSAT endpoint bypasses resolution payment (revenue)
8. **H-007** — Fabricated engineer stats shown to customers (trust / false advertising)
9. **H-003** — Ticket assignment race (correctness under concurrent ops)
10. **H-004** — Invalid status transitions allowed (workflow correctness)
11. **H-002** — Activity log actor patching race (audit trail integrity)
12. **H-005** — Ops payment confirm missing audit/notification
13. **H-006** — AuditLog model never populated
14. **M-006** — Payout idempotency race
15. **Remaining Medium/Low** — address before sustained production load

---

*Generated by Claude Sonnet 4.6 on 2026-06-25. Do not make changes based on this report without first verifying findings against current code state.*
