import { apiGet, apiPost } from './apiClient';
import { INDENT_TYPES } from '../constants/procurementEnums';

function segmentFor(indentType) {
  const match = INDENT_TYPES.find((t) => t.value === indentType);
  if (!match) throw new Error(`Unknown indent type: ${indentType}`);
  return match.apiSegment;
}

export const listIndentsForProject = (indentType, projectId) =>
  apiGet(`/api/projects/${projectId}/${segmentFor(indentType)}`);

export const getIndent = (indentType, indentId) =>
  apiGet(`/api/${segmentFor(indentType)}/${indentId}`);

/** `formData` must be FormData — the endpoint is multipart so a GeM quotation can be attached. */
export const raiseIndent = (indentType, projectId, formData) =>
  apiPost(`/api/projects/${projectId}/${segmentFor(indentType)}`, formData);

export const processBill = (indentType, indentId, payload) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/process-bill`, payload);

// --- Chain actions (available to whichever role holds the current stage) ---

export const forwardIndent = (indentType, indentId, remarks) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/forward`, { remarks: remarks || null });

/**
 * ForwardedDR is a decision stage: plain `forward` is blocked there by the
 * workflow engine (Dean either approves outright or escalates to Director --
 * there is no ordinary "next step"). This posts to the dedicated
 * forward-to-director endpoint instead, the only way to reach the Director
 * stage from ForwardedDR.
 */
export const forwardIndentToDirector = (indentType, indentId, remarks) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/forward-to-director`, { remarks: remarks || null });

export const approveIndent = (indentType, indentId, remarks) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/approve`, { remarks: remarks || null });

export const rejectIndent = (indentType, indentId, remarks) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/reject`, { remarks: remarks || null });

export const returnIndent = (indentType, indentId, remarks) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/return`, { remarks: remarks || null });

export const getIndentBudget = (budgetHeadId, subHead) =>
  apiGet(`/api/budget-heads/${budgetHeadId}/indent-budget${subHead ? `?subHead=${subHead}` : ''}`);

export const listAllProcurementIndents = () =>
  apiGet('/api/procurement/all-indents');

// --- Market Committee step recording ---

export const getMarketCommitteeSteps = (indentType, indentId) =>
  apiGet(`/api/${segmentFor(indentType)}/${indentId}/market-committee`);

export const recordMarketCommitteeStep = (indentType, indentId, step, recordedOn) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/market-committee`, { step, recordedOn });

