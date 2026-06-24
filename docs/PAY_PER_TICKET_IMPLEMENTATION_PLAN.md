# Pay-Per-Ticket Implementation Plan

**Status:** AWAITING APPROVAL — Do not implement until approved.
**Prerequisite:** `PAY_PER_TICKET_ARCHITECTURE.md` approved.
**Total estimated steps:** 4 phases, ~35 discrete tasks.

---

## Guiding Principles

1. **Incremental delivery.** Each phase is independently deployable.
2. **Never break existing workflows.** The consulting-fee payment flow is preserved.
3. **Migrations are reversible.** Every schema migration must have a `reverse_sql` or `reverse` method.
4. **No orphaned state.** Every ticket must have a valid status at all times.
5. **Service layer owns business logic.** Views stay thin.

---

## Phase 1 — Database Layer

**Goal:** Add the new models and migrate the existing ticket status values.
**Risk:** HIGH — data migration touches every ticket row.
**Pre-condition:** Full database backup before running.

### Task 1.1 — Add new Ticket STATUS_CHOICES

File: `backend/support_app/models.py`

- Add 4 new status choices: `consulting_paid`, `diagnosis_in_progress`, `quote_pending`, `awaiting_resolution_payment`, `work_in_progress`, `waiting_for_customer`, `quote_declined`
- Remove deprecated choices: `open` (moved to `consulting_paid` meaning), `in_progress` (→ `work_in_progress`), `waiting_customer` (→ `waiting_for_customer`)

**Important:** Keep deprecated choices in the list temporarily to allow the data migration to reference them. Remove them in a follow-up cleanup migration after data migration succeeds.

### Task 1.2 — Add consulting_paid_at to Ticket

File: `backend/support_app/models.py`

```python
consulting_paid_at = models.DateTimeField(null=True, blank=True)
```

This timestamps when the consulting fee was collected — needed for finance reporting.

### Task 1.3 — Create Quote model

File: `backend/support_app/models.py`

Add the `Quote` model as specified in the architecture document (Section 3.2).
Add `unique_together = [["ticket"]]` for active (non-declined, non-expired) quotes via a database constraint is impractical — enforce in service layer instead.

### Task 1.4 — Create Payout model

File: `backend/support_app/models.py`

Add the `Payout` model as specified in the architecture document (Section 3.3).
Add a database-level uniqueness check: at most one Payout per ticket in `pending` or `paid` state (enforce in service layer).

### Task 1.5 — Modify Payment model

File: `backend/support_app/models.py`

Add FK to Quote:
```python
quote = models.ForeignKey(
    "Quote", on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
)
```

### Task 1.6 — Update TicketActivityLog ACTION_CHOICES

File: `backend/support_app/models.py`

Add:
```python
("quote_created",      "Quote Created"),
("quote_approved",     "Quote Approved by Ops"),
("quote_rejected",     "Quote Rejected by Ops"),
("customer_accepted",  "Customer Accepted Quote"),
("customer_declined",  "Customer Declined Quote"),
("resolution_paid",    "Resolution Fee Paid"),
```

### Task 1.7 — Update Notification CATEGORY_CHOICES

File: `backend/support_app/models.py`

Add:
```python
("quote_received",          "Quote Received"),
("quote_approved_by_ops",   "Quote Approved by Ops"),
("resolution_payment_due",  "Resolution Payment Due"),
("payout_processed",        "Payout Processed"),
```

### Task 1.8 — Write Migration 0014: Schema

File: `backend/support_app/migrations/0014_pay_per_ticket_models.py`

This is a Django-generated `python manage.py makemigrations` migration.
Include: `Quote` model, `Payout` model, `Payment.quote` FK, `Ticket.consulting_paid_at`, updated choices fields.

Verify: `python manage.py migrate --plan` shows only additive changes (no destructive ALTER TABLE).

### Task 1.9 — Write Migration 0015: Data Migration

File: `backend/support_app/migrations/0015_pay_per_ticket_data_migration.py`

