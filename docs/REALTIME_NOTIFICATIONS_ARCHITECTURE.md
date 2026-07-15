# Realtime Notifications & Live-Update Architecture — Audit & Phased Plan

**Status:** AUDIT COMPLETE — AWAITING APPROVAL. Do not implement until approved.
**Scope:** ResolveHQ (SupportMitra) — in-app notifications, dashboard live-update mechanisms, and the Redis/Celery infrastructure that would carry a future real-time push layer.
**Audit date:** 2026-07-15
**Audited by:** Principal SaaS Product Architect / Senior React Engineer / Senior Django Engineer / ServiceNow Product Architect (combined review)

---

## 1. Executive Summary

ResolveHQ has a **mature, well-designed polling-based notification system** and a **production-grade Redis/Celery background-processing layer**, but **no real-time push mechanism** (no WebSockets, no Server-Sent Events, no pub/sub). Every "live" surface in the product — the notification bell, the ticket detail auto-refresh, the engineer workspace, and the in-flight Operations Command Center dashboard — relies on client-side `setInterval` polling, reimplemented independently in four places with no shared abstraction.

The infrastructure needed to add real push already exists in the stack (Redis is running, Celery workers are running, `asgi.py` was stubbed out on day one specifically for this purpose) — it is simply unused for that purpose today. This means the upgrade path is additive, not a rearchitecture: Redis gains a second role (channel layer, alongside its existing broker/cache roles), Celery tasks gain a "also push over the socket" step, and the frontend gains a socket hook that degrades gracefully back to the existing polling hook.

Separately, this audit surfaced an **in-flight, uncommitted feature** — the Operations Command Center — whose backend (`ops_command_center_service.py`, committed) already encodes the exact "core vs. live" data-freshness split this plan formalizes, but whose frontend polling wiring was never finished. Phase 1 of this plan both fixes the architectural gap (a shared polling hook) and finishes that feature, so the phased work has a concrete, visible payoff immediately rather than only at Phase 3's WebSocket payoff.

**Recommendation:** proceed through Phase 1 (shared polling hook + finish Command Center) and Phase 2 (decouple notification writes from the request path) largely independent of whether Phases 3–4 (WebSocket push) are ever pursued — they are good practice regardless. Phases 3–4 are the "real-time" upgrade proper and carry the only infrastructure-topology risk in this plan (a WSGI→ASGI serving change). Recommend a go/no-go checkpoint before Phase 3.

---

## 2. Current Architecture

### 2.1 Backend

| Layer | State |
|---|---|
| **Web server** | Gunicorn, `worker_class = "sync"`, WSGI only (`backend/gunicorn.conf.py:25`). The file's own comment says: *"Switch to gevent or gthread only if you add async views or websockets."* — i.e. today's server cannot hold open a long-lived connection per the current config. |
| **ASGI entrypoint** | `backend/supportmitra/asgi.py` exists but is a bare `get_asgi_application()` stub. Docstring: *"Needed for future WebSocket support (real-time ticket updates). Not used at MVP — Gunicorn uses wsgi.py instead."* This was deliberately scaffolded for this exact upgrade and never built out. |
| **Notification model** | `support_app/models.py:910` — `Notification`. One row per (event, recipient) pair — fan-out at write time, not a shared "read-by" join table. 6 categories (`ticket_assigned`, `ticket_resolved`, `comment_added`, `status_changed`, `sla_breach`, `payment_confirmed`). Indexed on `(recipient, is_read)` specifically to make the unread-count query cheap. |
| **Notification API** | `GET /api/notifications/` (list, paginated), `GET /api/notifications/unread-count/` (single COUNT), `PATCH /api/notifications/{id}/read/`, `POST /api/notifications/mark-all-read/`. All `IsAuthenticated`, scoped to `recipient=request.user`. |
| **Notification dispatch** | `support_app/services/notification_service.py::create_notification()` — single function, called synchronously from inside the HTTP request/response cycle at ~7 call sites across `views.py` (ticket assignment, comment, status change, SLA breach, payment confirmation). |
| **Celery** | Real worker + beat infrastructure. `backend/supportmitra/celery.py` configures the app; `CELERY_BEAT_SCHEDULE` (settings.py:273) runs `check_sla_breaches` every 5 minutes via `django-celery-beat`'s `DatabaseScheduler` (schedule editable from Django admin). Two existing async tasks — `send_ticket_opened_email`, `send_ticket_assigned_notification` — use `@shared_task(bind=True, max_retries=3, default_retry_delay=60)` with proper retry/backoff. **Notification creation does not use this pattern** — it's plain synchronous Python calls, not `.delay()`. |
| **Redis** | `REDIS_URL` backs three separate concerns today: Celery broker, Celery result backend, and Django's cache backend (`CACHES["default"]`, settings.py:281). **Not** used as a pub/sub channel layer — that would be a new, additive role for the same Redis instance. |
| **Throttling** | Global DRF throttle: `user: 100/minute`, `anon: 20/minute`. Dedicated scopes exist for auth, password-change, analytics (`analytics: 30/hour`), and AI assistant — but **no dedicated scope for `/notifications/*` or `/ops/command-center/*`**; both currently fall back to the generous global default. |

