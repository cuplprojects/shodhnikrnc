import { apiGet, apiPost, apiPut } from './apiClient';

/** Active agencies only -- what the New Proposal dropdown offers. */
export const listActiveFundingAgencies = () =>
  apiGet('/api/funding-agencies/active');

/** Every agency, active or not -- the admin "Manage Funding Agencies" page. */
export const listAllFundingAgencies = () =>
  apiGet('/api/funding-agencies');

export const createFundingAgency = (name) =>
  apiPost('/api/funding-agencies', { name });

export const updateFundingAgency = (id, name, isActive) =>
  apiPut(`/api/funding-agencies/${id}`, { name, isActive });