```python
def remap_ticket_statuses(apps, schema_editor):
    Ticket = apps.get_model("support_app", "Ticket")
    STATUS_MAP = {
        "pending_payment":  "open",
        "open":             "consulting_paid",
        "in_progress":      "work_in_progress",
        "waiting_customer": "waiting_for_customer",
    }
    for old_status, new_status in STATUS_MAP.items():
        Ticket.objects.filter(status=old_status).update(status=new_status)

def reverse_remap(apps, schema_editor):
    Ticket = apps.get_model("support_app", "Ticket")
    REVERSE_MAP = {v: k for k, v in STATUS_MAP.items()}
    for new_status, old_status in REVERSE_MAP.items():
        Ticket.objects.filter(status=new_status).update(status=old_status)
```

Run this migration SEPARATELY after verifying 0014 on a dev/staging database.

---

## Phase 2 — Backend Services

**Goal:** Implement business logic for quotes and payouts.
**Risk:** MEDIUM — service functions are called from views; wrong logic creates bad data.

### Task 2.1 — Implement payout_service.py

File: `backend/support_app/services/payout_service.py`

Replace the stub functions with real implementations:

```python
ENGINEER_SHARE = Decimal("0.65")
PLATFORM_SHARE = Decimal("0.35")

def create_payout_for_ticket(ticket, quote) -> Payout:
    """Called when ticket moves to CLOSED. Creates Payout record."""
    # Guard: no duplicate payout
    if Payout.objects.filter(ticket=ticket).exists():
        return Payout.objects.get(ticket=ticket)
    resolution_fee = quote.resolution_fee
    engineer_amount = (resolution_fee * ENGINEER_SHARE).quantize(Decimal("0.01"))
    platform_amount = (resolution_fee * PLATFORM_SHARE).quantize(Decimal("0.01"))
    gst_collected = quote.gst_amount
    return Payout.objects.create(
        ticket=ticket,
        engineer=quote.engineer,
        quote=quote,
        resolution_fee=resolution_fee,
        engineer_percentage=ENGINEER_SHARE * 100,
        engineer_amount=engineer_amount,
        platform_amount=platform_amount,
        gst_collected=gst_collected,
        status="pending",
    )

def mark_payout_paid(payout, utr_reference: str, actor) -> Payout:
    """Finance Manager marks payout as disbursed."""
    if payout.status == "paid":
        return payout
    payout.status = "paid"
    payout.paid_at = timezone.now()
    payout.utr_reference = utr_reference
    payout.save(update_fields=["status", "paid_at", "utr_reference", "updated_at"])
    return payout

def get_engineer_earnings_summary(freelancer) -> dict:
    """Returns pending and paid earnings for an engineer."""
    payouts = Payout.objects.filter(engineer=freelancer)
    pending_amount = payouts.filter(status__in=["pending", "approved"]).aggregate(
        total=Sum("engineer_amount")
    )["total"] or Decimal("0")
    paid_amount = payouts.filter(status="paid").aggregate(
        total=Sum("engineer_amount")
    )["total"] or Decimal("0")
    return {
        "pending_amount": str(pending_amount),
        "paid_amount": str(paid_amount),
        "pending_count": payouts.filter(status__in=["pending", "approved"]).count(),
        "paid_count": payouts.filter(status="paid").count(),
    }
```

### Task 2.2 — Add quote service functions to ticket_service.py

File: `backend/support_app/services/ticket_service.py`

Add these functions:

