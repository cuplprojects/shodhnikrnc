/**
 * Authentication Service
 * Handles API calls for all user types (Staff, Scholar, Supervisor)
 */
import API from './API';
import StorageService from '@/utils/storage';

// Staff Authentication - Permission-based only
export const staffAuthService = {
  /**
   * Staff login - returns user data and permissions (no roles)
   * @param {Object} credentials - { username, password }
   * @returns {Promise} API response
   */
  login: async (credentials) => {
    try {
      const response = await API.post('/Login/Admin', {
        username: credentials.username,
        password: credentials.password
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Staff logout
   * @returns {Promise} API response
   */
  logout: async () => {
    try {
      const response = await API.post('/auth/staff/logout');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify staff token
   * @returns {Promise} API response
   */
  verifyToken: async () => {
    try {
      const response = await API.get('/auth/staff/verify');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Staff forgot password
   * @param {string} email - Staff email
   * @returns {Promise} API response
   */
  forgotPassword: async (email) => {
    try {
      const response = await API.post('/auth/staff/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Staff reset password
   * @param {Object} data - { token, newPassword }
   * @returns {Promise} API response
   */
  resetPassword: async (data) => {
    try {
      const response = await API.post('/auth/staff/reset-password', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Scholar Authentication
export const scholarAuthService = {
  /**
   * Scholar login
   * @param {Object} credentials - { username, password } or { applicationNumber, password } or { studentId, password }
   * @returns {Promise} API response
   */
  login: async (credentials) => {
    try {
      let payload;

      if (credentials.username) {
        // From OuterLayout - send username as is
        payload = {
          username: credentials.username,
          password: credentials.password
        };
      } else if (credentials.applicationNumber) {
        // From ScholarLogin - send applicationNumber
        payload = {
          applicationNumber: credentials.applicationNumber,
          password: credentials.password
        };
      } else if (credentials.studentId) {
        // Legacy format - convert to ApplicationNumber
        payload = {
          ApplicationNumber: credentials.studentId,
          Password: credentials.password
        };
      } else {
        throw new Error('Invalid credentials format');
      }

      const response = await API.post('/Login/Scholar', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Scholar registration
   * @param {Object} registrationData - Scholar registration details
   * @returns {Promise} API response
   */
  register: async (registrationData) => {
    try {
      const response = await API.post('/auth/scholar/register', registrationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Scholar logout
   * @returns {Promise} API response
   */
  logout: async () => {
    try {
      const response = await API.post('/auth/scholar/logout');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify scholar token
   * @returns {Promise} API response
   */
  verifyToken: async () => {
    try {
      const response = await API.get('/auth/scholar/verify');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Scholar forgot password
   * @param {string} studentId - Scholar student ID
   * @returns {Promise} API response
   */
  forgotPassword: async (studentId) => {
    try {
      const response = await API.post('/auth/scholar/forgot-password', { studentId });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Scholar change password
   * @param {Object} data - { userId, oldPassword, newPassword, isSelected }
   * @returns {Promise} API response
   */
  changePassword: async (data) => {
    try {
      // Use different endpoint based on whether scholar is selected (Decision == 1)
      const endpoint = data.isSelected
        ? `/Login/Changepassword/SelectedScholar/${data.userId}`
        : `/Login/Changepassword/Scholar/${data.userId}`;

      const response = await API.put(endpoint, {
        OldPassword: data.oldPassword,
        NewPassword: data.newPassword
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get scholar application status by sasid
   * @param {number} sasid - Scholar Application Status ID
   * @returns {Promise} API response with application status
   */
  getApplicationStatus: async (sasid) => {
    try {
      const response = await API.get(`/ScholarApplicationStatus/${sasid}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create new scholar application status
   * @param {Object} payload - Application status data
   * @returns {Promise} API response with created status
   */
  createApplicationStatus: async (payload) => {
    try {
      const response = await API.post('/ScholarApplicationStatus', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update scholar application status
   * @param {number} sasid - Scholar Application Status ID
   * @param {Object} payload - Updated application status data
   * @returns {Promise} API response
   */
  updateApplicationStatus: async (sasid, payload) => {
    try {
      const response = await API.put(`/ScholarApplicationStatus/${sasid}`, payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};



// Supervisor Authentication
export const supervisorAuthService = {
  /**
   * Supervisor login
   * @param {Object} credentials - { applicationNumber, password } or { username, password }
   * @returns {Promise} API response
   */
  login: async (credentials) => {
    try {
      let payload;

      if (credentials.applicationNumber) {
        // Login with application number
        payload = {
          ApplicationNumber: credentials.applicationNumber,
          Password: credentials.password
        };
      } else if (credentials.username) {
        // Login with username
        payload = {
          Username: credentials.username,
          Password: credentials.password
        };
      } else {
        throw new Error('Invalid credentials format');
      }

      const response = await API.post('/Login/Supervisor', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Supervisor registration
   * @param {Object} registrationData - Supervisor registration details
   * @returns {Promise} API response
   */
  register: async (registrationData) => {
    try {
      const response = await API.post('/auth/supervisor/register', registrationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Supervisor logout
   * @returns {Promise} API response
   */
  logout: async () => {
    try {
      const response = await API.post('/auth/supervisor/logout');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify supervisor token
   * @returns {Promise} API response
   */
  verifyToken: async () => {
    try {
      const response = await API.get('/auth/supervisor/verify');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Supervisor forgot password
   * @param {string} applicationNumber - Supervisor application number
   * @returns {Promise} API response
   */
  forgotPassword: async (applicationNumber) => {
    try {
      const response = await API.post('/auth/supervisor/forgot-password', { applicationNumber });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Supervisor change password
   * @param {Object} data - { userId, oldPassword, newPassword, isAccepted }
   * @returns {Promise} API response
   */
  changePassword: async (data) => {
    try {
      // Use different endpoint based on whether supervisor is accepted (IsAccepted == 1)
      const endpoint = data.isAccepted
        ? `/Login/Changepassword/SelectedSupervisor/${data.userId}`
        : `/Login/Changepassword/Supervisor/${data.userId}`;

      const response = await API.put(endpoint, {
        OldPassword: data.oldPassword,
        NewPassword: data.newPassword
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Common authentication utilities
export const authUtils = {
  /**
   * Check if token is expired
   * @param {number} exp - Token expiration timestamp
   * @returns {boolean} True if token is expired
   */
  isTokenExpired: (exp) => {
    if (!exp) return true;
    const currentTime = Math.floor(Date.now() / 1000);
    return exp < currentTime;
  },

  /**
   * Get token from localStorage
   * @param {string} userType - 'staff', 'scholar', or 'supervisor'
   * @returns {string|null} Token or null
   */
  getToken: (userType) => {
    return StorageService.get(`${userType}AuthToken`);
  },

  /**
   * Get user data from localStorage
   * @param {string} userType - 'staff', 'scholar', or 'supervisor'
   * @returns {Object|null} User data or null
   */
  getUser: (userType) => {
    const userData = StorageService.get(`${userType}User`);
    try {
      // StorageService.get() already returns parsed object, no need for JSON.parse
      return userData || null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  },

  /**
   * Clear authentication data
   * @param {string} userType - 'staff', 'scholar', or 'supervisor'
   */
  clearAuthData: (userType) => {
    StorageService.remove(`${userType}AuthToken`);
    StorageService.remove(`${userType}User`);
  }
};