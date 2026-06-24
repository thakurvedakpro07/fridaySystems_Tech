# ResolveHQ — Workflow Test Report
**Date:** 2026-06-23  
**Scope:** 5-issue bug fix pass following manual end-to-end workflow testing

---

## Summary

| Issue | Title | Status |
|---|---|---|
| #1 | Customer Dashboard "Failed to Load Tickets" | ✅ Fixed |
| #2 | Operations Dashboard Summary Incorrect | ✅ Fixed |
| #3 | Staff Login Routing | ✅ Already fixed (prior session) |
| #4 | Microsoft 365 Service Missing | ✅ Fixed |
| #5 | Engineer Assignment Dropdown Empty | ✅ Fixed |

---

## Issue #1 — Customer Dashboard "Failed to Load Tickets"

### Root Cause

`frontend/src/pages/Dashboard.jsx:396` contained a stale guard:

```js
if (user?.is_staff) return <Navigate to="/admin" replace />;
```

Only `is_staff=True` (Super Admin) was redirected away. The three new staff roles — `operations_manager`, `finance_manager`, `support_agent` — all have `is_staff=False`. Any of these users navigating to `/dashboard` passed this guard, reached `CustomerDashboard`, and triggered a call to `GET /api/tickets/`. That endpoint has `IsCustomer` permission and returns 403, causing the error banner.

**Confirmed evidence:**
```
curl /api/tickets/ as ops@resolvehq.dev → 403 "Only customers can access this resource."
```

### Fix

**File:** `frontend/src/pages/Dashboard.jsx`

```js
// BEFORE
if (user?.is_staff) return <Navigate to="/admin" replace />;

// AFTER
const STAFF_ROLES = ["admin", "operations_manager", "finance_manager", "support_agent"];
if (STAFF_ROLES.includes(user?.role)) return <Navigate to="/operations" replace />;
```

All 4 staff roles are now redirected to `/operations` before any API call is made.

### APIs Affected

- `GET /api/tickets/` — no change to backend; frontend now prevents unauthorized calls

---

## Issue #2 — Operations Dashboard "All Open Tickets Assigned"

### Root Cause

`backend/support_app/views.py` — `ops_dashboard` function:

```python
revenue = Payment.objects.filter(status="completed").aggregate(
    total=Coalesce(Sum("amount"), 0)   # BUG
)["total"]
```

`Sum("amount")` returns `DecimalField`. The fallback `0` is `IntegerField`. Django 4.x raises:

```
FieldError: Expression contains mixed types: DecimalField, IntegerField. You must set output_field.
```

This caused `GET /api/ops/dashboard/` to return **500**. The OpsDashboard component runs both calls in `Promise.all([getOpsDashboard(), getOpsTickets()])`. When `getOpsDashboard()` throws 500, the entire Promise rejects; the catch block runs; `setOpenTickets` is never called; `openTickets` stays `[]` → "All open tickets are assigned" appears.

**Confirmed evidence:**
```
curl /api/ops/dashboard/ as ops@resolvehq.dev → 500 "An unexpected error occurred."
curl /api/ops/tickets/?status=open             → 4 tickets (endpoint itself worked fine)
```

### Fix

**File:** `backend/support_app/views.py`

```python
# BEFORE
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce

revenue = Payment.objects.filter(status="completed").aggregate(
    total=Coalesce(Sum("amount"), 0)
)["total"]

# AFTER
from decimal import Decimal
from django.db.models import Count, DecimalField, Sum, Value
from django.db.models.functions import Coalesce

revenue = Payment.objects.filter(status="completed").aggregate(
    total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
)["total"]
```

### APIs Affected

- `GET /api/ops/dashboard/` — now returns 200 with correct aggregated stats

**Post-fix evidence:**
```
curl /api/ops/dashboard/ → 200 | open: 4 | revenue: 40299.0
```

---

## Issue #3 — Staff Login Routing

### Status: Already Fixed (prior session)

**Confirmed evidence** — both files contain correct role-based routing:

`Login.jsx:37–45`:
```js
const staffRoles = ["admin", "operations_manager", "finance_manager", "support_agent"];
if (staffRoles.includes(result.role)) navigate("/operations");
else if (result.role === "freelancer") navigate("/freelancer");
else navigate("/dashboard");
```

`App.jsx PublicOnlyRoute`:
```js
if (staffRoles.includes(user?.role)) return <Navigate to="/operations" replace />;
if (user?.role === "freelancer") return <Navigate to="/freelancer" replace />;
return <Navigate to="/dashboard" replace />;
```

No changes required.

---

## Issue #4 — Microsoft 365 Service Missing

### Root Cause

Two independent hardcoded lists both lacked Microsoft 365:

1. `backend/support_app/models.py:273` — `Ticket.SERVICE_CHOICES` — 7 types, no `microsoft365`
2. `backend/support_app/views.py:321` — `services_list()` — same 7 types hardcoded in API response

The frontend `TicketForm` calls `GET /api/services/` and renders whatever the backend returns. The marketing `ServicesPage.jsx` shows "Microsoft 365 Support" as a feature, but the actual ticket creation form never offered it — a false promise to customers.

### Fix

**File 1:** `backend/support_app/models.py`
```python
SERVICE_CHOICES = [
    ...
    ("microsoft365", "Microsoft 365 / Exchange"),  # added
]
```

**File 2:** `backend/support_app/views.py` — `services_list()` endpoint
```python
{"key": "microsoft365", "name": "Microsoft 365 / Exchange", "resolution_fee": 1299},  # added
```

**File 3:** `backend/support_app/migrations/0013_add_microsoft365_service.py` — generated `AlterField` migration (zero downtime, choices-only change)

**File 4:** `frontend/src/pages/AnalyticsPage.jsx`
```js
microsoft365: "Microsoft 365",  // added to SERVICE_LABELS
```

### APIs Affected

- `GET /api/services/` — now includes microsoft365 entry

**Post-fix evidence:**
```
curl /api/services/ → [..., {"key": "microsoft365", "name": "Microsoft 365 / Exchange", "resolution_fee": 1299}]
```

---

## Issue #5 — Engineer Assignment Dropdown Empty

### Root Cause (Primary — confirmed)

`frontend/src/pages/ops/OpsTicketQueue.jsx:197`:

```js
const res = await getOpsFreelancers({ availability: "available" });  // BUG
```

`"available"` is not a valid `AVAILABILITY_CHOICES` value. Valid values: `full_time`, `part_time`, `ad_hoc`, `unavailable`. The backend applied `qs.filter(availability="available")` → 0 rows.

**Confirmed evidence:** All 8 demo engineers have `full_time`, `part_time`, or `ad_hoc` availability — none matched `"available"`.

### Root Cause (Secondary)

`OpsFreelancerListView` filtered by `onboarding_status="approved"` only. Missing `active=True` — deactivated engineers could appear in the assignment dropdown.

### Root Cause (Tertiary)

`OpsTicketListView` used `TicketListSerializer` which lacks `freelancer`/`assigned_to` field. `OpsTicketQueue.jsx` reads `t.freelancer?.id` and `t.freelancer?.name` to pre-populate the reassignment modal. With these fields undefined, every ticket showed "Assign" (never "Reassign") and no pre-selection appeared in the modal.

### Fix

**File 1:** `frontend/src/pages/ops/OpsTicketQueue.jsx`
```js
// BEFORE
const res = await getOpsFreelancers({ availability: "available" });
// AFTER
const res = await getOpsFreelancers();
```

**File 2:** `backend/support_app/views.py` — `OpsFreelancerListView`
```python
# BEFORE
qs = Freelancer.objects.filter(onboarding_status="approved")
# AFTER
qs = Freelancer.objects.filter(onboarding_status="approved", active=True)
```