```python
def create_quote(ticket, engineer, diagnosis, scope_of_work, resolution_fee_amount) -> Quote:
    """
    Engineer submits a quote for an assigned ticket.
    Guards: ticket must be in diagnosis_in_progress status.
    """
    if ticket.status != "diagnosis_in_progress":
        raise ValueError("Can only create a quote for tickets in diagnosis_in_progress status.")
    if ticket.assigned_to != engineer:
        raise ValueError("Only the assigned engineer can create a quote for this ticket.")

    # Close any previous rejected/expired quotes
    Quote.objects.filter(ticket=ticket, status__in=["declined", "expired"]).update(status="expired")

    gst_rate = Decimal(str(getattr(settings, "GST_RATE", 0.18)))
    gst_amount = (resolution_fee_amount * gst_rate).quantize(Decimal("0.01"))
    total_amount = resolution_fee_amount + gst_amount

    with transaction.atomic():
        quote = Quote.objects.create(
            ticket=ticket,
            engineer=engineer,
            diagnosis=diagnosis,
            scope_of_work=scope_of_work,
            resolution_fee=resolution_fee_amount,
            gst_amount=gst_amount,
            total_amount=total_amount,
            status="pending_ops_review",
        )
        ticket.status = "quote_pending"
        ticket.save(update_fields=["status", "updated_at"])
        TicketActivityLog.objects.create(
            ticket=ticket,
            actor=engineer.user,
            action="quote_created",
            note=f"Quote submitted: ₹{resolution_fee_amount} + GST = ₹{total_amount}",
        )
    return quote


def approve_quote_by_ops(quote, ops_user, note="") -> Quote:
    """
    Ops Manager approves the quote and sends it to the customer.
    """
    if quote.status != "pending_ops_review":
        raise ValueError("Only quotes pending ops review can be approved.")
    with transaction.atomic():
        quote.status = "approved_by_ops"
        quote.approved_at = timezone.now()
        quote.ops_note = note
        quote.save(update_fields=["status", "approved_at", "ops_note", "updated_at"])
        TicketActivityLog.objects.create(
            ticket=quote.ticket,
            actor=ops_user,
            action="quote_approved",
            note=note,
        )
        # Notify customer
        from .notification_service import create_notification
        create_notification(
            recipient=quote.ticket.customer.user,
            category="quote_received",
            title=f"Quote ready for ticket {quote.ticket.ticket_number}",
            body=f"Your engineer has submitted a resolution quote of ₹{quote.total_amount}.",
            ticket=quote.ticket,
        )
    return quote


def reject_quote_by_ops(quote, ops_user, note="") -> Quote:
    """
    Ops Manager rejects the quote, sending it back to the engineer.
    Ticket returns to diagnosis_in_progress.
    """
    if quote.status != "pending_ops_review":
        raise ValueError("Only quotes pending ops review can be rejected.")
    with transaction.atomic():
        quote.status = "declined"
        quote.ops_note = note
        quote.save(update_fields=["status", "ops_note", "updated_at"])
        quote.ticket.status = "diagnosis_in_progress"
        quote.ticket.save(update_fields=["status", "updated_at"])
        TicketActivityLog.objects.create(
            ticket=quote.ticket,
            actor=ops_user,
            action="quote_rejected",
            note=note,
        )
        # Notify engineer
        from .notification_service import create_notification
        create_notification(
            recipient=quote.engineer.user,
            category="quote_approved_by_ops",
            title=f"Quote rejected for ticket {quote.ticket.ticket_number}",
            body=f"Ops has requested revisions. Note: {note}",
            ticket=quote.ticket,
        )
    return quote


def customer_accept_quote(quote, customer_user) -> Quote:
    """
    Customer accepts the quote. Ticket moves to awaiting_resolution_payment.
    """
    if quote.status != "approved_by_ops":
        raise ValueError("Quote is not available for customer acceptance.")
    if quote.ticket.customer.user != customer_user:
        raise ValueError("Only the ticket owner can accept this quote.")
    with transaction.atomic():
        quote.status = "accepted"
        quote.accepted_at = timezone.now()
        quote.save(update_fields=["status", "accepted_at", "updated_at"])
        quote.ticket.status = "awaiting_resolution_payment"
        quote.ticket.save(update_fields=["status", "updated_at"])
        TicketActivityLog.objects.create(
            ticket=quote.ticket,
            actor=customer_user,
            action="customer_accepted",
            note=f"Customer accepted quote ₹{quote.total_amount}",
        )
        from .notification_service import create_notification
        create_notification(
            recipient=quote.engineer.user,
            category="resolution_payment_due",
            title=f"Quote accepted — {quote.ticket.ticket_number}",
            body="Customer accepted your quote. Awaiting resolution payment.",
            ticket=quote.ticket,
        )
    return quote


def customer_decline_quote(quote, customer_user, note="") -> Quote:
    """
    Customer declines the quote. Ticket moves to quote_declined (terminal).
    """
    if quote.status != "approved_by_ops":
        raise ValueError("Quote is not available for customer decision.")
    if quote.ticket.customer.user != customer_user:
        raise ValueError("Only the ticket owner can decline this quote.")
    with transaction.atomic():
        quote.status = "declined"
        quote.declined_at = timezone.now()
        quote.save(update_fields=["status", "declined_at", "updated_at"])
        quote.ticket.status = "quote_declined"
        quote.ticket.save(update_fields=["status", "updated_at"])
        TicketActivityLog.objects.create(
            ticket=quote.ticket,
            actor=customer_user,
            action="customer_declined",
            note=note or "Customer declined the resolution quote.",
        )
    return quote
```

