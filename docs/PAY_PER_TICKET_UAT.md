# Pay-Per-Ticket UAT Test Cases

**Status:** AWAITING APPROVAL
**Purpose:** User Acceptance Testing script for the Pay-Per-Ticket feature.
**Prerequisite:** Phases 1–4 of the implementation plan completed.

---

## Test Accounts Required

| Role | Email | Password |
|---|---|---|
| Customer | customer@uat.com | — |
| Engineer (Freelancer) | engineer@uat.com | — |
| Operations Manager | ops@uat.com | — |
| Finance Manager | finance@uat.com | — |
| Super Admin | admin@uat.com | — |

---

## Module 1 — Ticket Creation & Consulting Fee

### TC-001: Customer creates a ticket

**Actor:** Customer
**Pre-condition:** Logged in as customer.
**Steps:**
1. Navigate to `/new-ticket`
2. Fill in: Title, Description, Service Type = "Microsoft 365 / Exchange", Severity = Medium, Priority = Medium
3. Click "Create Ticket"

**Expected:**
- Ticket created with status `open`
- Customer redirected to ticket detail page
- Payment prompt visible (Consulting Fee ₹299 + 18% GST = ₹353)
- Ticket does NOT appear in ops queue yet (not paid)

---

### TC-002: Customer pays consulting fee

**Actor:** Customer
**Pre-condition:** TC-001 complete. Ticket in `open` status.
**Steps:**
1. On ticket detail page, click "Pay Consulting Fee"
2. Payment modal shows: ₹299 + ₹54 GST = ₹353
3. Complete payment (sandbox: click "Simulate Payment")

**Expected:**
- Ticket status changes to `consulting_paid`
- Activity log entry: "Status Changed: open → consulting_paid"
- In-app notification sent to customer: "Payment confirmed"
- Payment record created: `payment_type=consulting_fee`, `status=completed`, `amount=299`, `gst_amount=54`
- Ticket now visible in Ops Manager queue

---

### TC-003: Consulting fee is non-refundable

**Actor:** Finance Manager
**Pre-condition:** TC-002 complete.
**Steps:**
1. Login as finance@uat.com
2. Navigate to Finance → Payouts
3. Locate the consulting fee payment for TC-002 ticket

**Expected:**
- Consulting fee payment listed with `payment_type=consulting_fee`
- No "Refund" button available (consulting fee is non-refundable by design)
- The refund button appears only on `resolution_fee` payments

---

## Module 2 — Ops Assignment & Diagnosis

### TC-004: Ops Manager assigns engineer

**Actor:** Operations Manager
**Pre-condition:** TC-002 complete. Ticket in `consulting_paid` status.
**Steps:**
1. Login as ops@uat.com
2. Navigate to Ops → Ticket Queue
3. Filter by status: `consulting_paid`
4. Click ticket from TC-002
5. Click "Assign Engineer" → select engineer@uat.com
6. Click Confirm

**Expected:**
- Ticket status changes to `assigned`
- Activity log: "Assigned to engineer@uat.com"
- Engineer receives in-app notification: "New ticket assigned"
- Customer receives notification: "Your ticket is being handled"

---

### TC-005: Engineer starts diagnosis

**Actor:** Engineer
**Pre-condition:** TC-004 complete. Ticket in `assigned` status.
**Steps:**
1. Login as engineer@uat.com
2. Navigate to My Tickets
3. Open the assigned ticket
4. Click "Start Diagnosis"

**Expected:**
- Ticket status changes to `diagnosis_in_progress`
- Activity log: "Status Changed: assigned → diagnosis_in_progress"
- Quote creation form appears in the ticket detail view

---

## Module 3 — Quote Lifecycle

### TC-006: Engineer submits a quote

**Actor:** Engineer
**Pre-condition:** TC-005 complete. Ticket in `diagnosis_in_progress` status.
**Steps:**
1. On the ticket detail page, fill in the Quote form:
   - Diagnosis: "Microsoft 365 DNS SPF record misconfiguration causing email delivery failures."
   - Scope of Work: "Audit MX/SPF/DKIM/DMARC records. Correct SPF record. Test delivery to 5 domains."
   - Resolution Fee: ₹800
2. Click "Submit Quote"

**Expected:**
- Quote created with status `pending_ops_review`
- Ticket status changes to `quote_pending`
- Activity log: "Quote Created: ₹800 + GST = ₹944"
- Ops Manager receives notification: "New quote pending review"
- Engineer sees "Quote submitted — awaiting ops review" banner

