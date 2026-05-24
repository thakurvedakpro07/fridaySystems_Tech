/**
 * Payment API calls — Razorpay-ready.
 */
import apiClient from "./client";

// ── Customer ──────────────────────────────────────────────────────
export const listMyPayments = () =>
  apiClient.get("/customers/me/payments/");

export const getPayment = (id) =>
  apiClient.get(`/payments/${id}/`);

export const downloadInvoice = (id) =>
  apiClient.get(`/payments/${id}/invoice/`, { responseType: "blob" });

// ── Per-ticket payment flow ───────────────────────────────────────
export const initiatePayment = (ticketId) =>
  apiClient.post(`/tickets/${ticketId}/initiate-payment/`);

export const verifyPayment = (ticketId, data) =>
  apiClient.post(`/tickets/${ticketId}/verify-payment/`, data);

// ── Admin ─────────────────────────────────────────────────────────
export const listAdminPayments = (params = {}) =>
  apiClient.get("/admin/payments/", { params });

export const adminConfirmPayment = (paymentId) =>
  apiClient.post(`/admin/payments/${paymentId}/confirm/`);
