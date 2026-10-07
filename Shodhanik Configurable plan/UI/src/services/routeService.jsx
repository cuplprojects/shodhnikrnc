/**
 * 🔧 Route Service - Helper functions (DO NOT EDIT)
 * 
 * This service automatically generates navigation, routes, and permissions
 * from the simple routes.jsx file.
 */

import { Route } from 'react-router-dom';
import { routes, crudPermissions } from '@/config/routes.jsx';
import { hasPermission } from '@/services/hasPermissionService';
import PermissionRoute from '@/routes/PermissionRoute';
import RouteGuard from '@/routes/RouteGuard';

// ============================================================================
// 🎯 CORE FUNCTIONS
// ============================================================================

/**
 * Get routes for a specific user type
 */
export const getRoutes = (userType) => {
  return routes[userType] || [];
};

/**
 * Generate navigation items for a user type
 */
export const generateNavigation = (userType) => {
  const userRoutes = getRoutes(userType);
  const navItems = [];
  const sections = {};

  userRoutes.forEach(route => {
    // Skip routes without navigation
    if (!route.nav || !route.name) return;

    // Check permission
    if (route.permission && !hasPermission(route.permission)) return;

    if (route.nav === 'direct') {
      // Direct navigation item
      navItems.push({
        id: route.path.split('/').pop() || 'dashboard',
        name: route.name,
        icon: route.icon,
        type: 'direct',
        path: route.path,
        switch: true,
        isLocked: route.isLocked // Pass through for dynamic checking in Sidebar
      });
    } else if (route.nav === 'item' && route.section) {
      // Group under section
      if (!sections[route.section]) {
        sections[route.section] = {
          id: route.section.toLowerCase().replace(/\s+/g, '-'),
          name: route.section,
          type: 'heading',
          items: []
        };
      }
      sections[route.section].items.push({
        id: route.path.split('/').pop(),
        name: route.name,
        icon: route.icon,
        type: 'item',
        path: route.path,
        switch: true,
        isLocked: route.isLocked // Pass through for dynamic checking in Sidebar
      });
    }
  });

  // Add sections to navItems
  Object.values(sections).forEach(section => {
    if (section.items.length > 0) {
      navItems.push(section);
    }
  });

  return navItems;
};

/**
 * Generate route elements for React Router
 */
export const generateRouteElements = (userType) => {
  const userRoutes = getRoutes(userType);
  const routeElements = [];

  userRoutes.forEach((route, index) => {
    if (!route.component) return;

    const Component = route.component;
    
    // Build the element with appropriate guards
    let element = <Component />;
    
    // Add permission guard if needed
    if (route.permission) {
      element = (
        <PermissionRoute required={route.permission}>
          {element}
        </PermissionRoute>
      );
    }
    
    // Add route guard for scholars (handles locked routes)
    if (userType === 'scholar') {
      element = (
        <RouteGuard userType={userType}>
          {element}
        </RouteGuard>
      );
    }

    routeElements.push(
      <Route 
        key={`${userType}-${index}`}
        path={route.path}
        element={element}
      />
    );
  });

  return routeElements;
};

/**
 * Generate modules.json structure
 */
export const generateModulesConfig = () => {
  const staffRoutes = getRoutes('staff');
  const categoryGroups = {};
  
  staffRoutes.forEach(route => {
    if (!route.permission || !route.section) return;
    
    const category = route.section;
    if (!categoryGroups[category]) {
      categoryGroups[category] = {
        name: category,
        description: `${category} functionality`,
        key: category.toLowerCase().replace(/\s+/g, '_').replace(/&/g, 'and'),
        modules: []
      };
    }
    
    const [moduleKey] = route.permission.split('.');
    
    let module = categoryGroups[category].modules.find(m => m.key === moduleKey);
    if (!module) {
      // Get CRUD actions from crudPermissions or default to ['read']
      const actions = crudPermissions[moduleKey] || ['read'];
      
      module = {
        name: route.name || moduleKey,
        key: moduleKey,
        actions: actions
      };
      categoryGroups[category].modules.push(module);
    }
  });
  
  return Object.values(categoryGroups);
};

// ============================================================================
// 🧭 NAVIGATION FUNCTIONS - For existing NavConfig files
// ============================================================================

export const generateStaffNavConfig = () => generateNavigation('staff');
export const generateScholarNavConfig = () => generateNavigation('scholar');
export const generateSupervisorNavConfig = () => generateNavigation('supervisor');

export default {
  getRoutes,
  generateNavigation,
  generateRouteElements,
  generateModulesConfig,
  generateStaffNavConfig,
  generateScholarNavConfig,
  generateSupervisorNavConfig
};