# Pay-Per-Ticket Architecture

**Status:** AWAITING APPROVAL — Do not implement until approved.
**Author:** Lead Architect
**Date:** 2026-06-24
**Scope:** ResolveHQ managed IT services marketplace upgrade

---

## 1. Audit Findings — Current State

### 1.1 Models (backend/support_app/models.py)

| Model | Purpose | Notes |
|---|---|---|
| `CustomUser` | Auth; roles: customer, freelancer, admin, operations_manager, finance_manager, support_agent | Solid. No changes needed. |
| `Customer` | Customer profile (company, phone, plan, gstin) | Solid. No changes needed. |
| `Freelancer` | Engineer profile (skills, rating, payout_mode, payout_details) | Has `payout_details` JSONField — needed for payouts. |
| `Ticket` | Core entity; 7 status states | **Major change needed** — 4 statuses to rename, 4 new statuses to add. |
| `TicketComment` | Threaded comments (internal/public) | Preserve. No changes. |
| `TicketAttachment` | File attachments | Preserve. No changes. |
| `TicketActivityLog` | Immutable event audit trail | Needs new action types: `quote_created`, `quote_approved`, `quote_declined`, `resolution_paid`. |
| `TicketAssignment` | Full assignment history | Preserve. No changes. |
| `Payment` | Payments (consulting_fee, resolution_fee, subscription, refund) | Needs `quote` FK for resolution payments. Both types already exist as `payment_type` choices. |
| `Subscription` | Monthly/annual plans | Not in scope. Preserve. |
| `SLAPolicy` / `SLALog` | SLA tracking | Preserve. No changes. |
| `CSATSurvey` | Customer satisfaction (1–5) | Preserve — used for final rating step. |
| `Notification` | In-app notifications | Needs 3 new category choices. |
| `AuditLog` / `RoleChangeAudit` | Compliance audit trails | Preserve. No changes. |
| `Service` | Service catalogue | Preserve. No changes. |

**Missing models (to be created):**
- `Quote` — engineer's diagnosis + resolution fee proposal
- `Payout` — engineer revenue split record

### 1.2 Current Ticket State Machine

```
pending_payment → open → assigned → in_progress → waiting_customer → resolved → closed
```

This is a 7-state linear flow. The new business model requires **11 states** with branching.

### 1.3 Current Payment Flow

1. Customer creates ticket → `pending_payment`
2. `POST /api/tickets/{id}/initiate-payment/` → Razorpay order for ₹299 consulting fee
3. `POST /api/tickets/{id}/verify-payment/` → payment confirmed → ticket moves to `open`
4. Ops assigns engineer → `assigned`
5. Engineer works → `in_progress` / `waiting_customer` / `resolved`
6. Customer accepts → CSAT → `closed`

**Gap:** No resolution fee, no quote, no engineer payout.

### 1.4 Services Layer

| Service | Status |
|---|---|
| `payment_service.py` | Full Razorpay integration + sandbox mock. Solid. |
| `ticket_service.py` | `create_ticket`, `assign_ticket`, `unassign_ticket`, `add_comment`, `update_status`. Solid. |
| `notification_service.py` | In-app notification creation. Solid. |
| `email_service.py` | Transactional emails. Solid. |
| `payout_service.py` | **STUB — 3 functions, all `raise NotImplementedError`.** Must be implemented. |
| `sla_service.py` | SLA breach detection. Preserve. |

### 1.5 API Surface (URLs)

157 URL patterns. Notable gaps:
- No quote endpoints
- No resolution payment endpoints (beyond consulting fee)
- No finance manager revenue/payout endpoints
- No engineer earnings endpoint

### 1.6 Pre-Existing Bugs Found During Audit

These exist in the current codebase and are outside the scope of this feature, but should be noted:

| Bug | Location | Description |
|---|---|---|
| `Sum("total_amount")` on non-existent field | `views.py:1374` | `Payment` has no `total_amount` column — use `Sum(F("amount") + F("gst_amount"))` |
| `models.ExpressionWrapper` / `models.F` / `models.DurationField` | `views.py:2406–2414` | `models` is not imported as the `django.db.models` module in `ops_analytics`. Would raise `NameError`. |

---

## 2. Gap Analysis

