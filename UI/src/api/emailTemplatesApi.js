import { apiGet, apiPut } from './apiClient';

export const listEmailTemplates = () => apiGet('/api/email-templates');
export const getEmailTemplate = (id) => apiGet(`/api/email-templates/${id}`);
export const updateEmailTemplate = (id, subject, htmlBody) =>
  apiPut(`/api/email-templates/${id}`, { subject, htmlBody });
