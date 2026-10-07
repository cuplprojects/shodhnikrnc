// store/staffAuthStore.js
import { create } from 'zustand';
import StorageService from '@/utils/storage';

const useStaffAuthStore = create((set, get) => ({
  // Auth state
  isAuthenticated: false,
  user: null,
  userPermissions: [],
  isLoading: true,
  isInitialized: false,

  // Initialize auth from localStorage
  initializeAuth: () => {
    set({ isLoading: true });

    const token = StorageService.get('staffAuthToken');
    const storedUser = StorageService.get('staffUser');

    if (token && storedUser) {
      try {
        // StorageService.get() already returns parsed object, no need for JSON.parse
        const userData = storedUser;
        
        // The user data should already contain permissions from login
        let permissions = [];
        
        // Check if permissions are directly in user object (new format)
        if (userData.permissions && Array.isArray(userData.permissions)) {
          permissions = userData.permissions;
        } 
        // Fallback: Check if this is legacy format with full API response
        else if (userData.success && userData.permissions) {
          permissions = userData.permissions;
        }
        // Final fallback: Super Admin check
        else if (userData.roleName === 'Super Admin' || userData.roleId === 1) {
          permissions = ['*'];
        }
        
        // Extract clean user data (handle both new and legacy formats)
        let user = userData;
        if (userData.success && userData.user) {
          // Legacy format - extract user from API response
          user = userData.user;
        }
        
        // Check token expiration
        if (user.tokenExp) {
          const currentTime = Math.floor(Date.now() / 1000);
          if (currentTime >= user.tokenExp) {
            get().clearAuthData();
            return;
          }
        }

        set({ 
          isAuthenticated: true, 
          user, 
          userPermissions: permissions,
          isLoading: false,
          isInitialized: true
        });
      } catch (error) {
        console.error('Staff auth initialization error:', error);
        get().clearAuthData();
      }
    } else {
      set({ 
        isAuthenticated: false,
        user: null, 
        userPermissions: [],
        isLoading: false,
        isInitialized: true
      });
    }
  },

  // Login action - Permission-based only
  login: (userData, token, permissions = []) => {
    // Clear all storage first to prevent conflicts
    StorageService.clear();
    
    // Handle case where entire API response is passed as userData (bug detection)
    let actualUserData = userData;
    let actualPermissions = permissions;
    let actualToken = token;
    
    if (userData && userData.success && userData.user) {
      actualUserData = userData.user;
      actualPermissions = userData.permissions || [];
      actualToken = userData.token || token;
    }
    
    // Ensure permissions are valid array
    const validPermissions = Array.isArray(actualPermissions) ? actualPermissions : [];
    
    // Create clean user data with permissions embedded
    const cleanUserData = {
      id: actualUserData.id,
      username: actualUserData.username,
      email: actualUserData.email,
      name: actualUserData.name,
      phone: actualUserData.phone,
      department: actualUserData.department,
      roleId: actualUserData.roleId,
      roleName: actualUserData.roleName,
      tokenExp: actualUserData.tokenExp,
      permissions: validPermissions // Embed permissions in user object
    };
    
    // Store clean user data (with permissions embedded)
    StorageService.set('staffAuthToken', actualToken);
    StorageService.set('staffUser', cleanUserData);
    
    // Also store permissions as backup (for compatibility)
    StorageService.set('user-permissions', validPermissions);
    
    // Update store state immediately
    set({ 
      isAuthenticated: true, 
      user: cleanUserData,
      userPermissions: validPermissions,
      isLoading: false,
      isInitialized: true
    });
  },

  // Set permissions separately (for dynamic permission updates)
  setPermissions: (permissions) => {
    StorageService.set('user-permissions', permissions);
    set({ userPermissions: permissions });
  },

  // Logout action
  logout: () => {
    get().clearAuthData();
  },

  // Clear all auth data
  clearAuthData: () => {
    StorageService.clear();
    set({ 
      isAuthenticated: false, 
      user: null, 
      userPermissions: [],
      isLoading: false,
      isInitialized: true
    });
  },

  // Set loading state
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // Refresh permissions from localStorage
  refreshPermissions: () => {
    const storedUser = StorageService.get('staffUser');
    const permissions = StorageService.get('user-permissions');
    
    let validPermissions = [];
    
    // First try to get permissions from user object
    if (storedUser) {
      try {
        // StorageService.get() already returns parsed object, no need for JSON.parse
        const userData = storedUser;
        if (userData.permissions && Array.isArray(userData.permissions)) {
          validPermissions = userData.permissions;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // Fallback to stored permissions
    if (validPermissions.length === 0 && permissions) {
      try {
        validPermissions = Array.isArray(permissions) ? permissions : [];
      } catch (error) {
        console.error('Error parsing permissions:', error);
      }
    }
    
    // Final fallback for Super Admin
    if (validPermissions.length === 0) {
      const currentUser = get().user;
      if (currentUser && (currentUser.roleName === 'Super Admin' || currentUser.roleId === 1)) {
        validPermissions = ['*'];
      }
    }
    
    set({ userPermissions: validPermissions });
  },


}));

export default useStaffAuthStore;