| Requirement | Current State | Gap |
|---|---|---|
| 11-state ticket lifecycle | 7 states | 4 new + 4 renamed |
| Engineer creates Quote | Not present | `Quote` model + API + UI |
| Ops reviews/approves Quote | Not present | API + UI |
| Customer accepts/declines Quote | Not present | API + UI |
| Resolution fee payment | Not present | Razorpay order + verify flow |
| Engineer payout split (65/35) | Stub only | `Payout` model + `payout_service.py` |
| Finance Manager dashboard | Not present | New page + API |
| GST tracking per payment type | Partial (gst_amount on Payment) | Add GST to Payout, add finance summary |
| Engineer earnings view | Not present | New API + UI |

---

## 3. Proposed Data Model Changes

### 3.1 Ticket.STATUS_CHOICES — Full Replacement

The new status machine uses different internal keys. Existing tickets in the old states must be migrated.

**New STATUS_CHOICES:**

```python
STATUS_CHOICES = [
    # ── Pre-payment ─────────────────────────────────────
    ("open",                       "Open"),                        # ticket created, consulting fee NOT yet paid
    # ── Paid, awaiting assignment ────────────────────────
    ("consulting_paid",            "Consulting Fee Paid"),         # was "open"
    # ── Assignment & diagnosis ───────────────────────────
    ("assigned",                   "Assigned"),                    # engineer assigned (unchanged)
    ("diagnosis_in_progress",      "Diagnosis in Progress"),       # was "in_progress"
    # ── Quote lifecycle ──────────────────────────────────
    ("quote_pending",              "Quote Pending Customer"),       # quote sent, awaiting customer decision
    ("awaiting_resolution_payment","Awaiting Resolution Payment"), # customer approved, awaiting payment
    # ── Active work ──────────────────────────────────────
    ("work_in_progress",           "Work in Progress"),            # resolution fee paid, engineer implementing
    ("waiting_for_customer",       "Waiting for Customer"),        # was "waiting_customer"
    # ── Completion ───────────────────────────────────────
    ("resolved",                   "Resolved"),                    # unchanged
    ("closed",                     "Closed"),                      # unchanged
    # ── Terminal decline ─────────────────────────────────
    ("quote_declined",             "Quote Declined"),              # NEW: customer declined quote
]
```

**Migration mapping for existing tickets:**

| Old Status | New Status | Rationale |
|---|---|---|
| `pending_payment` | `open` | Ticket created, fee not paid = "open" |
| `open` | `consulting_paid` | Fee was paid, ticket was in ops queue |
| `assigned` | `assigned` | No change |
| `in_progress` | `work_in_progress` | Already actively being worked (assume quote/payment done) |
| `waiting_customer` | `waiting_for_customer` | Rename only |
| `resolved` | `resolved` | No change |
| `closed` | `closed` | No change |

### 3.2 New Model: Quote

```python
class Quote(models.Model):
    STATUS_CHOICES = [
        ("draft",              "Draft"),                 # engineer drafting
        ("pending_ops_review", "Pending Ops Review"),   # submitted, awaiting ops approval
        ("approved_by_ops",    "Approved by Ops"),      # ops approved, sent to customer
        ("accepted",           "Accepted by Customer"), # customer accepted
        ("declined",           "Declined by Customer"), # customer declined
        ("expired",            "Expired"),              # no response after N days
    ]

    id              = UUIDField(primary_key=True, default=uuid4, editable=False)
    ticket          = ForeignKey(Ticket, on_delete=CASCADE, related_name="quotes")
    engineer        = ForeignKey(Freelancer, on_delete=PROTECT, related_name="quotes")
    diagnosis       = TextField()
    scope_of_work   = TextField()
    resolution_fee  = DecimalField(max_digits=10, decimal_places=2)  # pre-GST
    gst_amount      = DecimalField(max_digits=10, decimal_places=2)  # 18% of resolution_fee
    total_amount    = DecimalField(max_digits=10, decimal_places=2)  # resolution_fee + gst_amount
    status          = CharField(max_length=32, choices=STATUS_CHOICES, default="draft")
    ops_note        = TextField(blank=True)          # ops approval/rejection note
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    approved_at     = DateTimeField(null=True, blank=True)   # when ops approved
    sent_at         = DateTimeField(null=True, blank=True)   # when sent to customer
    accepted_at     = DateTimeField(null=True, blank=True)   # when customer accepted
    declined_at     = DateTimeField(null=True, blank=True)   # when customer declined
```

**Constraint:** Only one active (non-declined, non-expired) quote per ticket at a time.

