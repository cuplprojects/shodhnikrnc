import { apiGet, apiPost, apiPut } from './apiClient';

export const getPaymentVouchers = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.pageNumber || params.page) query.append('pageNumber', params.pageNumber || params.page);
  if (params.pageSize !== undefined) query.append('pageSize', params.pageSize);
  if (params.search) query.append('search', params.search);
  if (params.status && params.status !== 'All') query.append('status', params.status);
  const qStr = query.toString();
  return await apiGet(qStr ? `/api/payment-vouchers?${qStr}` : '/api/payment-vouchers');
};

export const createPaymentVoucher = async (voucherData) => {
  return await apiPost('/api/payment-vouchers', voucherData);
};

export const updatePaymentVoucherStatus = async (id, status, stage, signedFilesJson = null) => {
  return await apiPut(`/api/payment-vouchers/${id}/status`, { status, currentStage: stage, signedFilesJson });
};

export const getProjectHeadSnapshots = async (projectId) => {
  return await apiGet(`/api/payment-vouchers/project-head-snapshots/${projectId}`);
};

export const getPaymentVoucherAccountDetails = async () => {
  return await apiGet('/api/payment-vouchers/account-details');
};

export const createPaymentVoucherAccountDetail = async (payeeData) => {
  return await apiPost('/api/payment-vouchers/account-details', payeeData);
};
