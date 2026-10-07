import { apiGet, apiPost } from './apiClient';

export const createNocRequest = (data) => apiPost('/api/noc-requests', data);
export const getNocRequests = () => apiGet('/api/noc-requests');
export const getNocRequestById = (id) => apiGet(`/api/noc-requests/${id}`);
export const processNocAction = (id, action, remarks = '') => 
  apiPost(`/api/noc-requests/${id}/action`, { action, remarks });