### 3.3 New Model: Payout

```python
class Payout(models.Model):
    STATUS_CHOICES = [
        ("pending",  "Pending"),   # created after ticket closes, awaiting finance review
        ("approved", "Approved"),  # finance manager approved for payment
        ("paid",     "Paid"),      # bank transfer / UPI completed
        ("failed",   "Failed"),    # transfer attempt failed
    ]

    id                  = UUIDField(primary_key=True, default=uuid4, editable=False)
    ticket              = ForeignKey(Ticket, on_delete=PROTECT, related_name="payouts")
    engineer            = ForeignKey(Freelancer, on_delete=PROTECT, related_name="payouts")
    quote               = ForeignKey(Quote, on_delete=PROTECT, related_name="payouts")
    resolution_fee      = DecimalField(max_digits=10, decimal_places=2)  # pre-GST resolution fee
    engineer_percentage = DecimalField(max_digits=5, decimal_places=2, default=Decimal("65.00"))
    engineer_amount     = DecimalField(max_digits=10, decimal_places=2)  # resolution_fee × 0.65
    platform_amount     = DecimalField(max_digits=10, decimal_places=2)  # resolution_fee × 0.35
    gst_collected       = DecimalField(max_digits=10, decimal_places=2, default=0)  # GST on resolution fee
    gateway_fee         = DecimalField(max_digits=10, decimal_places=2, default=0)  # Razorpay ~2%
    status              = CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    paid_at             = DateTimeField(null=True, blank=True)
    utr_reference       = CharField(max_length=64, blank=True)   # bank transfer UTR
    notes               = TextField(blank=True)
    created_at          = DateTimeField(auto_now_add=True)
    updated_at          = DateTimeField(auto_now=True)
```

### 3.4 Modified Model: Payment

Add optional `quote` FK for resolution payments:

```python
quote = ForeignKey("Quote", on_delete=SET_NULL, null=True, blank=True, related_name="payments")
```

Also add `CONSULTING_PAID` tracker to the `Ticket` model:

```python
consulting_paid_at = DateTimeField(null=True, blank=True)  # when consulting fee was paid
```

### 3.5 Modified Model: TicketActivityLog

Add new action choices:

```python
("quote_created",       "Quote Created"),
("quote_approved",      "Quote Approved by Ops"),
("quote_declined",      "Quote Declined"),
("customer_accepted",   "Customer Accepted Quote"),
("customer_declined",   "Customer Declined Quote"),
("resolution_paid",     "Resolution Fee Paid"),
```

### 3.6 Modified Model: Notification

Add new category choices:

```python
("quote_received",         "Quote Received"),
("quote_approved",         "Quote Approved"),
("resolution_payment_due", "Resolution Payment Due"),
("payout_processed",       "Payout Processed"),
```

---

## 4. New Ticket State Machine

```
                        ┌────────────────────────────────────────┐
                        │                                        │
Customer creates ticket │                                        │
                        ▼                                        │
                      OPEN ──── consulting fee paid ──► CONSULTING_PAID
                                                              │
                                               Ops assigns engineer
                                                              │
                                                              ▼
                                                         ASSIGNED
                                                              │
                                                 Engineer begins investigation
                                                              │
                                                              ▼
                                                DIAGNOSIS_IN_PROGRESS
                                                              │
                                               Engineer submits quote
                                                              │
                                            Ops reviews & approves quote
                                                              │
                                                              ▼
                                                      QUOTE_PENDING ─── customer declines ──► QUOTE_DECLINED
                                                              │
                                                  customer approves
                                                              │
                                                              ▼
                                               AWAITING_RESOLUTION_PAYMENT
                                                              │
                                               resolution fee paid
                                                              │
                                                              ▼
                                                    WORK_IN_PROGRESS ◄─────────────────────┐
                                                              │                            │
                                             engineer needs more info                      │
                                                              │                            │
                                                              ▼                            │
                                                  WAITING_FOR_CUSTOMER ─── info provided ──┘
                                                              │
                                               engineer marks resolved
                                                              │
                                                              ▼
                                                         RESOLVED
                                                         /       \
                                              customer          customer
                                              accepts            rejects
                                                 │                  │
                                                 ▼                  ▼
                                              CLOSED          WORK_IN_PROGRESS
                                                 │
                                    Payout created (pending)
                                    Finance approves & pays
```