**File 3:** `backend/support_app/serializers.py` — new `OpsTicketListSerializer`
```python
class OpsTicketListSerializer(TicketListSerializer):
    freelancer = serializers.SerializerMethodField()

    def get_freelancer(self, obj):
        if not obj.assigned_to:
            return None
        u = obj.assigned_to.user
        return {
            "id": str(obj.assigned_to.id),
            "name": f"{u.first_name} {u.last_name}".strip() or u.email,
            "email": u.email,
        }

    class Meta(TicketListSerializer.Meta):
        fields = TicketListSerializer.Meta.fields + ["freelancer"]
```

**File 4:** `backend/support_app/views.py` — `OpsTicketListView`
```python
serializer_class = OpsTicketListSerializer   # was: TicketListSerializer
```

### APIs Affected

- `GET /api/ops/freelancers/` — now returns all active+approved engineers
- `GET /api/ops/tickets/` — response now includes `freelancer` object per ticket

**Post-fix evidence:**
```
curl /api/ops/freelancers/ → 9 engineers (Arjun Verma, Kavita Rao, ...)
curl /api/ops/tickets/?status=open → results[0].freelancer key present: True
```

---

## Migration Log

| Migration | Applied | Type |
|---|---|---|
| `0009_add_operations_manager_role` | 2026-06-23 | AlterField |
| `0010_role_management` | 2026-06-23 | AlterField |
| `0011_add_new_roles` | 2026-06-23 | AlterField |
| `0012_add_escalated_action` | 2026-06-23 | AlterField |
| `0013_add_microsoft365_service` | 2026-06-23 | AlterField — adds `microsoft365` to `Ticket.service_type` choices |

---

## Files Changed

| File | Issue | Change |
|---|---|---|
| `frontend/src/pages/Dashboard.jsx` | #1 | `is_staff` guard → `STAFF_ROLES` array, redirect to `/operations` |
| `backend/support_app/views.py` | #2, #5 | Fix `Coalesce` decimal type; add `active=True` to freelancer query; swap to `OpsTicketListSerializer` |
| `backend/support_app/models.py` | #4 | Add `microsoft365` to `SERVICE_CHOICES` |
| `backend/support_app/migrations/0013_add_microsoft365_service.py` | #4 | Auto-generated `AlterField` |
| `backend/support_app/serializers.py` | #5 | Add `OpsTicketListSerializer` |
| `frontend/src/pages/ops/OpsTicketQueue.jsx` | #5 | Remove invalid `availability: "available"` param |
| `frontend/src/pages/AnalyticsPage.jsx` | #4 | Add `microsoft365: "Microsoft 365"` to `SERVICE_LABELS` |

---

## End-to-End Workflow Verification

### API-level results

| Check | Result |
|---|---|
| `GET /api/ops/dashboard/` as ops manager | ✅ 200 — `open: 4, revenue: 40299.0` |
| `GET /api/ops/tickets/?status=open` | ✅ 4 results with `freelancer` field |
| `GET /api/ops/freelancers/` | ✅ 9 engineers returned |
| `GET /api/services/` | ✅ `microsoft365` present |
| `GET /api/tickets/` as customer | ✅ 200 — `count: 1` |
| `GET /api/tickets/` as ops manager | ✅ 403 (correct — not a customer) |

### Full workflow steps

1. **Customer logs in** → `/dashboard` ✅ (correct landing page)
2. **Customer creates ticket** → Microsoft 365 / Exchange now available in service dropdown ✅
3. **Payment recorded** → ticket moves to `open` status ✅
4. **Ops Manager logs in** → `/operations` ✅ (correct landing page; no /dashboard redirect)
5. **Ops Manager opens dashboard** → KPI cards populate correctly (500 fixed) ✅
6. **Ops Manager opens ticket queue** → open tickets visible with assignment status ✅
7. **Ops Manager assigns ticket** → engineer dropdown shows 9 engineers ✅
8. **Engineer logs in** → `/freelancer` ✅ (correct landing page)
9. **Engineer sees ticket** → appears in freelancer ticket list ✅
10. **Engineer updates status** → customer-facing ticket detail updates ✅
11. **Ticket resolved** → visible on customer dashboard ✅

---

## Remaining Known Issues

None. All 5 reported issues are resolved and verified.
