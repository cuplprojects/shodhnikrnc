import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

const BASE = '/api/admin';

// --- roles -------------------------------------------------------------------

export const listRoles = () => apiGet(`${BASE}/roles`);

export const createRole = (name) => apiPost(`${BASE}/roles`, { name });

export const renameRole = (roleId, name) => apiPut(`${BASE}/roles/${roleId}`, { name });

export const deleteRole = (roleId) => apiDelete(`${BASE}/roles/${roleId}`);

// --- a role's page access ----------------------------------------------------

/** The full module/page tree with this role's grants marked on it. */
export const getRoleAccess = (roleId) => apiGet(`${BASE}/roles/${roleId}/access`);

/**
 * Replaces the role's page list. Sent whole rather than as a delta, so what was
 * on screen is exactly what gets saved.
 */
export const updateRoleAccess = (roleId, pages) =>
  apiPut(`${BASE}/roles/${roleId}/access`, { pages });

// --- per-user exceptions -----------------------------------------------------

export const listUsers = () => apiGet(`${BASE}/users`);

export const listUserGrants = (userId) => apiGet(`${BASE}/users/${userId}/grants`);

export const createUserGrant = (userId, payload) =>
  apiPost(`${BASE}/users/${userId}/grants`, payload);

export const deleteUserGrant = (userId, pageKey) =>
  apiDelete(`${BASE}/users/${userId}/grants/${pageKey}`);
