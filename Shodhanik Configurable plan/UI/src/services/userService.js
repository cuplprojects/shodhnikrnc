// User Service - Handles all user-related API calls
import API from './API';

export const userService = {
  // Get all Users
  getAllUsers: async () => {
    try {
      const response = await API.get('/Admin/users');
      const data = response.data;
      
      // Transform API data to consistent format
      return data.map(user => ({
        key: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleName: user.roleName,
        roleId: user.roleId,
        permissions: Array.isArray(user.permissions) ? user.permissions : []
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const response = await API.get(`/Admin/users/${userId}`);
      const user = response.data;
      
      // Transform single user data
      return {
        key: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleName: user.roleName,
        roleId: user.roleId,
        permissions: Array.isArray(user.permissions) ? user.permissions : []
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },

  // Create new user
  createUser: async (userData) => {
    try {
      const payload = {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        roleId: userData.roleId
      };

      const response = await API.post('/Admin/users', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Update existing user
  updateUser: async (userId, userData) => {
    try {
      const payload = {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        roleId: userData.roleId
      };

      const response = await API.put(`/Admin/users/${userId}`, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  deleteUser: async (userId) => {
    try {
      const response = await API.delete(`/Admin/users/${userId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Update user role
  updateUserRole: async (userId, roleId) => {
    try {
      const payload = { roleId };

      const response = await API.put(`/Admin/users/${userId}/role`, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Update user status (active/inactive)
  updateUserStatus: async (userId, isActive) => {
    try {
      const payload = { isActive };

      const response = await API.put(`/Admin/users/${userId}/status`, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  },

  // Get user permissions (combined from role and direct permissions)
  getUserPermissions: async (userId) => {
    try {
      const response = await API.get(`/Admin/users/${userId}/permissions`);
      const data = response.data;
      return Array.isArray(data) ? data : data.permissions || [];
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      throw error;
    }
  },

  // Reset user password
  resetUserPassword: async (userId, newPassword) => {
    try {
      const payload = { password: newPassword };

      const response = await API.put(`/Admin/users/${userId}/reset-password`, payload);
      return response.data;
    } catch (error) {
      console.error('Error resetting user password:', error);
      throw error;
    }
  }
};