### Task 2.3 — Extend payment_service.py for resolution fee

File: `backend/support_app/services/payment_service.py`

Add:

```python
def create_resolution_order_for_ticket(ticket, quote) -> dict:
    """
    Create (or retrieve) the pending resolution-fee Payment for this ticket.
    Returns a dict for the frontend Razorpay checkout.
    """
    if ticket.status != "awaiting_resolution_payment":
        raise ValueError("Ticket is not awaiting resolution payment.")

    payment = Payment.objects.filter(
        ticket=ticket,
        customer=ticket.customer,
        payment_type="resolution_fee",
        status="pending",
    ).first()

    if not payment:
        base_amount = quote.resolution_fee
        gst_amount = quote.gst_amount
        payment = Payment.objects.create(
            customer=ticket.customer,
            ticket=ticket,
            quote=quote,
            amount=base_amount,
            gst_amount=gst_amount,
            payment_type="resolution_fee",
            gateway="razorpay",
            invoice_number=_generate_invoice_number(),
            status="pending",
        )

    total_paise = int((payment.amount + payment.gst_amount) * 100)
    # Razorpay order creation (same pattern as consulting fee)
    # ... (identical to existing create_order_for_ticket logic)
    return { ... }  # same shape as consulting fee order dict


def _activate_work_after_resolution_payment(payment, actor, note: str) -> None:
    """Move awaiting_resolution_payment → work_in_progress after payment."""
    ticket = payment.ticket
    if not ticket or ticket.status != "awaiting_resolution_payment":
        return
    old_status = ticket.status
    ticket.status = "work_in_progress"
    ticket.save(update_fields=["status"])
    TicketActivityLog.objects.create(
        ticket=ticket,
        actor=actor,
        action="resolution_paid",
        from_value=old_status,
        to_value="work_in_progress",
        note=note,
    )
    from .notification_service import create_notification
    create_notification(
        recipient=ticket.assigned_to.user,
        category="resolution_payment_due",
        title=f"Resolution fee paid — {ticket.ticket_number}",
        body="Customer has paid the resolution fee. You can begin implementation.",
        ticket=ticket,
    )
```

### Task 2.4 — Update ticket_service.update_status for new statuses

File: `backend/support_app/services/ticket_service.py`

The `update_status` function already reads from `Ticket.STATUS_CHOICES` dynamically, so it will accept new statuses automatically. However, the `closed` → `create_payout` hook must be added:

```python
# In update_status, after saving:
if new_status == "closed":
    active_quote = ticket.quotes.filter(status="accepted").first()
    if active_quote:
        from .payout_service import create_payout_for_ticket
        transaction.on_commit(lambda: create_payout_for_ticket(ticket, active_quote))
```

---

## Phase 3 — Backend API Layer

**Goal:** Wire up the new services to HTTP endpoints.
**Risk:** MEDIUM — requires careful RBAC on each new endpoint.

### Task 3.1 — New Serializers

File: `backend/support_app/serializers.py`

Add:

