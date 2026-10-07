/**
 * Dashboard Permissions Hook
 * Manages user permissions and dashboard access control
 */
import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext'; // Adjust import path

/**
 * Hook to manage dashboard permissions and access control
 */
export const useDashboardPermissions = () => {
  const { user } = useContext(AuthContext) || {};
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract permissions from user context
    const userPermissions = user?.permissions || [];
    setPermissions(userPermissions);
    setLoading(false);
  }, [user]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission) => {
    return permissions.includes(permission) || 
           permissions.some(p => p.startsWith(permission.split('.')[0]));
  };

  /**
   * Check if user has any of the provided permissions
   */
  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => hasPermission(permission));
  };

  /**
   * Get dashboard modules user has access to
   */
  const getAccessibleModules = () => {
    const modules = [];

    // PhD Applications / Admission Cell
    if (hasAnyPermission(['phd_applications.read', 'admission_cell_dashboard.read'])) {
      modules.push({
        key: 'admission_cell',
        name: 'Admission Cell',
        permissions: permissions.filter(p => 
          p.includes('phd_applications') || p.includes('admission_cell')
        )
      });
    }

    // Office Management
    if (hasAnyPermission(['scholar_synopsis.read', 'pending_course_work.read', 'supervisor_consent.read'])) {
      modules.push({
        key: 'office',
        name: 'Office',
        permissions: permissions.filter(p => 
          p.includes('scholar_synopsis') || 
          p.includes('pending_course_work') || 
          p.includes('supervisor_consent') ||
          p.includes('upcoming_rdc') ||
          p.includes('rdc_proceedings_office')
        )
      });
    }

    // Director of Research
    if (hasAnyPermission(['director_profile.read', 'departments.read', 'provisional_supervisors.read'])) {
      modules.push({
        key: 'director',
        name: 'Director of Research',
        permissions: permissions.filter(p => 
          p.includes('director') || 
          p.includes('departments') || 
          p.includes('provisional_supervisors') ||
          p.includes('existingsup') ||
          p.includes('prephd') ||
          p.includes('phd') ||
          p.includes('rdc-committee')
        )
      });
    }

    // VC Office
    if (hasAnyPermission(['rdc_proceedings.read', 'vc_examiners.read', 'vc_thesis.read'])) {
      modules.push({
        key: 'vc_office',
        name: 'VC Office',
        permissions: permissions.filter(p => 
          p.includes('rdc_proceedings') || 
          p.includes('vc_examiners') || 
          p.includes('vc_thesis')
        )
      });
    }

    // Supervisor Recognition Cell
    if (hasAnyPermission(['supervisor_applications.read'])) {
      modules.push({
        key: 'supervisor_cell',
        name: 'Supervisor Recognition Cell',
        permissions: permissions.filter(p => 
          p.includes('supervisor_applications')
        )
      });
    }

    // RBAC / User Management
    if (hasAnyPermission(['user_management.read', 'role_management.read'])) {
      modules.push({
        key: 'rbac',
        name: 'User & Role Management',
        permissions: permissions.filter(p => 
          p.includes('user_management') || 
          p.includes('role_management')
        )
      });
    }

    return modules;
  };

  /**
   * Get dashboard configuration based on user role and permissions
   */
  const getDashboardConfig = () => {
    const accessibleModules = getAccessibleModules();
    
    return {
      canAccessDashboard: permissions.length > 0,
      modules: accessibleModules,
      defaultModule: accessibleModules.length > 0 ? accessibleModules[0].key : null,
      userRole: user?.role || 'Unknown',
      userName: user?.name || 'User'
    };
  };

  /**
   * Check if user can access specific dashboard features
   */
  const canAccess = {
    admissionCell: () => hasAnyPermission(['phd_applications.read', 'admission_cell_dashboard.read']),
    office: () => hasAnyPermission(['scholar_synopsis.read', 'pending_course_work.read', 'supervisor_consent.read']),
    director: () => hasAnyPermission(['director_profile.read', 'departments.read', 'provisional_supervisors.read']),
    vcOffice: () => hasAnyPermission(['rdc_proceedings.read', 'vc_examiners.read', 'vc_thesis.read']),
    supervisorCell: () => hasAnyPermission(['supervisor_applications.read']),
    rbac: () => hasAnyPermission(['user_management.read', 'role_management.read']),
    
    // Specific features
    regTypeFilter: () => hasAnyPermission(['phd_applications.read']),
    exportData: () => hasAnyPermission(['phd_applications.read', 'scholar_synopsis.read']),
    statusUpdate: () => hasAnyPermission(['phd_applications.update', 'scholar_synopsis.update']),
    viewDetails: () => hasAnyPermission(['phd_applications.read', 'scholar_synopsis.read'])
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    getAccessibleModules,
    getDashboardConfig,
    canAccess,
    user: user || {}
  };
};

export default useDashboardPermissions;