import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function getNewsEvents(type) {
  const query = type && type !== 'All' ? `?type=${encodeURIComponent(type.toLowerCase())}` : '';
  return await apiGet(`/api/news-events${query}`);
}

export async function getNewsEventById(id) {
  return await apiGet(`/api/news-events/${id}`);
}

export async function createNewsEvent(data) {
  return await apiPost('/api/news-events', data);
}

export async function updateNewsEvent(id, data) {
  return await apiPut(`/api/news-events/${id}`, data);
}

export async function deleteNewsEvent(id) {
  return await apiDelete(`/api/news-events/${id}`);
}
