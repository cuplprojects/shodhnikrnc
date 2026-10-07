import { apiGet, apiPost } from './apiClient';

export async function createFacultyUser(data) {
  return await apiPost('/api/faculty-users', data);
}

export async function getAllFacultyUsers() {
  return await apiGet('/api/faculty-users');
}

export async function getFacultyUserById(userId) {
  return await apiGet(`/api/faculty-users/${encodeURIComponent(userId)}`);
}
