import { apiGet, apiPost } from './apiClient';

/**
 * The controller is routed at /api/workflow (singular). This module previously
 * posted to /api/workflows, which 404s on every action.
 */
export const getWorkflowInstance = (workflowInstanceId) =>
  apiGet(`/api/workflow/${workflowInstanceId}`);

export const getWorkflowInstanceByRequest = (requestType, requestId, phase = 'Bill', options) =>
  apiGet(`/api/workflow/by-request/${requestType}/${requestId}/${phase}`, options);

export const actionWorkflow = (workflowInstanceId, action, payload = {}) =>
  apiPost(`/api/workflow/${workflowInstanceId}/${action}`, payload);

export const listDealingAssistantOptions = () => apiGet('/api/workflow/dealing-assistant-options');

export const listWorkflowQueries = (instanceId) => apiGet(`/api/workflow/${instanceId}/queries`);
export const askWorkflowQuery = (instanceId, payload) => apiPost(`/api/workflow/${instanceId}/queries`, payload);
export const answerWorkflowQuery = (queryId, payload) => apiPost(`/api/workflow/queries/${queryId}/answer`, payload);
