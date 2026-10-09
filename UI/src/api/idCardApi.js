import { apiGet, apiPost, apiPut } from './apiClient';

export const createIdCardRequest = (data) => apiPost('/api/id-card-requests', data);
export const updateIdCardRequest = (id, data) => apiPut(`/api/id-card-requests/${id}`, data);
export const getIdCardRequests = () => apiGet('/api/id-card-requests');
export const getIdCardRequestById = (id) => apiGet(`/api/id-card-requests/${id}`);
export const getNextIdCardNumber = () => apiGet('/api/id-card-requests/next-code');
export const getCandidateProfileForIdCard = () => apiGet('/api/id-card-requests/candidate-profile');
export const getNextIdentityCode = getNextIdCardNumber;
export const processIdCardAction = (id, action, remarks = '', customIdCardNumber = '', rejectionReason = '') =>
  apiPost(`/api/id-card-requests/${id}/action`, { 
    action, 
    remarks, 
    customIdCardNumber, 
    rejectionReason: rejectionReason || (action === 'Reject' ? remarks : '') 
  });


