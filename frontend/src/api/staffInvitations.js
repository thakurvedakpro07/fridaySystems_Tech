import apiClient from "./client";

// ── Ops management (Super Admin only) ──────────────────────────────
export const listStaffInvitations = (params = {}) =>
  apiClient.get("/ops/staff-invitations/", { params });

export const createStaffInvitation = (email, role) =>
  apiClient.post("/ops/staff-invitations/", { email, role });

export const revokeStaffInvitation = (invitationId) =>
  apiClient.post(`/ops/staff-invitations/${invitationId}/revoke/`);

export const resendStaffInvitation = (invitationId) =>
  apiClient.post(`/ops/staff-invitations/${invitationId}/resend/`);

// ── Public — no auth required, used on the invitation-accept landing page ──
export const previewStaffInvitation = (token) =>
  apiClient.get(`/staff-invitations/${token}/`);

export const acceptStaffInvitation = (data) =>
  apiClient.post("/staff-invitations/accept/", data);
