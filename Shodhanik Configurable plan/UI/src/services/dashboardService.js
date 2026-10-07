/**
 * Dashboard Service
 * Handles API calls for dashboard statistics
 */
import API from './API';

export const dashboardService = {
  /**
   * Get dashboard statistics based on user role
   * @param {Object} user - User object with role information
   * @returns {Promise} API response with dashboard stats
   */
  getDashboardStats: async (user) => {
    try {
      // Get role name from user object
      const roleName = user?.selectedRole?.roleName || user?.roles?.[0]?.roleName || '';
      
      // Determine which API endpoint to call based on role
      if (roleName.toLowerCase().includes('admin') || roleName.toLowerCase().includes('superadmin')) {
        return await dashboardService.getAdminDashboard();
      } else if (roleName.toLowerCase().includes('supervisor')) {
        return await dashboardService.getSupervisorDashboard();
      } else if (roleName.toLowerCase().includes('scholar')) {
        return await dashboardService.getScholarDashboard();
      } else if (roleName.toLowerCase().includes('registrar')) {
        return await dashboardService.getRegistrarDashboard();
      } else {
        // Default to admin if role is unclear
        return await dashboardService.getAdminDashboard();
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  /**
   * Get admin dashboard statistics
   * @returns {Promise} API response with admin dashboard stats
   */
  getAdminDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/admin');
      return response.data;
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      throw error;
    }
  },

  /**
   * Get supervisor dashboard statistics
   * @returns {Promise} API response with supervisor dashboard stats
   */
  getSupervisorDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/supervisor');
      return response.data;
    } catch (error) {
      console.error('Error fetching supervisor dashboard:', error);
      throw error;
    }
  },

  /**
   * Get scholar dashboard statistics
   * @returns {Promise} API response with scholar dashboard stats
   */
  getScholarDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/scholar');
      return response.data;
    } catch (error) {
      console.error('Error fetching scholar dashboard:', error);
      throw error;
    }
  },

  /**
   * Get registrar dashboard statistics
   * @returns {Promise} API response with registrar dashboard stats
   */
  getRegistrarDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/registrar');
      return response.data;
    } catch (error) {
      console.error('Error fetching registrar dashboard:', error);
      throw error;
    }
  },

  /**
   * Get VCOffice dashboard statistics
   * @returns {Promise} API response with VCOffice dashboard stats
   */
  getVCOfficeDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/vcoffice');
      return response.data;
    } catch (error) {
      console.error('Error fetching VCOffice dashboard:', error);
      throw error;
    }
  },

  /**
   * Get Office dashboard statistics
   * @returns {Promise} API response with Office dashboard stats
   */
  getOfficeDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/office');
      return response.data;
    } catch (error) {
      console.error('Error fetching Office dashboard:', error);
      throw error;
    }
  },

  /**
   * Get SuperAdmin dashboard statistics
   * @returns {Promise} API response with SuperAdmin dashboard stats
   */
  getSuperAdminDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/superadmin');
      return response.data;
    } catch (error) {
      console.error('Error fetching SuperAdmin dashboard:', error);
      throw error;
    }
  },

  /**
   * Get SupervisorCell dashboard statistics
   * @returns {Promise} API response with SupervisorCell dashboard stats
   */
  getSupervisorCellDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/supervisorcell');
      return response.data;
    } catch (error) {
      console.error('Error fetching SupervisorCell dashboard:', error);
      throw error;
    }
  },

  /**
   * Get ExternalConfidential dashboard statistics
   * @returns {Promise} API response with ExternalConfidential dashboard stats
   */
  getExternalConfidentialDashboard: async () => {
    try {
      const response = await API.get('/Dashboard/externalconfidential');
      return response.data;
    } catch (error) {
      console.error('Error fetching ExternalConfidential dashboard:', error);
      throw error;
    }
  }
};

export default dashboardService;