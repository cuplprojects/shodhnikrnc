import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

/**
 * The caller's own advertisement templates plus the shared system default.
 * Backed by AdvertisementTemplatesController (API.Application.Recruitment
 * Task 3).
 */
export const listAdvertisementTemplates = () => apiGet('/api/advertisement-templates');

export const cloneAdvertisementTemplate = (id, newName) =>
  apiPost(`/api/advertisement-templates/${id}/clone`, { newName });

export const updateAdvertisementTemplate = (id, payload) =>
  apiPut(`/api/advertisement-templates/${id}`, payload);

export const deleteAdvertisementTemplate = (id) => apiDelete(`/api/advertisement-templates/${id}`);

/**
 * Resolves a template's entity-bound tokens against one real recruitment.
 * Returns { sections: [...], unresolvedTokens: [...] } -- any {{Token}} left
 * in a section after resolution is a free-text field the caller must fill
 * before submitting advertise/readvertise.
 */
export const resolveAdvertisementTemplate = (id, recruitmentRequestId, payload) =>
  apiPost(`/api/advertisement-templates/${id}/resolve/${recruitmentRequestId}`, payload);
