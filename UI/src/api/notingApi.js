import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export const listNotings = (params = {}) => {
  const query = new URLSearchParams();
  if (params.pageNumber || params.page) query.append('pageNumber', params.pageNumber || params.page);
  if (params.pageSize !== undefined) query.append('pageSize', params.pageSize);
  if (params.search) query.append('search', params.search);
  if (params.status && params.status !== 'All') query.append('status', params.status);
  const qStr = query.toString();
  return apiGet(qStr ? `/api/notings?${qStr}` : '/api/notings');
};
export const getNoting = (id) => apiGet(`/api/notings/${id}`);
export const createNoting = (payload) => apiPost('/api/notings', payload);
export const updateNoting = (id, payload) => apiPut(`/api/notings/${id}`, payload);
export const updateNotingStatus = (id, status, stage = null, signedFilesJson = null) => apiPut(`/api/notings/${id}/status`, { status, currentStage: stage, signedFilesJson });
export const deleteNoting = (id) => apiDelete(`/api/notings/${id}`);
