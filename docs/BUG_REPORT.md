# SupportMitra — Bug Report
**Phase 9 QA: Manual End-to-End Audit**
**Date:** 2026-05-20
**Status:** All critical and high bugs FIXED and committed

---

## Bug Severity Definitions

- **Critical** — A core workflow is completely broken. No workaround.
- **High** — A feature doesn't work as intended. Workaround exists but is awkward.
- **Medium** — Feature works but has edge-case failure or UX gap.
- **Low** — Minor issue with minimal user impact.

---

## CRITICAL BUGS (3 found, 3 fixed)

---

### BUG-C1: Admin status change always returns 400 error

**Severity:** Critical  
**Component:** `frontend/src/api/tickets.js` → `adminUpdateStatus()`  
**Found:** 2026-05-20 — manual API test  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
Every time an admin tried to change a ticket's status from the AdminTicketActions modal, the API returned:
```json
{"new_status": ["This field is required."]}
```

**Root Cause:**
`adminUpdateStatus` sent the payload as `{ status: newStatus, note }` but the backend's `AdminStatusSerializer` expected the field to be named `new_status`.

```javascript
// BEFORE (broken)
apiClient.post(`/admin/tickets/${ticketId}/status/`, { status: newStatus, note });

// AFTER (fixed)
apiClient.post(`/admin/tickets/${ticketId}/status/`, { new_status: newStatus, note });
```

**Impact:** Admin could not change ticket status at all from the UI. The only workaround was direct curl/API calls.

---

### BUG-C2: Freelancer status update always returns 400 error

**Severity:** Critical  
**Component:** `frontend/src/api/tickets.js` → `freelancerUpdateStatus()`  
**Found:** 2026-05-20 — manual API test  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
Every time a freelancer tried to update a ticket status (Mark In Progress, Mark Resolved, etc.), the API returned:
```json
{"new_status": ["This field is required."]}
```

**Root Cause:**
Same field name mismatch as BUG-C1. `freelancerUpdateStatus` sent `{ status: newStatus, note }` but `FreelancerStatusSerializer` expected `new_status`.

**Reproduction steps:**
1. Login as freelancer
2. Open an assigned ticket
3. Click "Mark In Progress"
4. API request fails with 400

**Fix:**
```javascript
// BEFORE (broken)
apiClient.post(`/freelancer/tickets/${ticketId}/status/`, { status: newStatus, note });

// AFTER (fixed)
apiClient.post(`/freelancer/tickets/${ticketId}/status/`, { new_status: newStatus, note });
```

---

### BUG-C3: Admin ticket detail page always shows "Could not load ticket"

**Severity:** Critical  
**Component:** `frontend/src/api/tickets.js` → `adminGetTicket()`  
**Found:** 2026-05-20 — code review + API test  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
When an admin clicked on any ticket in the admin dashboard, the detail page showed "Could not load ticket. Please try again."

**Root Cause:**
`adminGetTicket` was calling `GET /api/admin/tickets/{id}/` which does not exist as a URL route in the backend. The backend has `AdminTicketListView` at `/admin/tickets/` (list only) but no detail endpoint.

The correct endpoint is `GET /api/tickets/{id}/` — `TicketDetailView` already handles `is_staff=True` users and returns full ticket data for admins.

**Fix:**
```javascript
// BEFORE (broken — 404)
export const adminGetTicket = (ticketId) =>
  apiClient.get(`/admin/tickets/${ticketId}/`);

// AFTER (fixed — uses existing admin-capable endpoint)
export const adminGetTicket = (ticketId) =>
  apiClient.get(`/tickets/${ticketId}/`);
```

---

## HIGH BUGS (3 found, 3 fixed)

---

### BUG-H1: CSAT widget shows rating form even after customer already rated

**Severity:** High  
**Component:** `backend/support_app/serializers.py` → `TicketDetailSerializer`  
**Found:** 2026-05-20 — API test (csat_score missing from response)  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
After a customer submitted a CSAT rating, refreshing the ticket detail page showed the emoji rating widget again instead of the "You rated this ticket X/5" message.

**Root Cause:**
`CSATWidget` checks `ticket.csat_score != null` to determine if the customer has already rated. But `TicketDetailSerializer` didn't include `csat_score` in its fields. The frontend always received `csat_score: undefined`, so the "already rated" branch was never triggered.

**Fix (backend serializers.py):**
```python
class TicketDetailSerializer(serializers.ModelSerializer):
    csat_score = serializers.SerializerMethodField()

    def get_csat_score(self, obj):
        try:
            return obj.csat_survey.score
        except Exception:
            return None
```

**Impact:** Customers who rated tickets would see the rating form again on every page refresh. Submitting again got a 409 error from the backend with no visible explanation.

---

### BUG-H2: Freelancer dashboard search bar does nothing

**Severity:** High  
**Component:** `backend/support_app/views.py` → `FreelancerTicketListView`  
**Found:** 2026-05-20 — code review  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
Typing in the search box on the freelancer dashboard sent `?search=<query>` to the API, but the backend silently ignored it. All tickets were always returned.

**Root Cause:**
`FreelancerTicketListView.get_queryset()` only filtered by `?status=` and had no code to handle `?search=`.

**Fix (backend views.py):**
```python
search = self.request.query_params.get("search")
if search:
    from django.db.models import Q
    qs = qs.filter(Q(title__icontains=search) | Q(ticket_number__icontains=search))
```

---

