// services/hasPermissionService.js
// Simple permission service for module-based access control

import useStaffAuthStore from '@/store/staffAuthStore';

export function hasPermission(requiredPermission) {
  // If no permission required, allow access
  if (!requiredPermission) return true;
  
  const { user, userPermissions, isAuthenticated } = useStaffAuthStore.getState();
  
  // If not authenticated or no user, deny access
  if (!isAuthenticated || !user) return false;
  
  // Get permissions from store or user object as fallback
  let permissions = userPermissions;
  
  // If store permissions are empty/invalid, try user object
  if (!Array.isArray(permissions) || permissions.length === 0) {
    if (user.permissions && Array.isArray(user.permissions)) {
      permissions = user.permissions;
    } else {
      return false;
    }
  }
  
  // Super Admin with "*" has access to everything
  if (permissions.includes('*')) {
    return true;
  }
  
  // Check for exact permission match
  if (permissions.includes(requiredPermission)) {
    return true;
  }
  
  // Handle wildcard permissions
  return checkWildcardPermissions(permissions, requiredPermission);
}

// Check wildcard permissions against required permission
function checkWildcardPermissions(userPermissions, requiredPermission) {
  const requiredParts = requiredPermission.split('.');
  
  for (const userPerm of userPermissions) {
    if (!userPerm.includes('*')) continue;
    
    const userParts = userPerm.split('.');
    
    // Simple wildcard matching
    if (userParts.length === 2 && userParts[1] === '*') {
      // Module wildcard: "user_management.*"
      if (userParts[0] === requiredParts[0]) return true;
    }
    
    if (userParts.length === 2 && userParts[0] === '*') {
      // Action wildcard: "*.read"
      if (userParts[1] === requiredParts[1]) return true;
    }
  }
  
  return false;
}

// Check if user can access a module at all (has any permission for it)
export function canAccessModule(moduleKey) {
  const { userPermissions } = useStaffAuthStore.getState();
  
  // Super Admin with "*" can access everything
  if (userPermissions.includes('*')) return true;
  
  // Check direct permissions
  if (userPermissions.some(permission => permission.startsWith(`${moduleKey}.`))) {
    return true;
  }
  
  // Check module wildcard permissions
  if (userPermissions.includes(`${moduleKey}.*`)) {
    return true;
  }
  
  return false;
}

// Examples of permissions:
// "*" - Super Admin permission (access to everything)
// "user_management.*" - All actions on user_management module
// "user_management.read" - Specific permission for reading user management
// "*.read" - Read permission on all modules

// React hook version for reactive permission checking
export function useHasPermission(requiredPermission) {
  const { user, userPermissions, isAuthenticated } = useStaffAuthStore();
  
  // If no permission required, allow access
  if (!requiredPermission) return true;
  
  // If not authenticated or no user, deny access
  if (!isAuthenticated || !user) return false;
  
  // Check if userPermissions is an array
  if (!Array.isArray(userPermissions)) {
    console.warn('userPermissions is not an array:', typeof userPermissions, userPermissions);
    return false;
  }
  
  // Super Admin with "*" has access to everything
  if (userPermissions.includes('*')) {
    return true;
  }
  
  // Check for exact permission match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }
  
  // Handle wildcard permissions
  return checkWildcardPermissions(userPermissions, requiredPermission);
}

// React hook version for checking module access
export function useCanAccessModule(moduleKey) {
  const { userPermissions, isAuthenticated } = useStaffAuthStore();
  
  if (!isAuthenticated) return false;
  
  // Check if userPermissions is an array
  if (!Array.isArray(userPermissions)) {
    return false;
  }
  
  // Super Admin with "*" can access everything
  if (userPermissions.includes('*')) return true;
  
  // Check direct permissions
  if (userPermissions.some(permission => permission.startsWith(`${moduleKey}.`))) {
    return true;
  }
  
  // Check module wildcard permissions
  if (userPermissions.includes(`${moduleKey}.*`)) {
    return true;
  }
  
  return false;
}