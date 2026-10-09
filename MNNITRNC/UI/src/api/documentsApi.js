import { apiGet, apiPost, apiDelete, apiBlob, BASE_URL } from './apiClient';

/**
 * Which configured documents a request has and which it is missing.
 *
 * The endpoint keys off (requestType, phase, requestId, ownerType); this module
 * previously sent workflowDefinitionId/subjectType/subjectId, which the API does
 * not accept.
 */
export const getChecklist = ({ requestType, phase, requestId, ownerType }) => {
  const query = new URLSearchParams({ requestType, phase, requestId, ownerType });
  return apiGet(`/api/documents/checklist?${query}`);
};

export const getDocumentsByOwner = (ownerType, ownerId) => apiGet(`/api/documents/owner/${ownerType}/${ownerId}`);

/** `formData` must carry File, OwnerType, OwnerId and Kind. */
export const uploadDocument = (formData) => apiPost('/api/documents/upload', formData);

export const documentDownloadPath = (documentId) => `${BASE_URL}/api/documents/${documentId}/download`;

export const downloadDocument = (documentId) => apiBlob(`/api/documents/${documentId}/download`);

export const deleteDocument = (documentId) => apiDelete(`/api/documents/${documentId}`);
