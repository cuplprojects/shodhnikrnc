import { apiGet, apiPost, apiPut } from './apiClient';

// --- PI-facing ----------------------------------------------------------

export const createProposalDraft = (payload) => apiPost('/api/proposals', payload);

export const updateProposal = (proposalId, payload) => apiPut(`/api/proposals/${proposalId}`, payload);

export const submitProposal = (proposalId, remarks) => apiPost(`/api/proposals/${proposalId}/submit`, { remarks: remarks || null });

export const withdrawProposal = (proposalId) => apiPost(`/api/proposals/${proposalId}/withdraw`, {});

/** Undoes the actor's own most recent (non-undone) action, per Task 6's WorkflowEngineService.UndoLastActionAsync. */
export const undoLastProposalAction = (proposalId) => apiPost(`/api/proposals/${proposalId}/undo`);

export const listMyProposals = (page = 1, pageSize = 10) =>
  apiGet(`/api/proposals/mine?page=${page}&pageSize=${pageSize}`);

// --- Chain actions (available to whichever role holds the current stage) ---

export const forwardProposal = (proposalId, remarks) =>
  apiPost(`/api/proposals/${proposalId}/forward`, { remarks: remarks || null });

export const rejectProposal = (proposalId, remarks) =>
  apiPost(`/api/proposals/${proposalId}/reject`, { remarks: remarks || null });

export const returnProposal = (proposalId, remarks) =>
  apiPost(`/api/proposals/${proposalId}/return`, { remarks: remarks || null });

export const approveProposal = (proposalId, remarks) =>
  apiPost(`/api/proposals/${proposalId}/approve`, { remarks: remarks || null });

// --- HOD ---------------------------------------------------------------

export const listProposalsForHod = () => apiGet('/api/proposals/for-hod');

// --- RnC office (RegularStaff/Superintendent/DeputyRegistrar/Dean) ------

/** Institute-wide, unlike listProposalsForHod -- office staff act across every department. */
export const listProposalsForRnCOffice = () => apiGet('/api/proposals/for-rnc-office');

/** Every active RegularStaff account, for the assign-Dealing-Assistant dropdown. */
export const listDealingAssistantOptions = () => apiGet('/api/proposals/dealing-assistant-options');

/** Names a specific RegularStaff person as Dealing Assistant and advances the proposal in one step. */
export const assignToDealingAssistant = (proposalId, assigneeUserId, remarks) =>
  apiPost(`/api/proposals/${proposalId}/assign-dealing-assistant`, { assigneeUserId, remarks: remarks || null });

export const recordAgencySubmission = (proposalId, submittedOn) =>
  apiPost(`/api/proposals/${proposalId}/record-agency-submission`, { submittedOn });

/** Returns the new Project's id -- the only path that ever creates one. */
export const recordSanction = (proposalId, payload) =>
  apiPost(`/api/proposals/${proposalId}/record-sanction`, payload);

export const recordNotFunded = (proposalId) =>
  apiPost(`/api/proposals/${proposalId}/record-not-funded`, {});

export const extendProposalExpiry = (proposalId, additionalDays = 21) =>
  apiPost(`/api/proposals/${proposalId}/extend-expiry?additionalDays=${additionalDays}`, {});

// --- Shared --------------------------------------------------------------

export const getProposal = (proposalId) => apiGet(`/api/proposals/${proposalId}`);

