import { apiGet, apiPost } from './apiClient';

export const listTravelRequestsForProject = (projectId) =>
  apiGet(`/api/projects/${projectId}/travel-requests`);

export const getTravelRequest = (travelRequestId) =>
  apiGet(`/api/travel-requests/${travelRequestId}`);

/** `payload` is JSON -- unlike an indent, nothing is uploaded at raise. */
export const raiseTravelRequest = (projectId, payload) =>
  apiPost(`/api/projects/${projectId}/travel-requests`, payload);

export const processTravelBill = (travelRequestId, payload) =>
  apiPost(`/api/travel-requests/${travelRequestId}/process-bill`, payload);

export const listAllTravelRequests = () =>
  apiGet('/api/travel-requests');