### 2.2 Frontend

| Surface | Mechanism | File |
|---|---|---|
| Notification bell badge | 30s poll of `/notifications/unread-count/`, **pauses on `document.hidden`**, cancel-ref guarded | `hooks/useNotifications.js` |
| Notification list | Lazy-fetched once, on first dropdown open (not part of the poll) | `hooks/useNotifications.js` / `components/ui/NotificationBell.jsx` |
| Ticket detail auto-refresh | 30s poll, gated to `status === "open" && role === "customer"`, **no tab-visibility awareness** | `pages/TicketDetailPage.jsx:52` |
| Engineer workspace | Unconditional 30s poll of active tickets, **no tab-visibility awareness** | `pages/freelancer/EngineerWorkspace.jsx:149` |
| SLA countdown display | 30s local re-render tick (not a network poll) | `hooks/useCountdown.js` |
| Operations Command Center | **Not yet wired.** See §5. | — |

There is **no shared `usePolling`/`useInterval` hook** — each of the three network-polling implementations above hand-rolls its own `setInterval`/`clearInterval`/cleanup, and two of the three never learned `useNotifications`' tab-visibility-pause trick.

### 2.3 Infrastructure (Docker Compose)

```
db (Postgres) ─┐
redis ─────────┼─→ backend (Gunicorn/WSGI, :8000)
               ├─→ celery (worker)
               └─→ celerybeat (DatabaseScheduler)
frontend (Vite, :5173) → proxies /api/* to backend
```

All services have real healthchecks (`celery inspect ping` for the worker, `/proc/1/cmdline` grep for beat). Redis persists via `--appendonly yes` + named volume. This is a solid, already-production-shaped base to extend rather than replace.

---

## 3. Audit Findings

