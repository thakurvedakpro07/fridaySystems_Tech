/**
 * Freelancer self-service API calls (payouts, stats).
 *
 * Existing freelancer ticket-operation calls (list/detail/status/remote-session)
 * live in api/tickets.js — new freelancer-only endpoints are added here instead
 * of growing that file further.
 */
import apiClient from "./client";

export const freelancerListPayouts = (params = {}) =>
  apiClient.get("/freelancer/payouts/", { params });

export const freelancerGetMyStats = (params = {}) =>
  apiClient.get("/freelancer/stats/", { params });