---

### TC-007: Ops Manager approves quote

**Actor:** Operations Manager
**Pre-condition:** TC-006 complete. Ticket in `quote_pending`.
**Steps:**
1. Login as ops@uat.com
2. Navigate to Ops → Ticket Queue → "Pending Quotes" tab
3. Open the ticket from TC-006
4. Review quote (diagnosis, scope, fee)
5. Click "Approve Quote"
6. Optionally add note: "Approved — fee is reasonable."
7. Confirm

**Expected:**
- Quote status changes to `approved_by_ops`
- Customer receives in-app notification: "Quote ready — ₹944"
- Customer receives email notification with quote details
- Ticket remains in `quote_pending` status (customer decision pending)

---

### TC-008: Customer views the quote

**Actor:** Customer
**Pre-condition:** TC-007 complete.
**Steps:**
1. Login as customer@uat.com
2. Navigate to ticket from TC-002
3. View the Quote section

**Expected:**
- Quote section visible with:
  - Diagnosis text
  - Scope of work text
  - Resolution Fee: ₹800
  - GST (18%): ₹144
  - Total: ₹944
- Two action buttons: "Accept Quote" and "Decline Quote"
- Consulting fee already paid (badge visible: "Consulting Fee Paid ₹353")

---

### TC-009: Customer accepts the quote

**Actor:** Customer
**Pre-condition:** TC-008 complete. Quote in `approved_by_ops` status.
**Steps:**
1. On ticket detail, click "Accept Quote"
2. Confirm in modal

**Expected:**
- Quote status changes to `accepted`
- Ticket status changes to `awaiting_resolution_payment`
- Activity log: "Customer Accepted Quote: ₹800 + GST = ₹944"
- Engineer receives notification: "Customer accepted your quote"
- Payment button appears: "Pay Resolution Fee ₹944"

---

### TC-010: Customer declines the quote

**Actor:** Customer
**Pre-condition:** Separate ticket in TC-006 state (ops-approved quote). TC-009 flow not yet taken.
**Steps:**
1. On a separate ticket's quote section, click "Decline Quote"
2. Enter reason: "Fee is too high for the scope."
3. Confirm

**Expected:**
- Quote status changes to `declined`
- Ticket status changes to `quote_declined` (terminal)
- Activity log: "Customer Declined Quote"
- Ticket no longer appears in engineer's active queue
- Consulting fee (₹353) remains collected — not refunded

---

### TC-011: Ops Manager rejects a quote (sends back to engineer)

**Actor:** Operations Manager
**Pre-condition:** A new ticket where engineer has submitted a quote but ops wants revision.
**Steps:**
1. Open quote in ops review panel
2. Click "Reject Quote"
3. Enter note: "Resolution fee too high. Re-evaluate."
4. Confirm

**Expected:**
- Quote status changes to `declined`
- Ticket status changes back to `diagnosis_in_progress`
- Engineer receives notification: "Quote rejected — revision requested"
- Engineer can submit a new quote
- Customer sees "Engineer is revising the quote" (still `quote_pending` in timeline? No — `diagnosis_in_progress`)

---

## Module 4 — Resolution Payment & Work

### TC-012: Customer pays resolution fee

**Actor:** Customer
**Pre-condition:** TC-009 complete. Ticket in `awaiting_resolution_payment` status.
**Steps:**
1. On ticket detail page, click "Pay Resolution Fee ₹944"
2. Payment modal shows: ₹800 + ₹144 GST = ₹944
3. Complete payment (sandbox: click "Simulate Payment")

**Expected:**
- Ticket status changes to `work_in_progress`
- Activity log: "Resolution Fee Paid"
- Engineer receives notification: "Resolution fee paid — begin implementation"
- Payment record created: `payment_type=resolution_fee`, `amount=800`, `gst_amount=144`, `status=completed`
- Quote FK on payment record: points to TC-006's quote

---

### TC-013: Engineer updates status to waiting_for_customer

**Actor:** Engineer
**Pre-condition:** TC-012 complete. Ticket in `work_in_progress`.
**Steps:**
1. On ticket detail, click "Waiting for Customer"
2. Add note: "Need admin credentials to apply DNS changes."
3. Click Update

**Expected:**
- Ticket status changes to `waiting_for_customer`
- Customer receives notification: "Engineer needs information from you"
- Customer comments in thread providing credentials (sanitized test)

---

### TC-014: Engineer resumes work and marks resolved

