/**
 * 🚀 Auto Routes - Automatically generates routes from routes.jsx
 * 
 * Use this in App.jsx to replace manual route definitions
 */

import { generateRouteElements } from '@/services/routeService';

/**
 * Auto-generate routes for a user type
 * Returns an array of route objects that can be spread into Routes
 */
const AutoRoutes = ({ userType }) => {
  const routes = generateRouteElements(userType);
  return routes;
};

export default AutoRoutes;