| # | Area | Finding |
|---|---|---|
| F1 | Real-time transport | No WebSocket/SSE exists anywhere in the codebase. `channels` / `channels-redis` are not in `requirements.txt`. |
| F2 | Serving model | Gunicorn is configured `worker_class = "sync"` — explicitly incompatible with holding open long-lived connections. Any WebSocket work requires an ASGI-capable process in addition to (or instead of) today's Gunicorn/WSGI process. |
| F3 | Polling duplication | Three independent, hand-rolled 30s polling `useEffect`s exist (`useNotifications`, `TicketDetailPage`, `EngineerWorkspace`) with no shared hook. |
| F4 | Tab-visibility inconsistency | Only `useNotifications` pauses polling when the browser tab is hidden. The other two poll unconditionally, burning requests (and the shared `user: 100/minute` throttle budget) in backgrounded tabs. |
| F5 | Notification dispatch is synchronous | `create_notification()` runs inline in the request/response cycle, not via Celery, unlike the email-sending tasks that already establish the retry-with-backoff pattern this should follow. |
| F6 | Unbounded fan-out loop | `views.py:2329-2339` (ticket assignment) loops over every active `support_agent`/`operations_manager` and calls `create_notification()` once per staff member — N individual `INSERT`s, no `bulk_create`, no `transaction.atomic()`. Latency scales linearly with staff headcount. |
| F7 | No push after write | A notification is invisible to its recipient until their next 30s poll tick fires — there is no mechanism to deliver it the instant it's created. |
| F8 | Redis underutilized | Redis already runs in the stack for Celery + cache, but is not used as a pub/sub channel layer — the one new role needed for push is a configuration addition to infrastructure that already exists, not new infrastructure. |
| F9 | No dedicated throttle scope for live-ish endpoints | `/notifications/*` and `/ops/command-center/*` share the generic `100/minute` bucket. Fine at today's polling cadence, but undocumented and easy to blow past if intervals tighten. |
| F10 | Command Center dashboard mid-build, live wiring missing | Backend (`ops_command_center_service.py`, `views.py::ops_command_center_core/live`) is committed and already deliberately split into a load-once "core" payload and a to-be-polled "live" payload (see §5) — but the frontend components for it exist uncommitted, unwired, with no page/route and no caller of the `live` endpoint yet. |

---

## 4. Problems Identified

1. **Duplication risk compounds with every new dashboard.** Each new "live" surface (Command Center now, whatever comes after it) is currently built by copy-pasting a `setInterval` `useEffect`, silently forking behavior (see F4) each time.
2. **Latency floor of ~30s on every live surface**, unavoidable while polling is the only mechanism — acceptable for "SLA risk board", less so for anything marketed as "real-time".
3. **Request-path latency and partial-failure risk on ticket assignment.** F6's unbatched, non-transactional, non-async loop means a slow/failed `INSERT` partway through leaves some staff notified and others not, with no retry, and adds to the response time of an already user-facing action (assigning an engineer).
4. **No resilience story for a future socket.** If Phase 3 is built without care, a dropped WebSocket connection (mobile network switch, laptop sleep/wake, server restart) with no polling fallback would silently stop notifying a user rather than degrading gracefully.
5. **Serving-model risk is invisible until someone tries to ship a WebSocket.** Nothing today would stop an engineer from adding `channels` and a consumer and discovering only in production that Gunicorn's sync workers never upgrade the connection — this should be resolved deliberately (Phase 3) rather than discovered under pressure.

---

## 5. Reusable Infrastructure Already Present

This is the encouraging half of the audit: very little net-new infrastructure is required.

- **`useNotifications.js`'s poll implementation** (tab-visibility pause, cancel-ref guard against setState-after-unmount, lazy secondary fetch) is already the best pattern in the codebase and is the correct template to generalize into a shared hook — not something to invent from scratch.
- **`asgi.py`** was scaffolded on day one for exactly this purpose and just needs to be filled in.
- **Redis** is already running, already persistent (`--appendonly yes`), and already reachable from both the `backend` and `celery` containers — `channels-redis` would point at the same `REDIS_URL` with no new service in `docker-compose.yml`.
- **Celery's retry pattern** (`send_ticket_assigned_notification`'s `bind=True, max_retries=3, default_retry_delay=60`) is the exact shape `create_notification`'s dispatch should adopt.
- **`django-celery-beat`'s `DatabaseScheduler`** means any new periodic task (e.g., a notification digest) is addable via Django admin without a deploy.
- **The Operations Command Center backend** (`ops_command_center_service.py`) already encodes this plan's central data-freshness idea in production code today: a `core` payload (5 widgets, load-once) and a `live` payload (3 widgets — Incident Queue, SLA Risk Board, Activity Timeline — its own docstring says *"meant to be polled every 30-60s"*) served from two separate endpoints specifically so the expensive/stable widgets aren't recomputed on every poll tick. This is the right shape to standardize as the dashboard convention.
- **`LiveDot.jsx`** — an existing, already-committed animated status-dot primitive, reused today by the (unwired) `OperationsHealthBanner` — is the natural "this data is live" visual indicator to keep using, including once real push exists.
- **`AIDailyBriefCard` + `utils/operationsBrief.js` + `utils/dailyBrief.js`** — a render/data split already proven across two dashboards (Engineer Workspace and the in-progress Command Center) — is a template for how future live-data summaries should be built (pure function over an already-fetched payload, no dedicated network call).
- **`AnalyticsRateThrottle`** is a ready-made template for the new throttle scope Phase 1 recommends for the Command Center `live` endpoint.

