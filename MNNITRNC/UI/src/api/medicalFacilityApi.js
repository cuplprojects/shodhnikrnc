import { apiGet, apiPost } from './apiClient';

export const createMedicalFacilityRequest = (data) =>
  apiPost('/api/medical-facility-requests', data);

export const getMedicalFacilityRequests = () =>
  apiGet('/api/medical-facility-requests');

export const getMedicalFacilityRequestById = (id) =>
  apiGet(`/api/medical-facility-requests/${id}`);

export const processMedicalFacilityAction = (id, action, remarks = '') =>
  apiPost(`/api/medical-facility-requests/${id}/action`, { action, remarks });
