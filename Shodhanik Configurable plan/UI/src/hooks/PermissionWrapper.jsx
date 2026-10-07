// components/PermissionWrapper.jsx
import React from "react";
import { hasPermission } from "@/services/permissionService";

const PermissionWrapper = ({ required, children, fallback = null }) => {
  return hasPermission(required) ? <>{children}</> : fallback;
};

export default PermissionWrapper;
