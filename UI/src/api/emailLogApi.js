import { apiGet, apiPost } from './apiClient';

// Query-string building mirrors announcementsApi.js's own getAnnouncements
// convention (URLSearchParams, appended only when a filter is actually set).
export async function listEmailLog(succeeded) {
  const params = new URLSearchParams();
  if (succeeded !== undefined) params.append('succeeded', succeeded);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await apiGet(`/api/email-log${query}`);
}

export const resendEmail = (id) => apiPost(`/api/email-log/${id}/resend`);
