# ResolveHQ — Realtime Notification & Activity System Report
_Implemented: 2026-05-22_

---

## Overview

This phase replaced the basic notification UI with a production-grade in-app notification
and activity experience — grouped dropdowns, optimistic updates, relative timestamps,
animated transitions, and a role-aware activity timeline.

---

## What Changed

### Backend

| File | Change |
|---|---|
| `support_app/views.py` | New `GET /api/notifications/unread-count/` — single SQL COUNT, used by the badge poller |
| `support_app/urls.py` | Registered the new endpoint (before the `<uuid:pk>` route) |
| `support_app/serializers.py` | Added `ticket_number` and `ticket_title` to `NotificationSerializer` for client-side navigation |

### Frontend

| File | Change |
|---|---|
| `src/utils/time.js` | New utility: `formatRelativeTime`, `formatAbsoluteTime`, `groupByDate` |
| `src/api/notifications.js` | Added `getUnreadCount()` hitting the new count endpoint |
| `src/hooks/useNotifications.js` | Full rewrite — split into count-only polling + lazy list fetch + optimistic updates |
| `src/components/ui/NotificationBell.jsx` | Full rewrite — see features below |
| `src/components/tickets/ActivityTimeline.jsx` | Full rewrite — see features below |

---

## Feature Breakdown

### Notification Bell

- **Efficient polling**: polls `/notifications/unread-count/` every 30 s — one integer vs fetching 100+ rows
- **Tab-visibility aware**: pauses polling when browser tab is hidden
- **Lazy list**: full notification list only fetched when dropdown is first opened
- **Skeleton loading**: 3 shimmer rows while the list loads
- **Date grouping**: notifications bucketed into **Today / Yesterday / Earlier**
- **Relative timestamps**: "5m ago", "3h ago", "2d ago" — absolute time visible on hover
- **Unread dot + indicator**: blue dot and indigo background on unread rows
- **Animated badge**: `animate-scale-in` fires when count increases
- **Animated dropdown**: `animate-slide-up` on open
- **Click to navigate**: clicking a notification navigates to its ticket page
- **Auto-mark on click**: clicking an unread notification marks it read automatically
- **Optimistic mark-as-read**: local state updates instantly — no spinner wait
- **Optimistic mark-all-read**: clears entire list instantly
- **Rich empty state**: bell icon + "You're all caught up!" message
- **Overflow hint**: footer row when > 20 notifications exist

### Activity Timeline

- **Relative timestamps**: "3h ago" with absolute time in title tooltip
- **Role-aware actor labels**: "you" (current user), "Admin", freelancer email, or "system" (null actor)
- **Status change visuals**: before → after pill badges with colour coding per status
- **Stagger animation**: each entry fades in with 40 ms delay offset
- **Loading skeleton**: 3 shimmer rows instead of a spinner
- **Error state**: inline error with icon
- **Empty state**: 📭 icon + descriptive text
- **Accessible**: `role="list"` landmark, icon `aria-hidden`

---

## Polling Architecture

```
Before: poll /notifications/ every 30s  →  fetch ALL N rows
After:  poll /notifications/unread-count/ every 30s  →  fetch 1 integer
        fetch /notifications/ once on dropdown open  →  full list, cached
```

Network savings: for a user with 50 notifications, each poll was ~5 KB.
Now each poll is ~30 bytes. 99 % reduction in polling payload.

---

## API Contract (unchanged)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/notifications/` | GET | All roles | Full list, newest first. `?unread=true` to filter. |
| `/api/notifications/unread-count/` | GET | All roles | **New.** Returns `{"count": N}` |
| `/api/notifications/{id}/read/` | PATCH | All roles | Mark one notification as read |
| `/api/notifications/mark-all-read/` | POST | All roles | Bulk mark all as read |

---

## Verification

All three roles tested post-implementation:

| Check | Result |
|---|---|
| `GET /api/notifications/unread-count/` — admin, freelancer, customer | 200 ✓ |
| `GET /api/notifications/` includes `ticket_number`, `ticket_title` | ✓ |
| Frontend build (`npm run build`) | ✓ clean, 0 errors |
| Notification list with real test notification | ✓ correct fields |
| Mark-one-read + mark-all-read | ✓ optimistic |
| Role routing unchanged | ✓ |

---

## Not Changed (by design)

- WebSockets / push (deferred to a future phase)
- Dashboard page layouts
- Auth system
- Deployment configs
- Landing page
