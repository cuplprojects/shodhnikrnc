import { apiGet, apiPost } from './apiClient';

export async function registerFaculty(fullName, email, password, departmentId) {
  // silent: true — the registration form shows its own inline error, matching register() in authApi.js.
  return apiPost('/api/auth/register-faculty', { fullName, email, password, departmentId }, { silent: true });
}

export async function listPendingFacultyRegistrations() {
  return apiGet('/api/faculty-registrations/pending');
}

export async function approveFacultyRegistration(userId) {
  return apiPost(`/api/faculty-registrations/${userId}/approve`);
}

export async function rejectFacultyRegistration(userId) {
  return apiPost(`/api/faculty-registrations/${userId}/reject`);
}
