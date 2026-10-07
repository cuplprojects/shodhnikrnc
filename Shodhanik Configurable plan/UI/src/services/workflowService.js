import API from './API';

const workflowService = {
  getWorkflows: async () => {
    const response = await API.get('/WorkflowManagement');
    return response.data;
  },

  getWorkflow: async (id) => {
    const response = await API.get(`/WorkflowManagement/${id}`);
    return response.data;
  },

  createWorkflow: async (workflow) => {
    const response = await API.post('/WorkflowManagement', workflow);
    return response.data;
  },

  updateWorkflow: async (id, workflow) => {
    const response = await API.put(`/WorkflowManagement/${id}`, workflow);
    return response.data;
  },

  deleteWorkflow: async (id) => {
    const response = await API.delete(`/WorkflowManagement/${id}`);
    return response.data;
  },

  getRoles: async () => {
    const response = await API.get('/WorkflowManagement/roles');
    return response.data;
  },

  getWorkflowActions: async () => {
    const response = await API.get('/WorkflowAction');
    return response.data;
  },

  getPendingApprovals: async (roleId) => {
    const response = await API.get(`/ApprovalEngine/pending/${roleId}`);
    return response.data;
  },

  submitApprovalAction: async (request) => {
    const response = await API.post('/ApprovalEngine/action', request);
    return response.data;
  },
  
  submitApprovalActionWithFile: async (formData) => {
    const response = await API.post('/ApprovalEngine/action-with-file', formData);
    return response.data;
  },

  getEntityHistory: async (entityType, entityId) => {
    const response = await API.get(`/ApprovalEngine/history/${entityType}/${entityId}`);
    return response.data;
  },

  getBulkHistory: async (entityType, entityIds) => {
    if (!entityIds || entityIds.length === 0) return {};
    const response = await API.post('/ApprovalEngine/history-bulk', {
      entityType,
      entityIds
    });
    return response.data;
  },

  getSupervisorWorkflowList: async (params) => {
    const response = await API.get('/ApprovalEngine/supervisor-list', { params });
    return response.data;
  },

  getSupervisorWorkflowStats: async (params) => {
    const response = await API.get('/ApprovalEngine/supervisor-stats', { params });
    return response.data;
  }
};

export default workflowService;