### 4.1 Allowed Transitions by Role

| Actor | From | To |
|---|---|---|
| Customer | `open` | `consulting_paid` (via payment) |
| Ops Manager | `consulting_paid` | `assigned` |
| Engineer | `assigned` | `diagnosis_in_progress` |
| Engineer | `diagnosis_in_progress` | `quote_pending` (via quote creation) |
| Ops Manager | `quote_pending` | `quote_pending` (approve/reject quote internally) |
| System | `quote_pending` (approved) | `quote_pending` (sends to customer) |
| Customer | `quote_pending` | `awaiting_resolution_payment` (accept) |
| Customer | `quote_pending` | `quote_declined` (decline) |
| System | `awaiting_resolution_payment` | `work_in_progress` (after payment) |
| Engineer | `work_in_progress` | `waiting_for_customer` |
| Engineer | `waiting_for_customer` | `work_in_progress` |
| Engineer | `work_in_progress` | `resolved` |
| Customer | `resolved` | `closed` (accept) |
| Customer | `resolved` | `work_in_progress` (reject) |
| System | `closed` | (creates Payout record) |

---

## 5. Financial Model

### 5.1 Fee Structure

```
Consulting Fee:   ₹299   + 18% GST = ₹352.82  (rounded to ₹353)
Resolution Fee:   Variable            + 18% GST
```

**Note:** GST rate is configurable via `settings.GST_RATE` (currently 0.18).

The existing `CONSULTING_FEE = 299` constant in `payment_service.py` is correct.
Resolution fees are engineer-set (free-market quote) rather than the hardcoded RESOLUTION_FEES dict.

### 5.2 Revenue Split

```
Resolution Fee (pre-GST): ₹X

  Engineer receives:  X × 0.65   (65%)
  ResolveHQ receives: X × 0.35   (35%)

GST on resolution fee: goes to government (not split)

Consulting Fee: 100% to ResolveHQ (non-refundable)
```

**Example:**

```
Consulting Fee:       ₹299
GST on consulting:    ₹ 53.82  → ₹54
Customer pays:        ₹353

Resolution Fee:       ₹800
GST on resolution:    ₹144
Customer pays:        ₹944

Engineer payout:      ₹520  (₹800 × 0.65)
ResolveHQ margin:     ₹280  (₹800 × 0.35)
GST collected:        ₹198  (₹54 + ₹144) — government liability
Gateway fees:         ~₹23  (~2% of ₹1,297 total collected)

Total ResolveHQ cash after engineer payout:
  ₹299 + ₹280 − gateway_fees = ₹579 − ~₹23 = ~₹556 net
```

### 5.3 Payout Calculation (in payout_service.py)

```python
ENGINEER_SHARE = Decimal("0.65")
PLATFORM_SHARE = Decimal("0.35")
GST_RATE = Decimal("0.18")

def calculate_payout(resolution_fee: Decimal) -> dict:
    engineer_amount = (resolution_fee * ENGINEER_SHARE).quantize(Decimal("0.01"))
    platform_amount = (resolution_fee * PLATFORM_SHARE).quantize(Decimal("0.01"))
    gst_collected = (resolution_fee * GST_RATE).quantize(Decimal("0.01"))
    return {
        "engineer_amount": engineer_amount,
        "platform_amount": platform_amount,
        "gst_collected":   gst_collected,
    }
```

---

## 6. New API Surface

### 6.1 Engineer (Freelancer) Endpoints

| Method | URL | Description |
|---|---|---|
| `POST` | `/api/freelancer/tickets/{id}/quote/` | Engineer submits quote for assigned ticket |
| `GET` | `/api/freelancer/tickets/{id}/quote/` | Get current quote for a ticket |
| `GET` | `/api/freelancer/earnings/` | Engineer's earnings summary (pending + paid payouts) |

### 6.2 Customer Endpoints (new)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/tickets/{id}/quote/` | Customer views the quote |
| `POST` | `/api/tickets/{id}/quote/accept/` | Customer accepts quote |
| `POST` | `/api/tickets/{id}/quote/decline/` | Customer declines quote |
| `POST` | `/api/tickets/{id}/initiate-resolution-payment/` | Create Razorpay order for resolution fee |
| `POST` | `/api/tickets/{id}/verify-resolution-payment/` | Verify & complete resolution payment |