**Actor:** Engineer
**Pre-condition:** TC-013 complete. Ticket in `waiting_for_customer`.
**Steps:**
1. On ticket, click "Resume Work" → status back to `work_in_progress`
2. Complete work
3. Click "Mark Resolved"
4. Add resolution note: "DNS records corrected. Email delivery verified."

**Expected:**
- Ticket status changes to `resolved`
- `resolved_at` timestamp set
- Customer receives notification: "Your issue has been resolved"
- Customer sees "Accept Solution" / "Reject Solution" buttons

---

## Module 5 — Resolution Acceptance & Payout

### TC-015: Customer accepts the resolution

**Actor:** Customer
**Pre-condition:** TC-014 complete. Ticket in `resolved` status.
**Steps:**
1. Review resolution note on ticket
2. Click "Accept Solution"
3. Rate engineer: 5 stars
4. Submit

**Expected:**
- CSAT survey saved (score=5)
- Ticket status changes to `closed`
- Activity log: "Resolved" → "Closed"
- Payout record created automatically:
  - `resolution_fee = ₹800`
  - `engineer_amount = ₹520` (₹800 × 0.65)
  - `platform_amount = ₹280` (₹800 × 0.35)
  - `gst_collected = ₹144`
  - `status = pending`
- Engineer receives notification: "Your payout is pending approval"

---

### TC-016: Customer rejects the resolution

**Actor:** Customer
**Pre-condition:** Ticket in `resolved` status (separate test ticket).
**Steps:**
1. Click "Issue Still Exists"
2. Describe the remaining problem: "Emails still bouncing to gmail.com."

**Expected:**
- Ticket status returns to `work_in_progress`
- Activity log: "Resolved" → "Work in Progress"
- `resolved_at` cleared (timestamp reset)
- Engineer notified: "Customer reported issue not resolved"
- No payout created (ticket not closed)

---

## Module 6 — Finance Manager Payouts

### TC-017: Finance Manager views payout queue

**Actor:** Finance Manager
**Pre-condition:** TC-015 complete. Payout in `pending` status.
**Steps:**
1. Login as finance@uat.com
2. Navigate to Finance → Engineer Payouts

**Expected:**
- Payout for engineer@uat.com listed with:
  - Ticket number
  - Resolution Fee: ₹800
  - Engineer Amount: ₹520
  - Platform Amount: ₹280
  - GST Collected: ₹144
  - Status: Pending
- "Mark Paid" button visible

---

### TC-018: Finance Manager marks payout as paid

**Actor:** Finance Manager
**Pre-condition:** TC-017 complete.
**Steps:**
1. Click "Mark Paid" for the pending payout
2. Enter UTR Reference: `UTR20260624001`
3. Add note: "Transferred via NEFT."
4. Click Confirm

**Expected:**
- Payout status changes to `paid`
- `paid_at` timestamp set
- `utr_reference = "UTR20260624001"`
- Engineer receives notification: "Your payout of ₹520 has been processed"

---

### TC-019: Finance Dashboard shows correct totals

**Actor:** Finance Manager
**Pre-condition:** TC-002 and TC-012 payments completed.
**Steps:**
1. Login as finance@uat.com
2. Navigate to Finance → Revenue Dashboard

**Expected:**
- Consulting Revenue: ₹299 (pre-GST)
- Resolution Revenue: ₹800 (pre-GST)
- Total GST Collected: ₹198 (₹54 + ₹144)
- Platform Margin from resolution: ₹280
- Total ResolveHQ Revenue: ₹299 + ₹280 = ₹579
- Engineer Payouts Pending: ₹0 (if TC-018 done), or ₹520 (if not)

---

## Module 7 — Engineer Earnings

### TC-020: Engineer views earnings summary

**Actor:** Engineer
**Pre-condition:** TC-015 complete (ticket closed, payout pending).
**Steps:**
1. Login as engineer@uat.com
2. Navigate to Engineer Dashboard

**Expected:**
- "Expected Earnings" card shows:
  - Pending Payout: ₹520 (1 ticket)
  - Paid to Date: ₹0 (or cumulative if TC-018 done)

---

### TC-021: Engineer earnings update after payout paid

**Actor:** Engineer
**Pre-condition:** TC-018 complete.
**Steps:**
1. Refresh Engineer Dashboard

**Expected:**
- Pending Payout: ₹0
- Paid to Date: ₹520

---

## Module 8 — Edge Cases & Guards

