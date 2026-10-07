import { apiPost } from './apiClient';

export const raiseConsumableIndent = (projectId, formData) =>
  apiPost(`/api/projects/${projectId}/consumable-indents`, formData);

export const raiseContingencyIndent = (projectId, formData) =>
  apiPost(`/api/projects/${projectId}/contingency-indents`, formData);

export const raiseEquipmentIndent = (projectId, formData) =>
  apiPost(`/api/projects/${projectId}/equipment-indents`, formData);
