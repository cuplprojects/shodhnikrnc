// hooks/useNavigation.js
import { useMemo, useEffect, useState } from 'react';
import useStaffAuthStore from '@/store/staffAuthStore';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import { getNavConfig } from '@/layouts/components/NavConfig';
import { getScholarNavConfig } from '@/layouts/components/ScholarNavConfig';
import { getSupNavConfig } from '@/layouts/components/SupNavConfig';

export const useNavigation = () => {
  // Subscribe to all auth stores for reactivity
  const staffAuth = useStaffAuthStore();
  const selectedScholarAuth = useSelectedScholarAuthStore();
  const supervisorAuth = useSupervisorAuthStore();
  
  // Subscribe to both course work and synopsis status for scholars
  const courseWorkCompleted = selectedScholarAuth.courseWorkCompleted;
  const synopsisApproved = selectedScholarAuth.synopsisApproved;
  
  // Force re-render when permissions change
  const [, forceUpdate] = useState({});

  // Determine current user type
  const userType = useMemo(() => {
    if (staffAuth.isAuthenticated) {
      return 'STAFF';
    } else if (selectedScholarAuth.isAuthenticated) {
      return 'SH';
    } else if (supervisorAuth.isAuthenticated) {
      return 'SUP';
    }
    return 'STAFF'; // Default fallback
  }, [staffAuth.isAuthenticated, selectedScholarAuth.isAuthenticated, supervisorAuth.isAuthenticated]);

  // Force update when permissions change
  useEffect(() => {
    if (staffAuth.isInitialized) {
      forceUpdate({});
    }
  }, [
    staffAuth.userPermissions, 
    staffAuth.user, 
    staffAuth.isInitialized,
    staffAuth.user?.permissions,
    staffAuth.isAuthenticated
  ]);

  // Get navigation items based on user type and permissions
  const menuItems = useMemo(() => {
    if (userType === 'SUP') {
      return getSupNavConfig();
    } else if (userType === 'SH') {
      return getScholarNavConfig();
    } else {
      // For staff, check if we have user and valid permissions
      if (staffAuth.user && staffAuth.isAuthenticated) {
        // Check permissions in store first, then in user object
        const storePermissions = Array.isArray(staffAuth.userPermissions) && staffAuth.userPermissions.length > 0;
        const userPermissions = staffAuth.user.permissions && Array.isArray(staffAuth.user.permissions) && staffAuth.user.permissions.length > 0;
        
        if (storePermissions || userPermissions) {
          return getNavConfig();
        } else {
          // Special case: Super Admin without permissions loaded yet
          if (staffAuth.user.roleName === 'Super Admin' || staffAuth.user.roleId === 1) {
            return getNavConfig();
          }
        }
      }
      return []; // Return empty array if no user/permissions yet
    }
  }, [
    userType, 
    staffAuth.user, 
    staffAuth.userPermissions, 
    selectedScholarAuth.user, 
    supervisorAuth.user,
    staffAuth.isAuthenticated,
    staffAuth.isInitialized,
    staffAuth.user?.permissions,
    staffAuth.user?.roleName,
    staffAuth.user?.roleId,
    courseWorkCompleted, // Add course work status as dependency
    synopsisApproved // Add synopsis approval status as dependency
  ]);



  return {
    userType,
    menuItems,
    isLoading: staffAuth.isLoading || selectedScholarAuth.isLoading || supervisorAuth.isLoading,
    isAuthenticated: staffAuth.isAuthenticated || selectedScholarAuth.isAuthenticated || supervisorAuth.isAuthenticated
  };
};