### 6.3 Operations Manager Endpoints (new)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/ops/quotes/` | List quotes pending ops review |
| `POST` | `/api/ops/quotes/{id}/approve/` | Ops approves quote (sends to customer) |
| `POST` | `/api/ops/quotes/{id}/reject/` | Ops rejects quote (sends back to engineer) |

### 6.4 Finance Manager Endpoints (new)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/finance/dashboard/` | Revenue totals (consulting, resolution, GST, margin) |
| `GET` | `/api/finance/payouts/` | List all payouts with status filter |
| `POST` | `/api/finance/payouts/{id}/mark-paid/` | Mark payout as paid (with UTR reference) |
| `GET` | `/api/finance/revenue/` | Monthly revenue breakdown by type |

### 6.5 Existing Endpoints to Modify

| Endpoint | Change |
|---|---|
| `POST /api/tickets/{id}/verify-payment/` | After confirmation, transition to `consulting_paid` instead of `open` |
| `POST /api/ops/payments/{id}/confirm/` | After manual confirm, transition to `consulting_paid` |
| `POST /api/freelancer/tickets/{id}/status/` | Allow `diagnosis_in_progress`, `work_in_progress`, `waiting_for_customer`, `resolved` |
| `GET /api/analytics/` | Add `consulting_paid`, `diagnosis_in_progress`, `quote_pending`, `awaiting_resolution_payment`, `work_in_progress`, `waiting_for_customer` status counts |
| `GET /api/ops/dashboard/` | Add `quote_pending` count, `awaiting_resolution_payment` count |

---

## 7. Frontend Design

### 7.1 New Pages

| Page | Path | Role | Description |
|---|---|---|---|
| Finance Dashboard | `/operations/finance` | Finance Manager | Revenue, payouts, GST summary |
| Finance Payouts | `/operations/finance/payouts` | Finance Manager | Payout list + mark-paid action |

### 7.2 New Components

| Component | Purpose |
|---|---|
| `components/tickets/QuoteSection.jsx` | Renders quote details based on ticket status and user role |
| `components/tickets/QuoteCreateForm.jsx` | Engineer's form to submit diagnosis + resolution_fee |
| `components/tickets/QuoteReviewPanel.jsx` | Ops Manager's approve/reject controls |
| `components/tickets/ResolutionPaymentGateway.jsx` | Customer-facing resolution fee payment modal |
| `components/finance/RevenueCard.jsx` | Single metric card for Finance Dashboard |
| `components/finance/PayoutTable.jsx` | Paginated payout list with mark-paid action |

### 7.3 Existing Pages to Modify

| Page | Change |
|---|---|
| `Dashboard.jsx` (Customer) | Show consulting fee paid badge, quote pending banner, resolution fee due alert |
| `TicketDetailPage.jsx` | Inject `QuoteSection` based on `ticket.status` |
| `TicketDetail.jsx` (component) | Add quote-aware status labels |
| `FreelancerDashboard.jsx` | Add "My Quotes" panel, earnings summary |
| `OpsTicketQueue.jsx` | Add `quote_pending` filter, quote status column |
| `OpsDashboard.jsx` | Add quote metrics cards |
| `Sidebar.jsx` | Add Finance nav section for `finance_manager` role |
| `App.jsx` | Register new `/operations/finance` routes |

### 7.4 API Client Files to Modify

| File | Change |
|---|---|
| `api/tickets.js` | Add `getQuote`, `acceptQuote`, `declineQuote`, `initiateResolutionPayment`, `verifyResolutionPayment` |
| `api/ops.js` | Add `getQuotes`, `approveQuote`, `rejectQuote` |
| `api/payments.js` | Add finance endpoints: `getFinanceDashboard`, `getPayouts`, `markPayoutPaid` |

---

## 8. Migration Strategy

### 8.1 New Migrations Required

| Migration | Content |
|---|---|
| `0014_pay_per_ticket_models.py` | Add `Quote` model, `Payout` model; update `Ticket.STATUS_CHOICES`; add `Payment.quote` FK; add `Ticket.consulting_paid_at`; add `TicketActivityLog` action choices; add `Notification` category choices |
| `0015_pay_per_ticket_data_migration.py` | Data migration: remap existing ticket statuses to new values |

### 8.2 Data Migration Logic