---

## 6. Proposed Architecture

### 6.1 Target end-state

```
                         ┌─────────────────────────────┐
                         │   Redis (existing instance)  │
                         │  • Celery broker/backend     │
                         │  • Django cache              │
                         │  • Channel layer  ← NEW ROLE │
                         └───────┬───────────┬──────────┘
                                 │           │
                    ┌────────────┘           └────────────┐
                    ▼                                      ▼
      ┌─────────────────────────┐             ┌─────────────────────────────┐
      │  Gunicorn/WSGI (:8000)  │             │  ASGI process ← NEW (:8001  │
      │  existing REST API      │             │  or same port via a single  │
      │  unchanged              │             │  Uvicorn/Daphne server)     │
      └─────────────────────────┘             │  NotificationConsumer,      │
                                               │  per-user channel groups    │
                                               └─────────────┬───────────────┘
                                                              │
      ┌───────────────────────────────────────────────────────┴─────┐
      │  Celery worker: dispatch_notifications task                │
      │   1. bulk_create() the Notification rows                   │
      │   2. push over the channel layer to each recipient's group │
      └───────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                        ┌─────────────────────────────────┐
                                        │  Frontend: useNotificationSocket │
                                        │  primary: WebSocket message      │
                                        │  fallback: usePolling (Phase 1)  │
                                        └───────────────────────────────────┘
```

### 6.2 Design principles

1. **Additive, not a rewrite.** The REST notification API stays exactly as-is (list/mark-read/unread-count) — it remains the source of truth and the reconciliation mechanism after a reconnect. The socket only ever pushes "something changed, and here's the new row" — it never becomes the only way to learn state.
2. **Polling is the fallback, not the legacy code to delete.** `usePolling` (Phase 1) keeps working after Phase 3 ships; `useNotificationSocket` wraps it and simply widens the poll interval or disables it while the socket is confirmed connected.
3. **One channel-layer role, reused for every future live surface.** Dashboards (Command Center now, anything after it) push through the same channel-layer plumbing built for notifications in Phase 3, not a second bespoke system (Phase 4).
4. **No change to the existing WSGI request path.** The REST API keeps running on Gunicorn/WSGI exactly as configured today; only the new WebSocket endpoint needs an ASGI-capable process.

---

## 7. Detailed Phase 1–4 Implementation Plan

### Phase 1 — Shared polling hook + finish the in-flight Command Center

**Goal:** remove the duplication identified in F3/F4, and finish the uncommitted Command Center feature using the new shared hook instead of a fifth hand-rolled `setInterval`. No new dependencies, no schema changes, no backend infra changes beyond one throttle scope.

