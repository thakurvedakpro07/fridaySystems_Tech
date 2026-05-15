/**
 * Payment API calls.
 * TODO: expand when Razorpay integration is implemented in Phase 2.
 */
import apiClient from "./client";

export const getPayment = (id) =>
  apiClient.get(`/payments/${id}/`);

export const downloadInvoice = (id) =>
  apiClient.get(`/payments/${id}/invoice/`, { responseType: "blob" });

export const listMyPayments = () =>
  apiClient.get("/customers/me/payments/");
