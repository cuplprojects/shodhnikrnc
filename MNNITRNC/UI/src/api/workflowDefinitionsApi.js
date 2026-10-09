import { apiGet, apiPost, apiPut } from './apiClient';

const BASE = '/api/admin/workflow-definitions';

export const listWorkflowDefinitions = () => apiGet(BASE);

export const getWorkflowDefinition = (id) => apiGet(`${BASE}/${id}`);

/**
 * Replaces the whole stage list. The route is sent complete rather than as a
 * delta, because it is only meaningful as a sequence.
 *
 * On a validation failure the server responds 400 with {isValid, errors}, which
 * ApiError keeps on `problemDetails` — see `validationErrorsOf`.
 */
export const updateWorkflowDefinition = (id, payload) => apiPut(`${BASE}/${id}`, payload);

/** Checks a route without saving it, so the editor can warn before committing. */
export const validateWorkflowDefinition = (id, payload) =>
  apiPost(`${BASE}/${id}/validate`, payload);

/**
 * The validator's messages off a rejected save. Returns [] for other failures
 * so callers can fall back to the generic error message.
 */
export function validationErrorsOf(error) {
  const errors = error?.problemDetails?.errors;
  return Array.isArray(errors) ? errors : [];
}
