/**
 * Route Guard Component
 * Prevents access to locked routes and redirects to appropriate page
 */
import { Navigate, useLocation } from 'react-router-dom';
import { isRouteLockedForScholar } from '@/utils/routeLockUtils';
import { routes } from '@/config/routes';

const RouteGuard = ({ children, userType }) => {
  const location = useLocation();

  // Only apply route guard for scholars
  if (userType !== 'scholar') {
    return children;
  }

  // Find the current route configuration
  const currentPath = location.pathname.replace('/scholar-dashboard/', '').replace('/scholar-dashboard', '');
  const currentRoute = routes.scholar.find(route => {
    const routePath = route.path || '';
    return routePath === currentPath;
  });

  // Handle custom guards
  if (currentRoute?.customGuard === 'blockIfUploaded') {
    // For thesis uploads route, check if all documents are uploaded
    // This is handled asynchronously in the component itself
    // The component will redirect if needed
    return children;
  }

  // If route is found and locked, redirect to dashboard
  if (currentRoute && isRouteLockedForScholar(currentRoute)) {
    return <Navigate to="/scholar-dashboard" replace />;
  }

  return children;
};

export default RouteGuard;