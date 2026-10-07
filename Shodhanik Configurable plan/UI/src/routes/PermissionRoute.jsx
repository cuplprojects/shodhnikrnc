// components/PermissionRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { hasPermission } from '@/services/hasPermissionService';

const PermissionRoute = ({ required, children, fallbackPath = "/dashboard" }) => {
  // If no permission is required, allow access
  if (!required) {
    return children;
  }

  // Check if user has the required permission
  const hasAccess = hasPermission(required);
  
  if (!hasAccess) {
    console.warn(`Access denied to route. Required permission: ${required}`);
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

export default PermissionRoute;
