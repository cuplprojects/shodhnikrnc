import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export const listProjects = () => apiGet('/api/projects');
export const listProcessBillProjects = () => apiGet('/api/projects/process-bill');
export const getProject = (id) => apiGet(`/api/projects/${id}`);
export const createProject = (payload) => apiPost('/api/projects', payload);
export const updateProject = (id, payload) => apiPut(`/api/projects/${id}`, payload);
export const deleteProject = (id) => apiDelete(`/api/projects/${id}`);
export const getBudgetSummary = (id) => apiGet(`/api/projects/${id}/budget-summary`);
export const listGrantReceipts = (id) => apiGet(`/api/projects/${id}/grant-receipts`);
export const recordGrantReceipt = (id, payload) => apiPost(`/api/projects/${id}/grant-receipts`, payload);
export const getSanctionedManpowerPositions = (id) => apiGet(`/api/projects/${id}/manpower-positions`);
export const createOfferLetter = (payload) => apiPost('/api/projects/offer-letters', payload);
export const listOfferLetters = (projectId, manpowerId) => {
  const params = new URLSearchParams();
  if (projectId) params.append('projectId', projectId);
  if (manpowerId) params.append('manpowerId', manpowerId);
  const queryString = params.toString();
  return apiGet(queryString ? `/api/projects/offer-letters?${queryString}` : '/api/projects/offer-letters');
};

export const getOfferLetterData = (id) => apiGet(`/api/recruitments/${id}/offer-letter-data`);
export const getRecruitmentCandidates = (id) => apiGet(`/api/recruitments/${id}/candidates`);
export const issueRecruitmentOffer = (id, payload) => apiPost(`/api/recruitments/${id}/offer`, payload);
export const recordJoining = (id, payload) => apiPost(`/api/recruitments/${id}/joining`, payload);

export const reappropriateBudget = (id, payload) => apiPost(`/api/projects/${id}/reappropriate`, payload);
export const getReappropriationHistory = (id) => apiGet(`/api/projects/${id}/reappropriations`);
export const resubmitReappropriation = (projectId, reqId, payload) => apiPut(`/api/projects/${projectId}/reappropriations/${reqId}/resubmit`, payload);

// --- Reappropriation approval chain ----------------------------------------
export const listPendingReappropriations = () => apiGet('/api/projects/reappropriations/pending');
export const listHistoryReappropriations = () => apiGet('/api/projects/reappropriations/history');
export const forwardReappropriation = (projectId, reqId, remarks) => apiPost(`/api/projects/reappropriations/${reqId}/forward`, { remarks: remarks || null });
export const approveReappropriation = (projectId, reqId, remarks) => apiPost(`/api/projects/reappropriations/${reqId}/approve`, { remarks: remarks || null });
export const rejectReappropriation = (projectId, reqId, remarks) => apiPost(`/api/projects/reappropriations/${reqId}/reject`, { remarks: remarks || null });
export const returnReappropriation = (projectId, reqId, remarks) => apiPost(`/api/projects/reappropriations/${reqId}/return`, { remarks: remarks || null });

// --- Grant-receipt approval chain (PI -> HOD -> R&C office -> Dean) --------
// `id` is the project, carried in the route only to match ProjectsController's
// existing {id:guid}/grant-receipts nesting -- the service methods key off
// receiptId alone.

export const forwardGrantReceipt = (id, receiptId, remarks) =>
  apiPost(`/api/projects/${id}/grant-receipts/${receiptId}/forward`, { remarks: remarks || null });

export const approveGrantReceipt = (id, receiptId, remarks) =>
  apiPost(`/api/projects/${id}/grant-receipts/${receiptId}/approve`, { remarks: remarks || null });

export const rejectGrantReceipt = (id, receiptId, remarks) =>
  apiPost(`/api/projects/${id}/grant-receipts/${receiptId}/reject`, { remarks: remarks || null });

export const returnGrantReceipt = (id, receiptId, remarks) =>
  apiPost(`/api/projects/${id}/grant-receipts/${receiptId}/return`, { remarks: remarks || null });

// Grant-receipt queue pages -- discovery aids mirroring
// listProposalsForHod/listProposalsForRnCOffice exactly.
export const listGrantReceiptsForHod = () => apiGet('/api/projects/grant-receipts/hod-queue');
export const listGrantReceiptsForRnCOffice = () => apiGet('/api/projects/grant-receipts/rnc-queue');
export const listGrantReceiptsForDa = () => apiGet('/api/projects/grant-receipts/da-queue');
export const listGrantReceiptsForSuperintendent = () => apiGet('/api/projects/grant-receipts/superintendent-queue');
export const listGrantReceiptsForDeputyRegistrar = () => apiGet('/api/projects/grant-receipts/dr-queue');
export const listGrantReceiptsForDean = () => apiGet('/api/projects/grant-receipts/dean-queue');

// action is one of 'Forward' | 'Approve' | 'Reject' | 'Return', matching the
// GrantReceiptBulkAction enum. All-or-nothing on the backend: if any receipt
// in receiptIds fails, none of them are applied.
export const bulkActOnGrantReceipts = (receiptIds, action, remarks) =>
  apiPost('/api/projects/grant-receipts/bulk-action', { receiptIds, action, remarks: remarks || null });

// Project Update workflow endpoints (PI -> HOD -> R&C Office -> Dean)
export const submitProject = (id, remarks) =>
  apiPost(`/api/projects/${id}/submit`, { remarks: remarks || null });
export const forwardProject = (id, remarks) =>
  apiPost(`/api/projects/${id}/forward`, { remarks: remarks || null });
export const approveProject = (id, remarks) =>
  apiPost(`/api/projects/${id}/approve`, { remarks: remarks || null });
export const rejectProject = (id, remarks) =>
  apiPost(`/api/projects/${id}/reject`, { remarks: remarks || null });
export const returnProject = (id, remarks) =>
  apiPost(`/api/projects/${id}/return`, { remarks: remarks || null });

// --- Permanent per-project Dealing Assistant --------------------------------
export const assignProjectDa = (id, payload) => apiPost(`/api/projects/${id}/assign-da`, payload);
export const getDaAssignmentHistory = (id) => apiGet(`/api/projects/${id}/da-assignments`);

