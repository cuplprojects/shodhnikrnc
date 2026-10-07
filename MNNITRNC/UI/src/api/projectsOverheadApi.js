import { apiGet } from './apiClient';

export const getOverheadSubHeadAvailability = (projectId) =>
  apiGet(`/api/projects/${projectId}/overhead-subheads`);
