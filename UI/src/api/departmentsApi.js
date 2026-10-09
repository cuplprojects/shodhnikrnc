import { apiGet, apiPost, apiPut } from './apiClient';

/** Active departments only -- dropdown sources (e.g. Create Faculty User). */
export const listActiveDepartments = () =>
  apiGet('/api/departments/active');

/** Every department, active or not -- the admin "Manage Departments" page. */
export const listAllDepartments = () =>
  apiGet('/api/departments');

export const createDepartment = (code, name, isInstituteWide) =>
  apiPost('/api/departments', { code, name, isInstituteWide });

export const updateDepartment = (id, code, name, headUserId, isInstituteWide, isActive) =>
  apiPut(`/api/departments/${id}`, { code, name, headUserId, isInstituteWide, isActive });
