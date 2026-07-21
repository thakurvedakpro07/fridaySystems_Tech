import apiClient from "./client";

// ── Organization profile ────────────────────────────────────────
export const listMyOrganizations = () => apiClient.get("/organizations/mine/");
export const getOrganization     = (orgId) => apiClient.get(`/organizations/${orgId}/`);
export const updateOrganization  = (orgId, data) => apiClient.patch(`/organizations/${orgId}/`, data);

// ── Members ─────────────────────────────────────────────────────
export const listOrganizationMembers = (orgId, params = {}) =>
  apiClient.get(`/organizations/${orgId}/members/`, { params });

export const updateMemberRole = (orgId, userId, role) =>
  apiClient.patch(`/organizations/${orgId}/members/${userId}/`, { role });

export const removeMember = (orgId, userId) =>
  apiClient.delete(`/organizations/${orgId}/members/${userId}/`);

// ── Invitations ─────────────────────────────────────────────────
export const listInvitations = (orgId, params = {}) =>
  apiClient.get(`/organizations/${orgId}/invitations/`, { params });

export const createInvitation = (orgId, email, role) =>
  apiClient.post(`/organizations/${orgId}/invitations/`, { email, role });

export const revokeInvitation = (orgId, invitationId) =>
  apiClient.delete(`/organizations/${orgId}/invitations/${invitationId}/`);

// Public — no auth required, used on the invitation-accept landing page.
export const previewInvitation = (token) =>
  apiClient.get(`/organizations/invitations/${token}/`);

export const acceptInvitation = (data) =>
  apiClient.post("/organizations/invitations/accept/", data);

// ── Audit log ───────────────────────────────────────────────────
export const listOrganizationAuditLog = (orgId, params = {}) =>
  apiClient.get(`/organizations/${orgId}/audit/`, { params });