```python
class QuoteSerializer(serializers.ModelSerializer):
    """Used for engineer creation and customer/ops read."""
    engineer_email = serializers.EmailField(source="engineer.user.email", read_only=True)

    class Meta:
        model = Quote
        fields = [
            "id", "ticket", "engineer_email", "diagnosis", "scope_of_work",
            "resolution_fee", "gst_amount", "total_amount", "status",
            "ops_note", "created_at", "updated_at", "approved_at",
            "accepted_at", "declined_at",
        ]
        read_only_fields = [
            "id", "ticket", "engineer_email", "gst_amount", "total_amount",
            "status", "ops_note", "approved_at", "accepted_at", "declined_at",
            "created_at", "updated_at",
        ]


class QuoteCreateSerializer(serializers.Serializer):
    """Validates engineer's quote submission."""
    diagnosis = serializers.CharField(min_length=10)
    scope_of_work = serializers.CharField(min_length=10)
    resolution_fee = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("1"))


class PayoutSerializer(serializers.ModelSerializer):
    """Finance Manager payout list view."""
    engineer_email = serializers.EmailField(source="engineer.user.email", read_only=True)
    ticket_number  = serializers.CharField(source="ticket.ticket_number", read_only=True)

    class Meta:
        model = Payout
        fields = [
            "id", "ticket", "ticket_number", "engineer_email",
            "resolution_fee", "engineer_percentage", "engineer_amount",
            "platform_amount", "gst_collected", "gateway_fee",
            "status", "paid_at", "utr_reference", "notes", "created_at",
        ]
        read_only_fields = [
            "id", "ticket", "ticket_number", "engineer_email",
            "resolution_fee", "engineer_percentage", "engineer_amount",
            "platform_amount", "gst_collected", "created_at",
        ]


class PayoutMarkPaidSerializer(serializers.Serializer):
    """Validates the body of POST /api/finance/payouts/{id}/mark-paid/."""
    utr_reference = serializers.CharField(max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
```

Also update:

- `_TICKET_STATUSES` list in serializers.py to include all new status values
- `_FREELANCER_STATUSES` to include: `diagnosis_in_progress`, `work_in_progress`, `waiting_for_customer`, `resolved`
- `TicketDetailSerializer` to include `quote` field (optional, role-dependent)

### Task 3.2 — New Views: Engineer Quote

File: `backend/support_app/views.py`

```python
@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated, IsFreelancer])
def freelancer_ticket_quote(request, ticket_id):
    """
    GET  /api/freelancer/tickets/{id}/quote/ — get current quote
    POST /api/freelancer/tickets/{id}/quote/ — submit a new quote
    """
    ...

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsFreelancer])
def freelancer_earnings(request):
    """GET /api/freelancer/earnings/ — earnings summary."""
    ...
```

### Task 3.3 — New Views: Customer Quote

File: `backend/support_app/views.py`

```python
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def customer_get_quote(request, ticket_id):
    """GET /api/tickets/{id}/quote/ — customer views the quote."""
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def customer_accept_quote(request, ticket_id):
    """POST /api/tickets/{id}/quote/accept/ — customer accepts."""
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def customer_decline_quote(request, ticket_id):
    """POST /api/tickets/{id}/quote/decline/ — customer declines."""
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def ticket_initiate_resolution_payment(request, ticket_id):
    """POST /api/tickets/{id}/initiate-resolution-payment/"""
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def ticket_verify_resolution_payment(request, ticket_id):
    """POST /api/tickets/{id}/verify-resolution-payment/"""
    ...
```

### Task 3.4 — New Views: Ops Quote Management

File: `backend/support_app/views.py`

```python
class OpsQuoteListView(generics.ListAPIView):
    """GET /api/ops/quotes/ — all quotes pending ops review."""
    serializer_class = QuoteSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin])
def ops_approve_quote(request, quote_id):
    """POST /api/ops/quotes/{id}/approve/"""
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin])
def ops_reject_quote(request, quote_id):
    """POST /api/ops/quotes/{id}/reject/"""
    ...
```

### Task 3.5 — New Views: Finance Dashboard

File: `backend/support_app/views.py`

```python
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsFinanceManagerOrSuperAdmin])
def finance_dashboard(request):
    """
    GET /api/finance/dashboard/
    Returns: consulting_revenue, resolution_revenue, total_gst, platform_margin,
             engineer_payouts_pending, engineer_payouts_paid, net_revenue.
    """
    ...

class FinancePayoutListView(generics.ListAPIView):
    """GET /api/finance/payouts/ — all payouts with status filter."""
    ...

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsFinanceManagerOrSuperAdmin])
def finance_mark_payout_paid(request, payout_id):
    """POST /api/finance/payouts/{id}/mark-paid/"""
    ...
```

### Task 3.6 — URL Registration

File: `backend/support_app/urls.py`

