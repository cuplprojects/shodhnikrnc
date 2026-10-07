import { apiGet, apiPost } from './apiClient';

export const createExperienceCertificateRequest = (data) =>
  apiPost('/api/experience-certificate-requests', data);

export const getExperienceCertificateRequests = () =>
  apiGet('/api/experience-certificate-requests');

export const getExperienceCertificateRequestById = (id) =>
  apiGet(`/api/experience-certificate-requests/${id}`);

export const processExperienceCertificateAction = (id, action, remarks = '') =>
  apiPost(`/api/experience-certificate-requests/${id}/action`, { action, remarks });
