import { apiGet, apiPost, apiPut } from './apiClient';

export const getMyProfile = () => apiGet('/api/my/profile');

export const saveMyProfile = (payload) => apiPut('/api/my/profile', payload);

export const uploadMyProfilePhoto = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost('/api/my/profile/photo', formData);
};
