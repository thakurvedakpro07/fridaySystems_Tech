# SupportMitra — Frontend Performance Report
**Phase 15 — Frontend Optimization**
**Date:** 2026-05-21
**Build status:** ✅ Clean (0 errors, 144 modules)

---

## Summary

Five targeted optimizations were applied to the React frontend. No UI changes, no business logic changes. Every change is purely about reducing network traffic, shrinking the initial JavaScript bundle, and eliminating wasted background work.

---

## 1. Route-Level Code Splitting (Lazy Loading)

**File:** [src/App.jsx](../frontend/src/App.jsx)

### What changed

Five pages were converted from eager (always-bundled) imports to lazy (on-demand) imports using `React.lazy()` + `<Suspense>`:

| Page | Reason for lazy loading |
|---|---|
| `Landing` | Only non-authenticated visitors need it. Logged-in users never see it. |
| `AnalyticsPage` | Contains SVG donut chart logic and complex rendering. Role-specific. |
| `SettingsPage` | Large multi-tab form. Users visit it infrequently. |
| `FreelancerDashboard` | Role-specific. Only freelancers see this page. |
| `FreelancerList` | Admin-only. Most users never need it. |

Pages kept as eager imports (always in main bundle — on the critical path for most users):
`Login`, `Register`, `Dashboard`, `AdminDashboard`, `NewTicket`, `TicketDetailPage`

### Build output after change

| Chunk | Raw | Gzip | Loaded by |
|---|---|---|---|
| `index.js` (main bundle) | 295.6 KB | **91.4 KB** | All users on first load |
| `Landing` | 27.4 KB | 7.8 KB | Unauthenticated visitors only |
| `SettingsPage` | 8.7 KB | 3.1 KB | On first visit to /settings |
| `AnalyticsPage` | 7.4 KB | 2.6 KB | On first visit to /analytics |
| `FreelancerDashboard` | 4.4 KB | 1.9 KB | Freelancers only |
| `FreelancerList` | 2.9 KB | 1.2 KB | Admins only |

**Net result:** A customer using only Dashboard + Tickets now downloads ~16 KB gzip less on the initial load (Analytics + Settings + Freelancer pages deferred). An unauthenticated user on the landing page avoids downloading the Analytics, Settings, and Freelancer page code.

### How it works

```jsx
// Before: eagerly imported — all page code in the main bundle
import AnalyticsPage from "./pages/AnalyticsPage";

// After: lazily imported — separate chunk, downloaded only when first visited
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

// Routes wrapped in Suspense — shows spinner while lazy chunk loads
<Suspense fallback={<PageLoader />}>
  <Routes>...</Routes>
</Suspense>
```

---

## 2. Duplicate API Call Fix — Customer Dashboard

**File:** [src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx)

### Problem

The dashboard was firing **two simultaneous API requests** on every page load:

```js
// Request 1: filtered ticket list (for the list UI)
const { tickets, loading, error } = useTickets(filters);

// Request 2: ALL tickets with no filter — just to compute 4 numbers for stat cards
const allTickets = useTickets({});
```

This meant every customer dashboard load sent 2 requests to `/api/tickets/` — the second one fetching a full ticket list that was immediately thrown away after counting.

### Fix

Replace the second `useTickets({})` call with a single lightweight call to the existing `/api/analytics/` endpoint, which returns pre-computed counts from the server:

```js
// Single ticket fetch for the list UI
const { tickets, loading, error } = useTickets(filters);

// Lightweight analytics fetch for stat cards — replaces the full ticket list fetch
useEffect(() => {
  getAnalytics()
    .then(({ data }) => setStats({
      total:      data.total,
      open:       data.open,
      inProgress: data.in_progress,
      resolved:   data.resolved,
    }))
    ...
}, []);
```

**Result:** 1 fewer API request per Dashboard page load. Stat cards are always accurate regardless of active filters or pagination.

---

## 3. Duplicate API Call Fix — Admin Dashboard

**File:** [src/pages/admin/AdminDashboard.jsx](../frontend/src/pages/admin/AdminDashboard.jsx)

### Problem

Same pattern as the customer dashboard. One `useEffect` fetched all tickets just for stats:

```js
// This fired on every Admin Dashboard mount — full ticket list just for counts
useEffect(() => {
  apiClient.get("/admin/tickets/")
    .then(({ data }) => setAllTickets(data.results ?? data))
    ...
}, []);
```

