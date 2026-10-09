import { apiDelete, apiGet, apiPost } from './apiClient';

/** The caller's own saved advertisement bodies -- private per PI. */
export const listMyAdvertisementBodyTemplates = () =>
  apiGet('/api/advertisement-body-templates');

export const saveAdvertisementBodyTemplate = (name, htmlBody) =>
  apiPost('/api/advertisement-body-templates', { name, htmlBody });

export const deleteAdvertisementBodyTemplate = (id) =>
  apiDelete(`/api/advertisement-body-templates/${id}`);