```python
STATUS_MAP = {
    "pending_payment": "open",
    "open":            "consulting_paid",
    "in_progress":     "work_in_progress",
    "waiting_customer":"waiting_for_customer",
    # assigned, resolved, closed → unchanged
}
for old_status, new_status in STATUS_MAP.items():
    Ticket.objects.filter(status=old_status).update(status=new_status)
```

The `assigned`, `resolved`, and `closed` statuses are unchanged and need no data update.

### 8.3 Backward Compatibility

- All existing API serializers that validate `new_status` must be updated to include the new status values.
- The `AdminStatusSerializer` and `FreelancerStatusSerializer` choice lists must be updated.
- The `FREELANCER_STATUSES` list in `serializers.py` must include: `diagnosis_in_progress`, `work_in_progress`, `waiting_for_customer`, `resolved`.
- Existing tests will need updates for status value references.

---

## 9. RBAC Summary (Role-Based Access Control)

| Action | Customer | Engineer | Ops Manager | Finance Manager | Super Admin |
|---|---|---|---|---|---|
| Create ticket | ✓ | — | — | — | ✓ |
| Pay consulting fee | ✓ | — | — | — | ✓ |
| View ticket | ✓ (own) | ✓ (assigned) | ✓ (all) | ✓ (all) | ✓ |
| Assign engineer | — | — | ✓ | — | ✓ |
| Start diagnosis | — | ✓ | — | — | ✓ |
| Create quote | — | ✓ | — | — | ✓ |
| Approve quote (ops) | — | — | ✓ | — | ✓ |
| Accept/decline quote | ✓ | — | — | — | ✓ |
| Pay resolution fee | ✓ | — | — | — | ✓ |
| Mark resolved | — | ✓ | — | — | ✓ |
| Accept/reject resolution | ✓ | — | — | — | ✓ |
| Rate engineer (CSAT) | ✓ | — | — | — | ✓ |
| View revenue | — | — | ✓ (read) | ✓ | ✓ |
| Approve/mark payout | — | — | — | ✓ | ✓ |
| View own earnings | — | ✓ | — | — | — |

---

## 10. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Data migration breaks existing tickets | HIGH | Dry-run migration on dev DB first; include rollback migration |
| Status string changes break frontend status guards | HIGH | Audit every `ticket.status === "open"` etc. in frontend; update all simultaneously |
| FreelancerStatusSerializer accepts old status values | MEDIUM | Update `_FREELANCER_STATUSES` list; add integration test |
| Payout created twice for same ticket | MEDIUM | Add `unique_together = [["ticket", "engineer"]]` on `Payout` for active payouts |
| Quote created while ticket not in `diagnosis_in_progress` | MEDIUM | Guard in service layer: validate ticket status before creating quote |
| Resolution payment before quote accepted | HIGH | Guard: resolution payment endpoint checks `ticket.status == "awaiting_resolution_payment"` |
| Existing tests reference old status strings | MEDIUM | Update `test_api_phase4.py` and `test_ticket_system.py` |
| Finance Manager has no nav item | LOW | Sidebar.jsx update is part of Phase 4 |
| Analytics total_amount bug causes 500 on analytics page | LOW (pre-existing) | Fix in Phase 3 when updating analytics |

---

## 11. What Is NOT Changing

The following are explicitly preserved:

- Authentication system (JWT + allauth)
- Comment system (`TicketComment` model + views)
- Attachment system (`TicketAttachment` model + views)
- CSAT ratings system (`CSATSurvey` + `accept_resolution` / `reject_resolution`)
- SLA tracking (`SLAPolicy`, `SLALog`, `sla_service.py`)
- Notification delivery system (`notification_service.py`)
- Email service (`email_service.py`)
- Role management (role change audit, RBAC permission classes)
- User management (deactivate/reactivate, onboarding)
- Admin panel access
- Razorpay integration for consulting fee (existing flow preserved)

---

## 12. Implementation Phases (Summary)

| Phase | Scope | Risk |
|---|---|---|
| 1 | Database: migrations, Quote model, Payout model, Ticket status update | HIGH (run migration carefully) |
| 2 | Backend services: payout_service, ticket_service extensions, payment_service resolution flow | MEDIUM |
| 3 | Backend API: new serializers, new views, URL wiring, existing view updates | MEDIUM |
| 4 | Frontend: new components, updated pages, routing, API client | LOW |

Full incremental plan is in `PAY_PER_TICKET_IMPLEMENTATION_PLAN.md`.
UAT test cases are in `PAY_PER_TICKET_UAT.md`.
