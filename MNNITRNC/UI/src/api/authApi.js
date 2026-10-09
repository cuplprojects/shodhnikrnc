import { apiPost } from './apiClient';

export async function login(userName, password) {
  // silent: true — the login page shows its own inline error; no global toast needed.
  return apiPost('/api/auth/login', { userName, password }, { silent: true });
}

export async function register(email, fullName, password) {
  // silent: true — the registration form shows its own inline error; no global toast needed.
  return apiPost('/api/auth/register', { email, fullName, password }, { silent: true });
}

export async function confirmEmail(userId, token) {
  return apiPost('/api/auth/confirm-email', { userId, token });
}

export async function resendVerification(email) {
  return apiPost('/api/auth/resend-verification', { email });
}

export async function changePassword(currentPassword, newPassword) {
  // silent: true — ProfilePage's Security card shows its own inline error.
  return apiPost('/api/auth/change-password', { currentPassword, newPassword }, { silent: true });
}

export async function forgotPassword(email) {
  // silent: true — LoginPage shows its own inline message.
  return apiPost('/api/auth/forgot-password', { email }, { silent: true });
}

export async function resetPassword(userId, token, newPassword) {
  // silent: true — ResetPasswordPage shows its own inline error.
  return apiPost('/api/auth/reset-password', { userId, token, newPassword }, { silent: true });
}

/**
 * Claims (or re-confirms) Faculty access for the caller of shodhanikToken --
 * see AuthController.RegisterFacultyFederated. Must authenticate with the
 * Shodhanik-issued token itself (via bearerToken), not any RNC session token,
 * since the whole point of this call is that the caller may not have an RNC
 * account yet.
 */
export async function registerFacultyFederated(shodhanikToken) {
  return apiPost('/api/auth/faculty/federated', undefined, { bearerToken: shodhanikToken, silent: true });
}