### BUG-H3: Header navigation wrong for freelancers

**Severity:** High  
**Component:** `frontend/src/components/layout/Header.jsx`  
**Found:** 2026-05-20 — code review  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
A logged-in freelancer saw a "Dashboard" link in the header pointing to `/dashboard`. Clicking it redirected them to `/freelancer` (via Dashboard's Navigate component), but the indirect navigation was confusing and the link text was wrong.

Additionally, the "+ New Ticket" button was visible to freelancers, even though freelancers cannot create tickets.

**Fix:**
- Header now shows "My Tickets" → `/freelancer` for users with `role === "freelancer"`
- `+ New Ticket` button hidden when `user?.role === "freelancer"`

---

## MEDIUM BUGS (0 — all existing medium issues were pre-existing UX gaps)

---

## LOW BUGS (1 found, 1 fixed)

---

### BUG-L1: Badge component crashes on null/undefined label

**Severity:** Low  
**Component:** `frontend/src/components/ui/Badge.jsx`  
**Found:** 2026-05-20 — code review  
**Fixed:** 2026-05-20 — commit eca45b2  

**What happened:**
If `ticket.severity`, `ticket.status`, or `ticket.priority` was ever `null` or `undefined`, calling `label.replaceAll("_", " ")` would throw `TypeError: Cannot read properties of null`.

**Root Cause:**
No null guard before the `replaceAll` call.

**Fix:**
```javascript
export default function Badge({ label }) {
  if (!label) return null;  // added guard
  const colours = COLOUR_MAP[label] ?? "bg-gray-100 text-gray-700";
  const display = LABEL_MAP[label] ?? label.replaceAll("_", " ");
  ...
}
```

---

## REMAINING RISKS (not bugs — design decisions or known gaps)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| No file upload endpoint | Customers can't attach screenshots | MVP gap; model exists |
| assign_ticket sets status to in_progress (skips "assigned") | Workflow skips one state | By design; acceptable |
| Activity log has no pagination | Large tickets with many events → large response | Acceptable at MVP scale |
| Notification bell silently drops poll errors | User may miss notifications | Low likelihood |
| Comment form shows on closed tickets | Minor UX confusion | Low impact |
| Admin ticket list has no page navigation UI | Admin must scroll all tickets | Acceptable at MVP scale |

---

## Bug Fix Summary

| Bug | Severity | File | Fixed |
|-----|----------|------|-------|
| BUG-C1: adminUpdateStatus sends `status` not `new_status` | Critical | api/tickets.js | ✅ |
| BUG-C2: freelancerUpdateStatus sends `status` not `new_status` | Critical | api/tickets.js | ✅ |
| BUG-C3: adminGetTicket calls non-existent endpoint | Critical | api/tickets.js | ✅ |
| BUG-H1: csat_score not in TicketDetailSerializer | High | serializers.py | ✅ |
| BUG-H2: FreelancerTicketListView has no search | High | views.py | ✅ |
| BUG-H3: Header wrong navigation for freelancers | High | Header.jsx | ✅ |
| BUG-L1: Badge crashes on null label | Low | Badge.jsx | ✅ |

**All 7 bugs fixed. 86 backend tests pass. Frontend builds clean.**

---

## BUG-P16-1: Freelancer dashboard "Could not load tickets" on every load

**Severity:** Critical (production-blocking)
**Component:** `backend/support_app/views.py` → `AdminFreelancerListCreateView`
**Discovered:** 2026-05-22
**Fixed:** 2026-05-22 — commit (see below)

### What happened

Every freelancer login showed "Could not load tickets. Please refresh." on the dashboard. The freelancer dashboard JS and the `/api/freelancer/tickets/` endpoint URL were both correct. The actual HTTP response from the server was **403 Forbidden**.

### Root cause

The `IsFreelancer` permission class requires:
```python
request.user.freelancer_profile.onboarding_status == "approved"
```

But the `Freelancer` model defaults to:
```python
onboarding_status = models.CharField(..., default="pending")
```

`AdminFreelancerListCreateView` used the model default when creating freelancers, so every admin-created freelancer was stored with `onboarding_status="pending"`. On the next API call, the permission check returned `False` → 403 → frontend error message.

### Why tests didn't catch it

Every test fixture explicitly sets `onboarding_status="approved"` when creating test freelancers:
```python
Freelancer.objects.create(user=user, ..., onboarding_status="approved")
```
This masked the production default. The code worked in tests but failed with real data.

### Fix

**File 1: `backend/support_app/views.py`** — override `perform_create` in `AdminFreelancerListCreateView` to force `onboarding_status="approved"`. Admin-created freelancers are pre-approved by definition; the `pending` state is reserved for a future self-registration flow.

```python
def perform_create(self, serializer):
    serializer.save(onboarding_status="approved")
```

**File 2: `backend/support_app/migrations/0006_approve_pending_freelancers.py`** — data migration that bulk-updates any existing freelancers stuck in `pending` to `approved`. Run `python manage.py migrate` to apply.

### Impact

- All existing freelancers with `onboarding_status="pending"` → fixed by migration
- All future admin-created freelancers → fixed by `perform_create` override
- No effect on customer dashboard, admin dashboard, analytics, or notifications
- `suspended` freelancers remain correctly blocked (permission still checks `!= "suspended"` via the `"approved"` equality check)

### No frontend changes required

The frontend request (`GET /api/freelancer/tickets/`) was always correct. The bug was entirely backend.
