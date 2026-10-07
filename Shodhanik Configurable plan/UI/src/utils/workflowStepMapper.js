/**
 * Workflow Step Mapping Utility
 * 
 * Maps workflow steps to roles and provides helper functions for status determination
 * 
 * Database Workflow Configuration (WorkflowID = 5: Supervisor Registration):
 * - Step 1 (StepID 21) = Supervisor Cell / RAC (RoleID 16)
 * - Step 2 (StepID 22) = Deputy Registrar (RoleID 18)
 * - Step 3 (StepID 23) = Registrar (RoleID 3)
 * - Step 4 (StepID 24) = College Dean (RoleID 8)
 * - Step 5 (StepID 25) = Director of Research/DOR (RoleID 4)
 * - Step 6 (StepID 26) = VC Office (RoleID 2)
 */

export const WORKFLOW_STEPS = {
  SUPERVISOR_CELL: 1,
  DEPUTY_REGISTRAR: 2,
  REGISTRAR: 3,
  DEAN: 4,
  DOR: 5,
  VC_OFFICE: 6
};

export const ROLE_TO_STEP = {
  16: WORKFLOW_STEPS.SUPERVISOR_CELL,
  18: WORKFLOW_STEPS.DEPUTY_REGISTRAR,
  3: WORKFLOW_STEPS.REGISTRAR,
  8: WORKFLOW_STEPS.DEAN,
  4: WORKFLOW_STEPS.DOR,
  2: WORKFLOW_STEPS.VC_OFFICE,
  21: WORKFLOW_STEPS.VC_OFFICE // Alternative VC Office role
};

export const STEP_TO_ROLE = {
  1: 16, // Supervisor Cell
  2: 18, // Deputy Registrar
  3: 3,  // Registrar
  4: 8,  // Dean
  5: 4,  // DOR
  6: 2   // VC Office
};

export const STEP_NAMES = {
  1: 'Supervisor Cell',
  2: 'Deputy Registrar',
  3: 'Registrar',
  4: 'College Dean',
  5: 'Director of Research',
  6: 'VC Office'
};

/**
 * Get the step order for a given role ID
 * @param {number} roleId - The role ID
 * @returns {number} The step order (1-6)
 */
export const getStepOrderForRole = (roleId) => {
  return ROLE_TO_STEP[roleId] || 1;
};

/**
 * Get the role ID for a given step order
 * @param {number} stepOrder - The step order (1-6)
 * @returns {number} The role ID
 */
export const getRoleForStepOrder = (stepOrder) => {
  return STEP_TO_ROLE[stepOrder];
};

/**
 * Get the step name for a given step order
 * @param {number} stepOrder - The step order (1-6)
 * @returns {string} The step name
 */
export const getStepName = (stepOrder) => {
  return STEP_NAMES[stepOrder] || `Step ${stepOrder}`;
};

/**
 * Determine the status for a specific step based on workflow history and current state
 * @param {Object} params - Parameters
 * @param {number} params.stepOrder - The step order to check status for
 * @param {Array} params.workflowHistory - Array of workflow log entries
 * @param {number} params.currentStepOrder - Current step order from workflow instance
 * @param {string} params.workflowStatus - Current workflow status (Pending, Approved, Rejected)
 * @param {boolean} params.isLocked - Whether the workflow is locked
 * @returns {string} Status: 'Unscreened', 'Eligible', 'Not Eligible', 'Approved', 'Rejected'
 */
export const getStatusForStep = ({ 
  stepOrder, 
  workflowHistory = [], 
  currentStepOrder = 0, 
  workflowStatus = 'Pending',
  isLocked = false 
}) => {
  // Ensure workflowHistory is an array
  const history = Array.isArray(workflowHistory) ? workflowHistory : [];
  
  // Check if this step has been processed
  const stepLog = history.find(log => log.stepOrder === stepOrder);
  
  if (stepLog) {
    // If there's a log entry for this step, use that action
    return stepLog.action === 'Approve' ? 'Eligible' : 'Not Eligible';
  }
  
  // If current step is beyond this step, it means this step was approved
  if (currentStepOrder > stepOrder) {
    return 'Eligible';
  }
  
  // If workflow is rejected and locked
  if (workflowStatus === 'Rejected' && isLocked) {
    return 'Not Eligible';
  }
  
  // If current step is this step, it's pending/unscreened
  if (currentStepOrder === stepOrder) {
    return 'Unscreened';
  }
  
  // If current step is before this step, it hasn't reached here yet
  if (currentStepOrder < stepOrder) {
    return 'Unscreened';
  }
  
  return 'Unscreened';
};

/**
 * Check if a step is locked (completed or cannot be modified)
 * @param {Object} params - Parameters
 * @param {number} params.stepOrder - The step order to check
 * @param {Array} params.workflowHistory - Array of workflow log entries
 * @param {boolean} params.isLocked - Whether the workflow instance is locked
 * @param {Object} params.legacyScreeningData - Legacy screening data (optional)
 * @returns {boolean} True if the step is locked
 */
export const isStepLocked = ({ 
  stepOrder, 
  workflowHistory = [], 
  isLocked = false,
  legacyScreeningData = null 
}) => {
  // If workflow instance is locked (rejected twice)
  if (isLocked) {
    return true;
  }
  
  // Ensure workflowHistory is an array
  const history = Array.isArray(workflowHistory) ? workflowHistory : [];
  
  // Check if current step is already approved in workflow history
  const currentStepApproved = history.some(
    log => log.stepOrder === stepOrder && log.action === 'Approve'
  );
  
  if (currentStepApproved) {
    return true;
  }
  
  // Fallback to legacy screening data if provided
  if (legacyScreeningData) {
    const status = legacyScreeningData[`screening${stepOrder}Status`];
    const count = legacyScreeningData[`screening${stepOrder}Count`];
    return status === 1 || (status === 2 && count >= 2);
  }
  
  return false;
};

/**
 * Parse workflow history response to handle both old and new formats
 * @param {Object|Array} historyResponse - Response from getEntityHistory API
 * @returns {Object} Object with logs array and instance object
 */
export const parseWorkflowHistoryResponse = (historyResponse) => {
  if (!historyResponse) {
    return { logs: [], instance: null };
  }
  
  // New format: { logs: [], instance: {} }
  if (historyResponse.logs && Array.isArray(historyResponse.logs)) {
    return {
      logs: historyResponse.logs,
      instance: historyResponse.instance || null
    };
  }
  
  // Old format: just an array of logs
  if (Array.isArray(historyResponse)) {
    return {
      logs: historyResponse,
      instance: null
    };
  }
  
  return { logs: [], instance: null };
};

/**
 * Get display label for status
 * @param {string} status - Status value
 * @param {number} stepOrder - Step order (for context)
 * @returns {string} Display label
 */
export const getStatusLabel = (status, stepOrder = null) => {
  const labels = {
    'Unscreened': 'Unscreened',
    'Eligible': stepOrder === 6 ? 'Final Accepted' : 'Approved',
    'Not Eligible': stepOrder === 6 ? 'Final Rejected' : 'Rejected',
    'Approved': stepOrder === 6 ? 'Final Accepted' : 'Approved',
    'Rejected': stepOrder === 6 ? 'Final Rejected' : 'Rejected'
  };
  
  return labels[status] || status;
};

export default {
  WORKFLOW_STEPS,
  ROLE_TO_STEP,
  STEP_TO_ROLE,
  STEP_NAMES,
  getStepOrderForRole,
  getRoleForStepOrder,
  getStepName,
  getStatusForStep,
  isStepLocked,
  parseWorkflowHistoryResponse,
  getStatusLabel
};
