import apiClient from '@/config/apiClient';

// Office Service - Handles supervisor review operations
const officeService = {
  // Fetch supervisors for screening review
  fetchProvisionalSupervisors: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add pagination
      if (params.page) queryParams.append('page', params.page);
      if (params.pageSize) queryParams.append('pageSize', params.pageSize);
      
      // Add search
      if (params.search) queryParams.append('search', params.search);
      
      // Add status filter
      if (params.status && Array.isArray(params.status) && params.status.length > 0) {
        params.status.forEach(status => queryParams.append('status', status));
      }
      
      // Add sorting
      if (params.sortField) queryParams.append('sortField', params.sortField);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/office/supervisors/provisional?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supervisors for screening:', error);
      throw error;
    }
  },

  // Get status counts for supervisor review
  getStatusCounts: async (type = 'supervisor_review') => {
    try {
      const response = await apiClient.get(`/office/supervisors/status-counts?type=${type}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching status counts:', error);
      throw error;
    }
  },

  // Update supervisor status (approve/reject)
  updateSupervisorStatus: async (supId, status, remarks = '') => {
    try {
      const response = await apiClient.put(`/office/supervisors/${supId}/status`, {
        status,
        remarks,
        updatedBy: 'office', // Indicates this update is from office
        timestamp: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      console.error('Error updating supervisor status:', error);
      throw error;
    }
  },

  // Get supervisor details for review
  getSupervisorDetails: async (supId) => {
    try {
      const response = await apiClient.get(`/office/supervisors/${supId}/details`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supervisor details:', error);
      throw error;
    }
  },

  // Get supervisor application history
  getSupervisorHistory: async (supId) => {
    try {
      const response = await apiClient.get(`/office/supervisors/${supId}/history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supervisor history:', error);
      throw error;
    }
  },

  // Bulk update supervisor statuses
  bulkUpdateSupervisorStatus: async (supervisorIds, status, remarks = '') => {
    try {
      const response = await apiClient.put('/office/supervisors/bulk-update', {
        supervisorIds,
        status,
        remarks,
        updatedBy: 'office',
        timestamp: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk updating supervisor statuses:', error);
      throw error;
    }
  },

  // Export supervisors data
  exportSupervisors: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters
      if (params.search) queryParams.append('search', params.search);
      if (params.status && Array.isArray(params.status) && params.status.length > 0) {
        params.status.forEach(status => queryParams.append('status', status));
      }
      if (params.format) queryParams.append('format', params.format); // csv, xlsx

      const response = await apiClient.get(`/office/supervisors/export?${queryParams.toString()}`, {
        responseType: 'blob'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error exporting supervisors:', error);
      throw error;
    }
  },

  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      const response = await apiClient.get('/office/dashboard/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
};

// Export individual functions for backward compatibility
export const fetchProvisionalSupervisors = officeService.fetchProvisionalSupervisors;
export const getStatusCounts = officeService.getStatusCounts;
export const updateSupervisorStatus = officeService.updateSupervisorStatus;
export const getSupervisorDetails = officeService.getSupervisorDetails;
export const getSupervisorHistory = officeService.getSupervisorHistory;
export const bulkUpdateSupervisorStatus = officeService.bulkUpdateSupervisorStatus;
export const exportSupervisors = officeService.exportSupervisors;
export const getDashboardStats = officeService.getDashboardStats;

export default officeService;