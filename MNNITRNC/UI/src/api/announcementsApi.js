import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function getAnnouncements(category, status) {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (status && status !== 'All Status') params.append('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await apiGet(`/api/announcements${query}`);
}

export async function getAnnouncementById(id) {
  return await apiGet(`/api/announcements/${id}`);
}

export async function createAnnouncement(data) {
  return await apiPost('/api/announcements', data);
}

export async function updateAnnouncement(id, data) {
  return await apiPut(`/api/announcements/${id}`, data);
}

export async function deleteAnnouncement(id) {
  return await apiDelete(`/api/announcements/${id}`);
}

export async function uploadAnnouncementPdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  return await apiPost('/api/announcements/upload-pdf', formData);
}
