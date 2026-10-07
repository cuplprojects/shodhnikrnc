// Role Service - Handles all role-related API calls
import API from './API';

export const roleService = {
  // Get all roles
  getAllRoles: async () => {
    try {
      const response = await API.get('/Admin/roles');
      const data = response.data;
      
      // Transform API data to consistent format
      return data.map(role => ({
        key: role.id,
        id: role.id,
        name: role.roleName || role.name,
        description: role.description,
        userCount: role.userCount || 0,
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
        createdAt: role.createdAt || role.created_at || new Date().toISOString(),
        updatedAt: role.updatedAt || role.updated_at || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error;
    }
  },

  // Get role by ID
  getRoleById: async (roleId) => {
    try {
      const response = await API.get(`/Admin/roles/${roleId}`);
      const role = response.data;
      
      // Transform single role data
      return {
        key: role.id,
        id: role.id,
        name: role.roleName || role.name,
        description: role.description,
        userCount: role.userCount || 0,
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
        createdAt: role.createdAt || role.created_at || new Date().toISOString(),
        updatedAt: role.updatedAt || role.updated_at || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching role:', error);
      throw error;
    }
  },

  // Create new role
  createRole: async (roleData) => {
    try {
      const payload = {
        roleName: roleData.roleName || roleData.name,
        description: roleData.description,
        permissionsList: Array.isArray(roleData.permissions) 
          ? roleData.permissions 
          : []
      };

      const response = await API.post('/Admin/roles', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  },

  // Update existing role
  updateRole: async (roleId, roleData) => {
    try {
      const payload = {
        roleName: roleData.roleName || roleData.name,
        description: roleData.description,
        permissionsList: Array.isArray(roleData.permissions) 
          ? roleData.permissions 
          : []
      };

      const response = await API.put(`/Admin/roles/${roleId}`, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  },

  // Delete role
  deleteRole: async (roleId) => {
    try {
      const response = await API.delete(`/Admin/roles/${roleId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  },


};