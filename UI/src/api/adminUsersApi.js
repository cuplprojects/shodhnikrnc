import { apiGet, apiPut } from './apiClient';

export const listUsers = () => apiGet('/api/admin/user-management');

export const setEmployeeId = (userId, employeeId) =>
  apiPut(`/api/admin/user-management/${userId}/employee-id`, { employeeId });