Add:
```python
# ── Engineer: Quotes & Earnings ───────────────────────────────────
path("freelancer/tickets/<uuid:ticket_id>/quote/",       views.freelancer_ticket_quote,              name="freelancer-ticket-quote"),
path("freelancer/earnings/",                              views.freelancer_earnings,                  name="freelancer-earnings"),

# ── Customer: Quote decisions ─────────────────────────────────────
path("tickets/<uuid:ticket_id>/quote/",                  views.customer_get_quote,                   name="ticket-quote"),
path("tickets/<uuid:ticket_id>/quote/accept/",           views.customer_accept_quote,                name="ticket-quote-accept"),
path("tickets/<uuid:ticket_id>/quote/decline/",          views.customer_decline_quote,               name="ticket-quote-decline"),
path("tickets/<uuid:ticket_id>/initiate-resolution-payment/", views.ticket_initiate_resolution_payment, name="ticket-initiate-resolution-payment"),
path("tickets/<uuid:ticket_id>/verify-resolution-payment/",   views.ticket_verify_resolution_payment,   name="ticket-verify-resolution-payment"),

# ── Ops: Quote management ─────────────────────────────────────────
path("ops/quotes/",                                      views.OpsQuoteListView.as_view(),           name="ops-quote-list"),
path("ops/quotes/<uuid:quote_id>/approve/",              views.ops_approve_quote,                    name="ops-quote-approve"),
path("ops/quotes/<uuid:quote_id>/reject/",               views.ops_reject_quote,                     name="ops-quote-reject"),

# ── Finance ───────────────────────────────────────────────────────
path("finance/dashboard/",                               views.finance_dashboard,                    name="finance-dashboard"),
path("finance/payouts/",                                 views.FinancePayoutListView.as_view(),      name="finance-payout-list"),
path("finance/payouts/<uuid:payout_id>/mark-paid/",      views.finance_mark_payout_paid,             name="finance-payout-mark-paid"),
```

### Task 3.7 — Update Existing Views

- `ticket_verify_payment`: after success, set `ticket.status = "consulting_paid"` and `ticket.consulting_paid_at = now()` (instead of `"open"`)
- `ops_payment_confirm`: same change as above
- `payment_webhook` / `process_payment_webhook`: same change
- `freelancer_update_status`: update allowed statuses list
- `admin_payment_confirm`: same consulting_paid change
- `analytics_view`: fix the `Sum("total_amount")` bug → `Sum(F("amount") + F("gst_amount"))`
- `ops_analytics`: fix `models.ExpressionWrapper` → import locally
- `ops_dashboard`: add `quote_pending`, `awaiting_resolution_payment` counts

### Task 3.8 — Update Serializer Status Lists

File: `backend/support_app/serializers.py`

```python
_TICKET_STATUSES = [
    "open", "consulting_paid", "assigned", "diagnosis_in_progress",
    "quote_pending", "awaiting_resolution_payment", "work_in_progress",
    "waiting_for_customer", "resolved", "closed", "quote_declined",
]

_FREELANCER_STATUSES = [
    "diagnosis_in_progress",
    "work_in_progress",
    "waiting_for_customer",
    "resolved",
]
```

---

## Phase 4 — Frontend

**Goal:** Update the React application to support the new workflow.
**Risk:** LOW — no backend changes, purely additive UI.

### Task 4.1 — API Client: tickets.js

File: `frontend/src/api/tickets.js`

Add:
```js
export const getQuote = (ticketId) => client.get(`/tickets/${ticketId}/quote/`);
export const acceptQuote = (ticketId) => client.post(`/tickets/${ticketId}/quote/accept/`);
export const declineQuote = (ticketId, note) => client.post(`/tickets/${ticketId}/quote/decline/`, { note });
export const initiateResolutionPayment = (ticketId) => client.post(`/tickets/${ticketId}/initiate-resolution-payment/`);
export const verifyResolutionPayment = (ticketId, data) => client.post(`/tickets/${ticketId}/verify-resolution-payment/`, data);
```

### Task 4.2 — API Client: ops.js

File: `frontend/src/api/ops.js`