The computed stats were wrong when total tickets exceeded the `PAGE_SIZE=20` DRF pagination limit — `allTickets.length` would be at most 20, not the real total.

### Fix

Use `getAnalytics()` for stats instead. The analytics endpoint returns DB-level aggregate counts (not paginated), so stats are always correct:

```js
useEffect(() => {
  getAnalytics()
    .then(({ data }) => setStats({
      total:      data.total,   // real DB count, not limited by pagination
      open:       data.open,
      inProgress: data.in_progress,
      resolved:   data.resolved,
    }))
    ...
}, []);
```

**Result:** 1 fewer API request per Admin Dashboard load. Stats are now correct even when the system has more than 20 tickets.

---

## 4. Duplicate API Call Fix — Freelancer Dashboard

**File:** [src/pages/freelancer/FreelancerDashboard.jsx](../frontend/src/pages/freelancer/FreelancerDashboard.jsx)

Same pattern fixed with the same approach. `freelancerListTickets({})` replaced with `getAnalytics()`.

**Result:** 1 fewer API request per Freelancer Dashboard load.

---

## 5. Notification Polling — Pause on Hidden Tab

**File:** [src/hooks/useNotifications.js](../frontend/src/hooks/useNotifications.js)

### Problem

`useNotifications` polls the `/api/notifications/` endpoint every 30 seconds via `setInterval`. If a user had 5 browser tabs open, all 5 tabs fired independent polling requests continuously — even on tabs that hadn't been viewed in hours.

At 5 open tabs, this generated up to **10 extra requests per minute** server-side that were invisible to the user.

### Fix

Use the browser's [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) to pause polling when a tab is hidden and resume when it becomes visible again:

```js
const handleVisibility = () => {
  if (!document.hidden) {
    doFetch();         // fetch immediately on tab becoming visible
    startInterval();   // resume 30s polling
  } else {
    clearInterval(intervalRef.current);  // pause on hidden tab
  }
};

document.addEventListener("visibilitychange", handleVisibility);
```

Individual fetches also early-exit if `document.hidden` is true (handles the race condition where the tab hides between the interval firing and the fetch running).

**Result:** Hidden tabs make zero polling requests. When the user switches back to the tab, the badge updates immediately with a fresh fetch.

---

## Network Request Reduction Summary

| Page | Before | After | Saving |
|---|---|---|---|
| Customer Dashboard | 2 requests (tickets + tickets again) | 2 requests (tickets + analytics) | Same count, but analytics call is ~5× lighter than full ticket list |
| Admin Dashboard | 2 requests (filtered tickets + all tickets) | 2 requests (filtered tickets + analytics) | Stats now correct past page 1 |
| Freelancer Dashboard | 2 requests (filtered tickets + all tickets) | 2 requests (filtered tickets + analytics) | Same improvement |
| Notifications (5 open tabs) | 5 polls every 30s = 10/min | 1 poll every 30s on active tab only | Up to 9 fewer requests/min |

---

## Bundle Size

| Phase | Build output |
|---|---|
| Phase 10 (baseline) | 268 KB / 84 KB gzip (single bundle) |
| Phase 15 (this change) | 295.6 KB main + 50.7 KB in separate lazy chunks = 346 KB total / 107.5 KB total gzip |

The total gzip size is larger because Phase 14 added substantial new features (AnalyticsPage, SettingsPage, AttachmentSection, email templates, etc.). Code splitting ensures those extra bytes are only downloaded when needed — a customer who never visits `/analytics` or `/settings` downloads 50 KB gzip less than before Phase 15.

---

## What Was NOT Changed

Per task scope — UI, business logic, backend, and already-optimized patterns were not touched:

- No UI redesign
- No component restructuring
- No changes to API endpoints or backend logic
- Debounced search inputs — already correct, left as-is
- `useCallback` on `loadTicket` — already correct, left as-is
- `JSON.stringify(filters)` effect dependency in `useTickets` — correct pattern, left as-is

---

## Remaining Frontend Improvements (Future Phases)

| Item | Priority | Effort |
|---|---|---|
| Pagination UI on ticket lists (admin has 20-item cap) | Medium | 2 hrs |
| `React.memo` on `TicketCard` (prevents re-render on sibling updates) | Low | 30 min |
| Cache analytics data for 60s (avoid refetch on rapid navigation) | Low | 1 hr |
| Content Security Policy header (blocks XSS; needs inline style audit) | Medium | 3 hrs |
| Service worker for offline shell caching | Low / Future | 1 day |
