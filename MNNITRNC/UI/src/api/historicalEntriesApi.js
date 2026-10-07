import { apiGet, apiPost, apiDelete } from './apiClient';

export const listHistoricalEntryProjects = () => apiGet('/api/historical-entries/projects');
export const listHistoricalEntries = (projectId) => apiGet(`/api/historical-entries/${projectId}`);
export const recordHistoricalExpenditure = (projectId, payload) =>
  apiPost(`/api/historical-entries/${projectId}/expenditure`, payload);
export const deleteHistoricalExpenditure = (id) => apiDelete(`/api/historical-entries/expenditure/${id}`);
export const recordHistoricalGrantReceipt = (projectId, payload) =>
  apiPost(`/api/historical-entries/${projectId}/grant-receipts`, payload);
export const deleteHistoricalGrantReceipt = (id) => apiDelete(`/api/historical-entries/grant-receipts/${id}`);