Add:
```js
export const getQuotes = (params) => client.get("/ops/quotes/", { params });
export const approveQuote = (quoteId, note) => client.post(`/ops/quotes/${quoteId}/approve/`, { note });
export const rejectQuote = (quoteId, note) => client.post(`/ops/quotes/${quoteId}/reject/`, { note });
```

### Task 4.3 — API Client: payments.js (new finance methods)

File: `frontend/src/api/payments.js`

Add:
```js
export const getFinanceDashboard = () => client.get("/finance/dashboard/");
export const getPayouts = (params) => client.get("/finance/payouts/", { params });
export const markPayoutPaid = (payoutId, data) => client.post(`/finance/payouts/${payoutId}/mark-paid/`, data);
export const getFreelancerEarnings = () => client.get("/freelancer/earnings/");
```

### Task 4.4 — New Component: QuoteSection.jsx

File: `frontend/src/components/tickets/QuoteSection.jsx`

Renders different UI based on `ticket.status` and `user.role`:

| Status | Customer view | Engineer view | Ops view |
|---|---|---|---|
| `diagnosis_in_progress` | "Engineer is diagnosing..." | Quote creation form | — |
| `quote_pending` | "Quote ready — review below" | "Quote under review" | Quote approve/reject panel |
| `awaiting_resolution_payment` | Resolution payment button | "Awaiting payment" | — |
| `work_in_progress` | "Engineer is implementing" | Status update controls | — |

### Task 4.5 — New Component: QuoteCreateForm.jsx

File: `frontend/src/components/tickets/QuoteCreateForm.jsx`

Form for engineers (only shown when status = `diagnosis_in_progress`):
- Textarea: Diagnosis
- Textarea: Scope of Work
- Number input: Resolution Fee (₹)
- Preview: GST (auto-calculated at 18%)
- Preview: Total
- Submit button

### Task 4.6 — New Component: ResolutionPaymentGateway.jsx

File: `frontend/src/components/tickets/ResolutionPaymentGateway.jsx`

Similar to `PaymentGateway.jsx` but:
- Calls `initiateResolutionPayment` instead of `initiatePayment`
- Shows quote details (diagnosis, scope) above the payment form
- After payment: refreshes ticket status

### Task 4.7 — Update TicketDetail.jsx

File: `frontend/src/components/tickets/TicketDetail.jsx`

- Import `QuoteSection`
- Render `<QuoteSection ticket={ticket} user={user} />` between status timeline and comments
- Update status badge labels for new status values (rename `in_progress` → `work_in_progress` display, etc.)
- Update `CustomerResolutionActions` to only show on `resolved` (unchanged)

### Task 4.8 — Update TicketDetailPage.jsx

File: `frontend/src/pages/TicketDetailPage.jsx`

- After ticket loads, also fetch quote if status is `quote_pending`, `awaiting_resolution_payment`, or `work_in_progress` (call `getQuote`)
- Pass quote data to `TicketDetail` component

### Task 4.9 — Update Dashboard.jsx (Customer)

File: `frontend/src/pages/Dashboard.jsx`

- Add status banner for `consulting_paid` (awaiting assignment)
- Add quote alert banner for `quote_pending` (with link to ticket)
- Add payment due banner for `awaiting_resolution_payment`
- Update status display labels throughout

### Task 4.10 — Update FreelancerDashboard.jsx

File: `frontend/src/pages/freelancer/FreelancerDashboard.jsx`

- Add "Expected Earnings" card (calls `getFreelancerEarnings`)
- Add "Quote Drafts" section — tickets in `diagnosis_in_progress` with no quote yet
- Show quote status on ticket cards

### Task 4.11 — Update OpsTicketQueue.jsx

File: `frontend/src/pages/ops/OpsTicketQueue.jsx`

- Add `quote_pending` and `awaiting_resolution_payment` status filter options
- Add quote status column to ticket table
- Add "Pending Quotes" tab that filters to `quote_pending` tickets

### Task 4.12 — Update OpsDashboard.jsx

File: `frontend/src/pages/ops/OpsDashboard.jsx`

Add metric cards:
- Quotes Pending Review
- Awaiting Resolution Payment

### Task 4.13 — New Page: FinanceDashboard.jsx

File: `frontend/src/pages/ops/FinanceDashboard.jsx`

