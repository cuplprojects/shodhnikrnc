/**
 * Authentication utilities for getting current user data
 */
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import useStaffAuthStore from '@/store/staffAuthStore';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';

/**
 * Get current authenticated user from any auth store
 * @returns {Object|null} Current user data or null if not authenticated
 */
export const getCurrentUser = () => {
  // Try selected scholar auth first
  const selectedScholarAuth = useSelectedScholarAuthStore.getState();
  if (selectedScholarAuth.isAuthenticated && selectedScholarAuth.user) {
    return selectedScholarAuth.user;
  }

  // Try staff auth
  const staffAuth = useStaffAuthStore.getState();
  if (staffAuth.isAuthenticated && staffAuth.user) {
    return staffAuth.user;
  }

  // Try supervisor auth
  const supervisorAuth = useSupervisorAuthStore.getState();
  if (supervisorAuth.isAuthenticated && supervisorAuth.user) {
    return supervisorAuth.user;
  }

  return null;
};

/**
 * Get current user's ID (handles different ID field names)
 * @returns {number|null} User ID or null if not found
 */
export const getCurrentUserId = () => {
  const user = getCurrentUser();
  if (!user) return null;

  // Try different ID field names based on user type
  return user.sId || user.id || user.userId || user.supId || null;
};

/**
 * Get current user type
 * @returns {string|null} User type or null if not found
 */
export const getCurrentUserType = () => {
  const user = getCurrentUser();
  return user?.userType || null;
};

/**
 * Check if current user is authenticated
 * @returns {boolean} True if any user is authenticated
 */
export const isAuthenticated = () => {
  const selectedScholarAuth = useSelectedScholarAuthStore.getState();
  const staffAuth = useStaffAuthStore.getState();
  const supervisorAuth = useSupervisorAuthStore.getState();

  return selectedScholarAuth.isAuthenticated || 
         staffAuth.isAuthenticated || 
         supervisorAuth.isAuthenticated;
};