### TC-022: Cannot create quote for unassigned ticket

**Actor:** Engineer
**Pre-condition:** A ticket in `consulting_paid` status (no engineer assigned).
**Steps:**
1. Attempt to POST to `/api/freelancer/tickets/{id}/quote/` directly

**Expected:**
- `400 Bad Request`: "Can only create a quote for tickets in diagnosis_in_progress status."

---

### TC-023: Cannot initiate resolution payment before quote accepted

**Actor:** Customer
**Pre-condition:** Ticket in `consulting_paid` (no quote yet).
**Steps:**
1. Attempt to POST to `/api/tickets/{id}/initiate-resolution-payment/`

**Expected:**
- `400 Bad Request`: "Ticket is not awaiting resolution payment."

---

### TC-024: Cannot pay resolution fee twice

**Actor:** Customer
**Pre-condition:** TC-012 complete. Ticket in `work_in_progress`.
**Steps:**
1. Attempt to POST to `/api/tickets/{id}/initiate-resolution-payment/` again

**Expected:**
- `400 Bad Request`: "Ticket is not awaiting resolution payment."

---

### TC-025: Payout not created for quote_declined ticket

**Actor:** System
**Pre-condition:** TC-010 complete. Ticket in `quote_declined`.
**Steps:**
1. Check `Payout.objects.filter(ticket=ticket).count()`

**Expected:**
- Count = 0 (no payout for declined tickets)

---

### TC-026: Consulting fee paid but resolution declined — no resolution refund

**Actor:** Customer
**Pre-condition:** TC-010 complete. Quote declined.
**Steps:**
1. Login as customer@uat.com
2. View ticket — status is `quote_declined`

**Expected:**
- Consulting fee payment visible: ₹353, `status=completed`
- No refund button (consulting fee is non-refundable)
- Resolution payment: does NOT exist (customer never paid it)

---

### TC-027: Super Admin can perform all actions

**Actor:** Super Admin
**Steps:**
1. Login as admin@uat.com
2. Assign an engineer to a ticket (ops action) → should succeed
3. Approve a quote (ops action) → should succeed
4. Mark a payout paid (finance action) → should succeed
5. Accept a resolution as a customer proxy → **should NOT succeed** (super admin cannot accept on behalf of a customer — this is a customer-only action)

**Expected for step 5:**
- `403 Forbidden`: "Only customers can access this resource."

---

## Module 9 — Analytics Validation

### TC-028: Ops Dashboard shows correct status counts

**Actor:** Ops Manager
**Pre-condition:** Multiple tickets in various states.
**Steps:**
1. Login as ops@uat.com
2. Navigate to Ops Dashboard

**Expected:**
- "Consulting Paid" (or "Open Queue") count matches tickets in `consulting_paid`
- "Quotes Pending" count matches tickets in `quote_pending`
- "Awaiting Payment" count matches tickets in `awaiting_resolution_payment`
- "In Progress" count matches tickets in `work_in_progress`

---

### TC-029: Old "open" status is gone; "consulting_paid" is used

**Pre-condition:** Data migration (0015) ran successfully.
**Steps:**
1. `SELECT COUNT(*) FROM support_app_ticket WHERE status = 'open'` → check on tickets that previously had `status = 'open'`
2. `SELECT COUNT(*) FROM support_app_ticket WHERE status = 'consulting_paid'` → these should be the former "open" tickets

**Expected:**
- No tickets with `status = 'open'` that were previously `open` (they are now `consulting_paid`)
- Newly created tickets start as `open` (new meaning: before consulting fee payment)

---

## Final Sign-Off Checklist

Before marking UAT complete:

- [ ] TC-001 through TC-029 passed
- [ ] No regressions in existing comment system (customer can still comment on all ticket states)
- [ ] No regressions in attachment upload (works on all ticket states)
- [ ] No regressions in existing CSAT / accept-resolution / reject-resolution flows
- [ ] Email notifications sent for: ticket created, consulting fee paid, engineer assigned, quote submitted, quote approved, resolution fee paid, ticket resolved, payout processed
- [ ] Sandbox payment flow works end-to-end for both consulting fee and resolution fee
- [ ] Finance Dashboard numbers reconcile with Payment table totals
- [ ] Engineer earnings update in real time after payout is marked paid
- [ ] All test accounts login successfully
- [ ] No 500 errors in Django logs during any test case
- [ ] Migrations ran cleanly: `python manage.py showmigrations` shows all migrations applied