Sections:
- **Revenue Summary**: Consulting Revenue | Resolution Revenue | Total GST | Net Platform Margin
- **Payout Summary**: Pending Payouts (count + total ₹) | Paid Payouts
- **Monthly Revenue Chart**: bar chart from `finance/dashboard/` data

### Task 4.14 — New Page: FinancePayouts.jsx

File: `frontend/src/pages/ops/FinancePayouts.jsx`

- Table: Engineer | Ticket | Resolution Fee | Engineer Amount | Status | Action
- "Mark Paid" button → modal for UTR reference input
- Status filter: pending / approved / paid / failed

### Task 4.15 — Update Sidebar.jsx

File: `frontend/src/components/layout/Sidebar.jsx`

Add Finance section visible only to `finance_manager` and `admin`:
```
Finance
  ├── Revenue Dashboard  (/operations/finance)
  └── Engineer Payouts   (/operations/finance/payouts)
```

### Task 4.16 — Update App.jsx Routes

File: `frontend/src/App.jsx`

Register:
```jsx
<Route path="/operations/finance" element={<FinanceDashboard />} />
<Route path="/operations/finance/payouts" element={<FinancePayouts />} />
```

---

## Phase 5 — Integration Verification

**Goal:** Confirm the full end-to-end workflow works before shipping.
**Risk:** LOW once Phases 1–4 are done.

### Task 5.1 — Update test_ticket_system.py

File: `backend/tests/test_ticket_system.py`

- Update any test that asserts `ticket.status == "open"` → `"consulting_paid"`
- Update any test that asserts `ticket.status == "in_progress"` → `"work_in_progress"`
- Update any test that asserts `ticket.status == "waiting_customer"` → `"waiting_for_customer"`
- Add test: `create_quote` guard (wrong status raises ValueError)
- Add test: quote status machine (pending_ops_review → approved_by_ops → accepted)
- Add test: payout created on `closed` transition
- Add test: engineer earnings summary

### Task 5.2 — Update test_api_phase4.py

File: `backend/tests/test_api_phase4.py`

- Update status string references
- Add API-level tests for new endpoints (quote CRUD, accept, decline, resolution payment)

### Task 5.3 — Seed Data Update

File: `backend/support_app/management/commands/seed_demo_data.py`

- Update hardcoded status strings to new values
- Add demo quote and payout objects for the Finance Manager demo account

---

## Files Changed Summary

### Backend

| File | Change Type |
|---|---|
| `support_app/models.py` | Modified (status choices, new models Quote + Payout, field additions) |
| `support_app/migrations/0014_*.py` | New (schema migration) |
| `support_app/migrations/0015_*.py` | New (data migration) |
| `support_app/services/payout_service.py` | Rewritten (was stub) |
| `support_app/services/ticket_service.py` | Extended (quote service functions) |
| `support_app/services/payment_service.py` | Extended (resolution fee flow) |
| `support_app/serializers.py` | Extended (new serializers, updated status lists) |
| `support_app/views.py` | Extended (new views + existing view fixes) |
| `support_app/urls.py` | Extended (new URL patterns) |
| `tests/test_ticket_system.py` | Updated |
| `tests/test_api_phase4.py` | Updated |

### Frontend

| File | Change Type |
|---|---|
| `api/tickets.js` | Extended |
| `api/ops.js` | Extended |
| `api/payments.js` | Extended |
| `components/tickets/QuoteSection.jsx` | New |
| `components/tickets/QuoteCreateForm.jsx` | New |
| `components/tickets/ResolutionPaymentGateway.jsx` | New |
| `components/tickets/TicketDetail.jsx` | Modified |
| `pages/TicketDetailPage.jsx` | Modified |
| `pages/Dashboard.jsx` | Modified |
| `pages/freelancer/FreelancerDashboard.jsx` | Modified |
| `pages/ops/OpsTicketQueue.jsx` | Modified |
| `pages/ops/OpsDashboard.jsx` | Modified |
| `pages/ops/FinanceDashboard.jsx` | New |
| `pages/ops/FinancePayouts.jsx` | New |
| `components/layout/Sidebar.jsx` | Modified |
| `App.jsx` | Modified (new routes) |
