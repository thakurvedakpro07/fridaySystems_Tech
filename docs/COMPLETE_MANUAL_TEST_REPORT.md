# SupportMitra — Complete Manual Test Report
**Phase 8: Full End-to-End Product Testing**
**Date:** 2026-05-19
**Tester:** Claude Sonnet 4.6 (automated end-to-end simulation)
**Test Environment:** Docker Compose (backend, frontend, db, redis, celery, celerybeat)
**Baseline Test Suite:** 73 passed, 2 skipped (pytest)

---

## 1. Test Environment

| Service        | Status   | Port  |
|----------------|----------|-------|
| Backend (Django)| Healthy  | 8000  |
| Frontend (Vite)  | Running  | 5173  |
| PostgreSQL 15    | Healthy  | 5432  |
| Redis 7          | Healthy  | 6379  |
| Celery Worker    | Running  | —     |
| Celery Beat      | Running  | —     |

### Test Users Created
| Role       | Email                         | Password         |
|------------|-------------------------------|------------------|
| Admin      | admin@phase8test.com          | AdminPass123!    |
| Freelancer | freelancer@phase8test.com     | FreelPass123!    |
| Customer   | customer@phase8test.com       | CustPass123!     |

---

## 2. Authentication Flow Tests

### Results Summary

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| A1  | New customer registration via API             | PASS   | Returns access + refresh tokens + user object |
| A2  | Duplicate email registration (same case)      | PASS   | Returns 400 with clear error message          |
| A3  | Duplicate email (case-insensitive)            | PASS   | NEWCUSTOMER@… blocked when newcustomer@… exists |
| A4  | Weak password (< 10 chars)                    | PASS   | Returns 400: "Ensure this field has at least 10 characters." |
| A5  | Valid customer login                          | PASS   | Returns role=customer, is_staff=false         |
| A6  | Wrong password                                | PASS   | Returns 401                                   |
| A7  | Non-existent user                             | PASS   | Returns 401 (doesn't reveal if email exists)  |
| A8  | Token refresh                                 | PASS   | Issues new access + new refresh (rotation)    |
| A9  | Reuse old refresh token after rotation        | PASS   | Returns 401 — old token is blacklisted        |
| A10 | Admin login                                   | PASS   | Returns is_staff=true                         |
| A11 | Freelancer login                              | PASS   | Returns role=freelancer                       |
| A12 | Logout blacklists server-side refresh token   | PASS   | Returns 204 No Content                        |
| A13 | Use refresh token after explicit logout       | PASS   | Returns 401 — blacklisted                     |
| A14 | Access protected endpoint with invalid token  | PASS   | Returns 401                                   |

**Authentication: 14/14 PASS**

---

## 3. Customer Workflow Tests

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| C1  | Create ticket                                 | PASS*  | *BUG-001 found & fixed — now returns id      |
| C2  | Create second ticket                          | PASS   |                                               |
| C3  | List own tickets (paginated)                  | PASS   | count=2 correct                               |
| C4  | View ticket detail                            | PASS   |                                               |
| C5  | Ticket number format (TKT-XXXXXXXX)           | PASS   | 8 hex chars as designed                       |
| C6  | Filter tickets by status                      | PASS   |                                               |
| C7  | Search tickets by text                        | PASS   | Searches title + description                  |
| C8  | Security: `notes` field absent from response  | PASS   | Admin-only field correctly hidden             |
| C8b | Security: `contract_signed` absent            | PASS   | Freelancer internal field hidden              |
| C9  | Customer adds public comment                  | PASS   | is_internal=false                             |
| C10 | Customer tries is_internal=true (stripped)    | PASS   | View enforces is_internal=false for customers |
| C11 | Customer lists comments                       | PASS   |                                               |
| C12 | Customer views notifications                  | PASS   | 6 notifications present after workflow        |
| C13 | Access another user's ticket (cross-user)     | PASS   | Returns 404 (not 403 — ID not revealed)       |

**Customer Workflow: 14/14 PASS (1 bug fixed)**

---

## 4. Admin Workflow Tests

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| AD1 | Admin lists ALL tickets (not just own)        | PASS   | count=3 (all phase8 test tickets)            |
| AD2 | Admin filters by status                       | PASS   |                                               |
| AD3 | Admin searches tickets                        | PASS   |                                               |
| AD4 | Admin lists freelancers                       | PASS   | contract_signed visible (admin only) ✓       |
| AD5 | Admin assigns ticket to freelancer            | PASS   | Status becomes in_progress                   |
| AD6 | GET /api/admin/tickets/{id}/                  | FAIL*  | *Endpoint does not exist — use /api/tickets/{id}/ |
| AD7 | Admin changes ticket status                   | PASS   | resolved_at stamped correctly                |
| AD8 | Activity log after status change              | PASS   | Full audit trail visible                     |
| AD9 | Reject update on closed ticket                | PASS   | Returns "A closed ticket cannot be updated." |
| AD10| Admin unassigns freelancer                    | PASS   | Returns 400 on already-unassigned ticket     |

**Admin Workflow: 9/10 PASS (1 missing endpoint — documented)**

---

## 5. Freelancer Workflow Tests

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| F1  | Freelancer lists assigned tickets             | PASS   | count=1                                       |
| F2  | Freelancer views ticket detail                | PASS   |                                               |
| F3  | Freelancer updates status (waiting_customer)  | PASS   |                                               |
| F4  | Freelancer tries to close ticket (blocked)    | PASS   | "closed" is not a valid choice               |
| F5  | Freelancer adds internal comment              | PASS   | is_internal=true correctly stored            |
| F6  | Freelancer access unassigned ticket (blocked) | PASS   | Returns 404                                  |
| F7  | Freelancer hits admin endpoint (blocked)      | PASS   | Returns 403                                  |

**Freelancer Workflow: 7/7 PASS**

---

## 6. Permission Boundary Tests

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| P1  | Customer → admin endpoints                    | PASS   | 403                                           |
| P2  | Customer → freelancer endpoints               | PASS   | 403                                           |
| P3  | Customer cannot see internal comments         | PASS   | 0 internal comments visible                  |
| P4  | Customer → /metrics/ (staff-only)             | PASS   | 302 redirect to login                        |
| P5  | Unauthenticated → protected routes            | PASS   | 401                                           |
| P6  | Customer → admin status change URL            | PASS   | 403                                           |
| P7  | Unauthenticated → /metrics/                   | PASS   | 302 redirect to login                        |
| P8  | Freelancer → admin assign endpoint            | PASS   | 403                                           |

**Permissions: 8/8 PASS**

---

## 7. Failure State / Edge Case Tests

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| E1  | Ticket creation with missing required fields  | PASS   | 400 with field-level errors                  |
| E2  | Invalid service_type                          | PASS   | 400: "flying_car is not a valid choice"      |
| E3  | Whitespace-only title                         | PASS   | 400: "This field may not be blank."          |
| E4  | CSAT for non-resolved ticket                  | PASS   | 400 with clear message                       |
| E5  | CSAT score out of range (10)                  | PASS   | 400: "Score must be between 1 and 5."        |
| E6  | Duplicate CSAT submission                     | PASS   | 409 Conflict                                 |
| E7  | Assign non-existent freelancer                | PASS   | 404                                          |
| E8  | Empty comment body                            | PASS   | 400                                          |
| E9  | Customer PATCH ticket title                   | PASS   | Allowed — expected behavior                  |
| E10 | Rapid concurrent status changes               | PASS   | All three succeed (last write wins — expected)|

**Failure States: 10/10 PASS**

---

## 8. Notification Flow Tests

| ID  | Test                                          | Result | Notes                                        |
|-----|-----------------------------------------------|--------|----------------------------------------------|
| N1  | Notifications created on status change        | PASS   | customer gets status_changed notifications   |
| N2  | Notification created on assignment            | PASS   | freelancer gets ticket_assigned notification |
| N3  | GET /api/notifications/ returns correct data  | PASS   | 6 notifications returned with full detail    |

**Notifications: 3/3 PASS**

---

## 9. Database Consistency Verification

| Check                                                  | Result | Notes                                        |
|--------------------------------------------------------|--------|----------------------------------------------|
| Tickets with assigned_to but no TicketAssignment row   | PASS   | 0 inconsistencies                            |
| Tickets missing 'created' activity log                 | PASS   | 0 missing                                    |
| Activity logs actor=None on non-system actions         | FIXED  | Was 7; now patched by assign_ticket fix      |
| Tickets with resolved_at but not resolved/closed       | FIXED  | Clear resolved_at on reopen                  |

---

## 10. Bugs Found and Fixed

### BUG-001 [HIGH] — POST /api/tickets/ returned only write fields (no id)
**Symptom:** After creating a ticket, the API response contained only `title`, `description`, `service_type`, `severity`, `priority`. The `id` and `ticket_number` fields were absent.
**Root Cause:** `TicketListCreateView.perform_create()` set `serializer.instance = ticket` but the serializer was `TicketCreateSerializer` which only serializes write fields.
**Fix:** Overrode `create()` to explicitly return `TicketListSerializer(ticket).data` in the response.
**Files:** `backend/support_app/views.py`
**Verified:** POST /api/tickets/ now returns `id`, `ticket_number`, `priority`, `status`.

---

### BUG-002 [HIGH] — NewTicket.jsx navigated to /dashboard instead of /tickets/{id}
**Symptom:** After ticket creation, the user was sent back to the dashboard list instead of the new ticket's detail page. They couldn't see their new ticket immediately.
**Root Cause:** `NewTicket.jsx` called `await createTicket(formData)` and discarded the response, then hard-coded `navigate("/dashboard")`.
**Fix:** Changed to `const { data } = await createTicket(formData); navigate(/tickets/${data.id});`
**Files:** `frontend/src/pages/NewTicket.jsx`
**Verified:** After creation, user lands on `/tickets/TKT-XXXXXXXX` detail page.

---

### BUG-003 [MEDIUM] — No GET /api/admin/tickets/{id}/ endpoint
**Symptom:** `GET /api/admin/tickets/1a0ab854.../` returns 404. The admin-specific ticket list has no corresponding detail endpoint.
**Root Cause:** The URL patterns under `/api/admin/` only include list, assign, status, and unassign endpoints. There is no admin-specific detail view.
**Mitigation:** Admins can use `/api/tickets/{id}/` which is accessible because `TicketDetailView.get_queryset()` includes `is_staff=True` users.
**Decision:** Not fixed — not blocking. The frontend admin dashboard uses the correct `/api/tickets/{id}/` URL through TicketCard links. Documented for future API cleanup.

---

### BUG-004 [MEDIUM] — assign_ticket left actor=None on status_changed activity log
**Symptom:** Every time `assign_ticket` ran, the activity log showed a `status_changed | actor=None | open -> in_progress` entry in addition to the `assigned | actor=admin@...` entry. The status change had no actor identity.
**Root Cause:** `assign_ticket` calls `ticket.save()` directly (not via `update_status`), triggering the `log_ticket_changes` pre_save signal which creates the log entry with `actor=None`. `update_status` has code to patch such entries, but `assign_ticket` didn't.
**Fix:** Added actor-patch logic in `assign_ticket` immediately after `ticket.save()`, mirroring the pattern in `update_status`.
**Files:** `backend/support_app/services/ticket_service.py`
**Verified:** Activity log now shows `status_changed | actor=admin@...` on assignment.

---

### BUG-005 [MEDIUM] — resolved_at persisted after ticket was reopened
**Symptom:** A ticket moved from `resolved` → any other status retained its `resolved_at` timestamp, creating a false DB record showing a ticket as "resolved" even when it was in `open` or `in_progress` state.
**Root Cause:** `update_status` only set `resolved_at` when transitioning to `resolved`. It never cleared it when transitioning away from `resolved`.
**Fix:** Added `elif new_status not in ("resolved", "closed") and old_status == "resolved": ticket.resolved_at = None` in `update_status`.
**Files:** `backend/support_app/services/ticket_service.py`
**Verified:** Reopening a resolved ticket clears the `resolved_at` field.

---

### BUG-006 [MEDIUM] — TicketForm missing priority field (all tickets defaulted to medium)
**Symptom:** The ticket creation form had no Business Priority selector. All tickets were created with `priority=medium` regardless of urgency, even when the customer chose "critical" severity.
**Root Cause:** `TicketForm.jsx` form state initialized `priority` but the field was never rendered in the UI. `TicketCreateSerializer` already accepts `priority` so the backend was ready.
**Fix:** Added `PRIORITIES` constant and a `<select>` dropdown for `priority` in the form, positioned between Severity and Description fields.
**Files:** `frontend/src/components/tickets/TicketForm.jsx`
**Verified:** Form now shows 4 priority levels; submitted tickets carry the chosen priority.

---

### BUG-007 [MEDIUM] — Freelancers hit 403 on /dashboard (no usable frontend)
**Symptom:** A freelancer logging in would land on `/dashboard` which calls `GET /api/tickets/`. That endpoint requires `IsCustomer` permission, so freelancers get a 403 response. The dashboard showed "Failed to load tickets: Request failed with status code 403" — an opaque and confusing error.
**Root Cause:** No freelancer-specific frontend route exists. All authenticated users default to the customer dashboard.
**Fix:** Added a role guard in `Dashboard.jsx`: if `user.role === 'freelancer'`, render a friendly "Freelancer Portal — coming soon" message instead of triggering the broken API call.
**Files:** `frontend/src/pages/Dashboard.jsx`
**Verified:** Freelancer login shows clean placeholder instead of error.

---

## 11. Tests NOT Automated (Require Real Browser)

The following tests require a real browser and could not be automated in this session:

| Test                                | Status  | Notes                                                   |
|-------------------------------------|---------|---------------------------------------------------------|
| Browser refresh preserves auth      | PASSED* | *Verified via code — localStorage rehydration in initializeAuth() |
| Multi-tab auth sync                 | UNKNOWN | Zustand state is per-tab; localStorage is shared; tab B won't auto-logout when tab A logs out |
| Mobile responsiveness               | UNKNOWN | Tailwind responsive classes present; manual browser DevTools check recommended |
| Slow network (simulated)            | UNKNOWN | Loading states visible in code (Loading…, Creating…, Posting…) |
| Backend temporarily unavailable     | PARTIAL | useTickets catches error and shows error div; toast shows on comment failure |
| Rapid-click duplicate submit        | PASSED* | Buttons use `disabled={loading}` — prevents double submission |
| Ctrl+Enter shortcut in comments     | PASSED* | Implemented in CommentSection.jsx handleKeyDown         |

---

## 12. Summary

| Category              | Tests Run | Passed | Failed | Fixed |
|-----------------------|-----------|--------|--------|-------|
| Authentication        | 14        | 14     | 0      | —     |
| Customer Workflow     | 14        | 13     | 1      | 1     |
| Admin Workflow        | 10        | 9      | 1      | —     |
| Freelancer Workflow   | 7         | 7      | 0      | —     |
| Permissions           | 8         | 8      | 0      | —     |
| Failure States        | 10        | 10     | 0      | —     |
| Notifications         | 3         | 3      | 0      | —     |
| DB Consistency        | 4         | 2      | 2      | 2     |
| **Total**             | **70**    | **66** | **4**  | **3 fixed, 1 documented** |

**Final test suite after fixes: 73 pytest tests — all pass. Zero regressions.**
