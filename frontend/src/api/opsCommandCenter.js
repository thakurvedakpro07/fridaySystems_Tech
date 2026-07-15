import apiClient from "./client";

// ── Operations Command Center ───────────────────────────────────────
//
// Split into two calls matching the backend's split: `core` covers the
// widgets that only need to load once (Escalation Queue, Engineer
// Capacity, Service Health, Critical Customers, Ticket Flow); `live`
// covers the three time-sensitive widgets (Live Incident Queue, SLA Risk
// Board, Activity Timeline) meant to be polled every 30-60s.

export const getOpsCommandCenterCore = (config = {}) =>
  apiClient.get("/ops/command-center/", config);

export const getOpsCommandCenterLive = (config = {}) =>
  apiClient.get("/ops/command-center/live/", config);
