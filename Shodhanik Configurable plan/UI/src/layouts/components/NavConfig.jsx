// Permission-based navigation configuration
// Now uses centralized route configuration
import { generateStaffNavConfig } from '@/services/routeService';
import useStaffAuthStore from '@/store/staffAuthStore';

// 🔑 Function to get permission-based navigation
// Note: This function is called within a React component context
// The component should subscribe to store changes for reactivity
export const getNavConfig = () => {
  const { user, userPermissions, isAuthenticated } = useStaffAuthStore.getState();
  
  if (!user) {
    return []; // No menu items if no user
  }

  // Check if we have permissions in store or user object
  const hasStorePermissions = Array.isArray(userPermissions) && userPermissions.length > 0;
  const hasUserPermissions = user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0;
  const hasPermissions = hasStorePermissions || hasUserPermissions;
  
  // Check for full access permission (wildcard)
  const hasFullAccess = (hasStorePermissions && userPermissions.includes('*')) || 
                       (hasUserPermissions && user.permissions.includes('*'));
  
  if (!hasPermissions) {
    return []; // No menu items if no permissions
  }
  
  // Generate navigation from centralized config
  return generateStaffNavConfig();
};

// Backward compatibility exports
export const getRoleNavConfig = getNavConfig;
export const getStaffNavConfig = getNavConfig;