- **Task 1.1** — Extract `useNotifications.js`'s interval/visibility/cancel-ref logic into `frontend/src/hooks/usePolling.js`:
  `usePolling(fetchFn, { intervalMs, enabled = true }) → { data, error, loading, refetch }`. Pauses on `document.hidden`, resumes and immediately re-fetches on visibility regain (matching `useNotifications`' existing `handleVisibility` behavior exactly).
- **Task 1.2** — Migrate `useNotifications.js` to call `usePolling` internally for the count poll (behavior-preserving refactor — no UX change).
- **Task 1.3** — Migrate `TicketDetailPage.jsx:52` and `EngineerWorkspace.jsx:149` onto `usePolling`, which as a side effect fixes F4 (both gain tab-visibility pausing they didn't have before).
- **Task 1.4** — Build the missing Command Center page: `frontend/src/pages/ops/OperationsCommandCenter.jsx`, mounted at `/operations/command-center` in `App.jsx` (reuse the existing `OpsRoute` guard — the backend already gates both endpoints with `IsAnyStaffRole`, the same role set `OpsRoute` enforces). Fetch `core` once on mount; fetch `live` via `usePolling` at a 45s interval (mid-point of the backend docstring's stated 30-60s range). Wire in the four existing-but-unused components (`ActivityTimeline`, `EngineerCapacityBoard`, `OperationsHealthBanner`, `ServiceHealthGrid`) and `operationsBrief.js` + `AIDailyBriefCard`.
- **Task 1.5** — Add a `command_center` DRF throttle scope (mirroring `AnalyticsRateThrottle`, `views.py:145`) on `ops_command_center_live` — it runs 3 queries per tick per open tab and has no dedicated budget today (F9).
- **Task 1.6** — Add a sidebar nav entry for the new route (matching the pattern used for `/operations/executive-analytics`).

### Phase 2 — Decouple notification writes from the request path

**Goal:** fix F5/F6 — move notification creation off the synchronous request path and onto Celery, adopting the retry pattern that already exists for email.

- **Task 2.1** — Add `dispatch_notifications` task to `support_app/tasks.py`: `@shared_task(bind=True, max_retries=3, default_retry_delay=60)`, accepting a list of `(recipient_id, category, title, body, ticket_id)` tuples (JSON-serializable — no model instances across the Celery boundary, matching the existing tasks' pattern of re-fetching by ID inside the task).
- **Task 2.2** — Replace the per-recipient `create_notification()` loop at `views.py:2329-2339` (and the other ~6 call sites) with a single call that builds the recipient list and calls `dispatch_notifications.delay(...)`.
- **Task 2.3** — Inside the task, replace the implicit N `.create()` calls with one `Notification.objects.bulk_create([...])` (fixes F6's linear-scaling fan-out).
- **Task 2.4** — Update `backend/tests/test_notifications.py` (or add one if it doesn't exist) to assert on `.delay()` being called (via Celery's `CELERY_TASK_ALWAYS_EAGER` test setting, already the standard way this codebase would test a Celery dispatch) rather than asserting synchronous side effects.

### Phase 3 — Real push via Django Channels

**Goal:** close F1/F2/F7 — deliver a notification to an online user the instant it's created, with polling as an automatic, invisible fallback.

- **Task 3.1** — Add `channels`, `channels-redis` to `requirements.txt`. Configure `CHANNEL_LAYERS` in `settings.py` pointing `channels_redis.core.RedisChannelLayer` at the existing `REDIS_URL` (F8 — no new Redis instance).
- **Task 3.2** — Replace `asgi.py`'s stub with a real `ProtocolTypeRouter` (`http` → existing Django ASGI app, `websocket` → new `URLRouter` + auth middleware).
- **Task 3.3** — Add a `NotificationConsumer` (one per authenticated user, joined to a per-user channel group keyed on `user.id`) under a new `support_app/consumers.py`, plus `support_app/routing.py` for the WS URL pattern (e.g. `ws/notifications/`).
- **Task 3.4** — Extend the Phase 2 `dispatch_notifications` task: after `bulk_create`, also `async_to_sync(channel_layer.group_send)(...)` to each recipient's group with the serialized new-notification payload (reuse `NotificationSerializer`).
- **Task 3.5** — **Infrastructure change (the one topology risk in this plan, F2):** add a new `asgi` service to `docker-compose.yml` running Uvicorn/Daphne against `supportmitra.asgi:application`, and update the reverse-proxy layer (Nginx, in the production deployment guide) to route `/ws/*` to it while `/api/*` stays on Gunicorn/WSGI exactly as today. Do **not** attempt to switch Gunicorn's own `worker_class` — keep the two serving paths separate rather than converting the whole app to ASGI in one step.
- **Task 3.6** — Frontend: `frontend/src/hooks/useNotificationSocket.js` — opens the WebSocket on mount (JWT passed as a query param or subprotocol, matching how `api/client.js` already attaches the token to REST calls), updates the same state shape `useNotifications` exposes today, and **falls back to Phase 1's `usePolling`** whenever the socket is not in the `OPEN` state (covers initial connect, drop, and reconnect-backoff windows) — this is the resilience mechanism called out as missing in Problem 4.
- **Task 3.7** — Update `NotificationBell.jsx` to consume `useNotificationSocket` instead of `useNotifications` directly (the hook's returned shape stays compatible, so this is a low-risk swap).

### Phase 4 — Extend push to dashboards

**Goal:** apply the same channel-layer plumbing built for notifications (not a second bespoke system) to the Command Center's `live` widgets, so genuinely urgent changes (new critical ticket, SLA breach) arrive immediately rather than waiting for the next 45s tick.

- **Task 4.1** — Add a shared `command-center` channel group (all staff, not per-user) that ticket create/escalate/SLA-breach code paths broadcast a lightweight "refetch" signal to (not the full payload — keep the heavy aggregation queries in `ops_command_center_service.py` running on-demand via REST, not duplicated into the push path).
- **Task 4.2** — `usePolling`'s interval for the Command Center `live` endpoint widens (e.g., 45s → 3-5 min) once the socket-driven refetch signal is confirmed reliable, since the socket now carries the time-sensitive case and polling becomes purely the reconciliation/fallback mechanism.
- **Task 4.3** — Document the "broadcast a refetch signal, don't push the payload" convention as the standard for any future live dashboard, so Phase 4's pattern — not a bespoke per-dashboard socket — is what gets reused next time.

---

## 8. Risks

| Risk | Phase | Severity | Mitigation |
|---|---|---|---|
| WSGI→ASGI serving split adds a second process type to operate (deploy, monitor, restart) in production | 3 | Medium | Task 3.5 keeps the two serving paths fully separate (existing Gunicorn/WSGI untouched); only the new `asgi` container needs new ops runbook entries. |
| A dropped/misbehaving WebSocket silently stops notifying a user if no fallback exists | 3 | High if not mitigated | Task 3.6 explicitly builds the polling fallback as part of the same hook, not as an afterthought. |
| `channels-redis` failure mode differs from Celery's (a pub/sub message with no subscriber connected is simply lost, unlike a Celery task which persists in the broker until consumed) | 3 | Medium | The REST API + Phase 1 polling remains the source of truth; a lost push is invisible only until the next poll tick or page load, never a data-loss bug. |
| Phase 2's `bulk_create` bypasses any `post_save` signal receivers that might exist on `Notification` in the future | 2 | Low today (no such receivers currently exist — confirmed via `signals.py` audit) | Flag in code comments if a future signal is ever added to `Notification`, so it doesn't silently stop firing under bulk_create. |
| Command Center `live` endpoint (Task 1.4) run every 45s per open tab across every staff member could become a real DB load contributor once headcount grows | 1 | Low now, worth monitoring | Task 1.5's throttle scope caps worst case; the endpoint's own docstring already anticipated this by splitting out the 3 expensive widgets from the other 5. |
| Scope creep: Phase 3/4 WebSocket work is the highest-effort, highest-unfamiliarity piece of this plan for a codebase that has never used `channels` before | 3–4 | Medium | Recommended go/no-go checkpoint after Phase 2 (see §10) before committing to Phase 3. |

---

## 9. Dependencies

| Dependency | Type | Needed for | Notes |
|---|---|---|---|
| `channels` | New Python package | Phase 3 | Django's official ASGI/WebSocket toolkit. |
| `channels-redis` | New Python package | Phase 3 | Channel layer backend; points at the existing `REDIS_URL`, no new Redis instance. |
| `daphne` or `uvicorn` | New Python package | Phase 3 | ASGI server to actually run `asgi.py` in a new container. |
| New `asgi` Docker Compose service | Infra | Phase 3 | See Task 3.5. |
| Nginx/reverse-proxy config update (production) | Infra | Phase 3 | Route `/ws/*` to the new ASGI service; out of scope for local Docker Compose dev but required before any production deploy of Phase 3. Update `docs/DEPLOYMENT_GUIDE.md`/`docs/PRODUCTION_DEPLOYMENT_GUIDE.md` accordingly when this phase ships. |
| `CELERY_TASK_ALWAYS_EAGER` test setting | Test infra | Phase 2 | Standard Celery testing approach; confirm it's already configured for `pytest` (check `settings.py`/`pytest.ini` — if absent, add it as part of Task 2.4, scoped to the test settings module only). |
| None | — | Phase 1 | Deliberately dependency-free — pure refactor + finishing already-committed backend work. |

---

## 10. Estimated Effort per Phase

| Phase | Effort | Basis |
|---|---|---|
| **Phase 1** | 0.5–1 day | Mostly a refactor (Tasks 1.1–1.3) plus wiring already-built components (Task 1.4) — no new backend logic, the aggregation queries and serializers already exist and are tested. |
| **Phase 2** | 0.5 day | One new Celery task following an existing template almost exactly (`send_ticket_assigned_notification`), plus swapping ~7 call sites to call it instead of `create_notification()` directly. |
| **Phase 3** | 2–4 days | The highest-uncertainty phase: first-ever use of Channels in this codebase, a new Docker Compose service, JWT-over-WebSocket auth (no existing precedent to copy), and the frontend fallback logic in Task 3.6 needs care to get right. |
| **Phase 4** | 1 day | Mostly reuses Phase 3's plumbing; the only new work is the "broadcast a refetch signal" convention and widening the Command Center's poll interval. |

Total, if all four phases are pursued: **~4–6.5 days** of focused engineering time, excluding QA/manual verification (see §12) and any production rollout/monitoring setup for the new ASGI service.

---

## 11. Recommended Implementation Order

1. **Phase 1** — do this regardless of whether real-time push is ever pursued. It fixes a real, already-visible duplication problem and finishes work already sitting uncommitted in the working tree.
2. **Phase 2** — do this next regardless of Phase 3/4. It's a correctness/reliability fix (F5, F6) independent of whether push ever ships, and Phase 3's `dispatch_notifications` task extension (Task 3.4) builds directly on top of it.
3. **Checkpoint** — after Phase 2, confirm appetite for Phase 3's infrastructure change (new ASGI process, new Compose service, first-ever Channels usage) before proceeding. This is the natural pause point since Phases 1–2 are complete, safe wins on their own.
4. **Phase 3** — only once the checkpoint is confirmed. Build the fallback (Task 3.6) alongside the socket, not after.
5. **Phase 4** — only after Phase 3 is stable in production for a reasonable bake-in period (recommend at least one full week of real usage) — it depends on Phase 3's channel layer being trustworthy under real load before dashboards start relying on it too.

---

## 12. Future Enhancements

- **Notification preferences** — per-category opt-out/opt-in (e.g., a customer who doesn't want `comment_added` emails but does want in-app), once a real preferences UI exists.
- **Digest notifications** — a periodic Celery Beat task (trivial to add given `django-celery-beat`'s admin-editable schedule) that batches low-urgency categories into a daily/weekly email instead of one-at-a-time.
- **Presence indicators** — "Engineer is viewing this ticket now" on the ticket detail page, a natural extension of Phase 3's per-user channel groups.
- **WhatsApp notification delivery** — `notification_service.py::send_whatsapp()` is already a documented Phase 6 placeholder (Gupshup integration) gated behind `ENABLE_WHATSAPP_NOTIFICATIONS`; this plan doesn't touch it, but Phase 2's `dispatch_notifications` task would be the natural place to also trigger it once built.
- **Read receipts across the fan-out** — e.g., "3 of 5 notified staff have seen this escalation," useful for the Command Center's Escalation Queue widget.
- **Mobile push (FCM/APNs)** — once the channel-layer plumbing exists (Phase 3), adding a push-notification-service subscriber to the same `group_send` calls is a bounded, additive extension rather than a new system.

---

## 13. Manual Verification Strategy

Automated tests (`pytest`, Playwright) verify correctness; the checks below verify the actual real-time *behavior* an automated assertion can't easily capture (timing, cross-tab, socket reconnect).

### Phase 1
- Open two browser tabs on `/operations` as the same staff user; background one tab (switch away) and confirm via Network tab that its polling requests stop, then resume within one interval of switching back — for all three surfaces now on `usePolling` (notification bell, ticket detail, engineer workspace), not just the bell.
- Load `/operations/command-center`: confirm `GET /ops/command-center/` fires once on mount, `GET /ops/command-center/live/` fires on a ~45s cadence, and both stop when the tab is hidden.
- Trigger a state change that affects a `live` widget (e.g., escalate a ticket via `ops_escalate_ticket`) in one tab; confirm it appears in a second tab's Command Center within one poll interval, without a manual refresh.
- `curl` the new `command_center` throttle scope's key after repeated manual refreshes (`docker compose exec redis redis-cli KEYS "*throttle_command_center*"`) to confirm the scope is actually being applied (not silently falling through to the global default).

### Phase 2
- Assign a ticket via the ops UI; confirm the response returns promptly (a stopwatch comparison against the pre-Phase-2 latency, given F6's linear scaling, should show a visible improvement as staff headcount grows in seed data) and that all expected recipients still receive their `Notification` row (query `Notification.objects.filter(ticket=...)` in `manage.py shell` and count against expected recipients).
- Tail `docker compose logs -f celery` while triggering the flow, to confirm `dispatch_notifications` actually executes (not silently swallowed) and to inspect retry behavior by temporarily pointing `REDIS_URL` at an unreachable host and confirming the task retries rather than failing silently.

### Phase 3
- With the new `asgi` container running, open the browser devtools Network→WS tab on any authenticated page and confirm a WebSocket connection to `/ws/notifications/` opens and shows periodic keepalive frames.
- Trigger a notification-generating action (e.g., assign a ticket to yourself in a second browser profile) and confirm the bell badge updates **without waiting for a poll tick** — the core proof this phase delivers real-time behavior.
- Kill the `asgi` container (`docker compose stop asgi`) mid-session and confirm the frontend falls back to polling within one reconnect-backoff cycle rather than the bell simply going silent — this is the single most important manual check in the whole plan, since Problem 4 explicitly calls out this failure mode as the one to avoid.
- Restart the `asgi` container and confirm the socket reconnects automatically and polling stands back down.
- Open the same account in two tabs/devices simultaneously and confirm both receive the push (validates the per-user group, not a single-connection assumption).

### Phase 4
- With the Command Center open, trigger an SLA breach (or wait for the existing `check_sla_breaches` Beat task to find one in seeded data) and confirm the refetch signal arrives and the affected widget updates before the widened poll interval would have caught it naturally.
- Confirm the widened poll interval (Task 4.2) is actually in effect (Network tab timing) after the socket has been connected and stable for a session, and confirm it falls back to the tighter interval if the socket drops mid-session.

---

*This document reflects the audited state of the codebase as of 2026-07-15. No application code was modified in the course of this audit or in writing this document.*
