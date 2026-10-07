import { hasPermission } from '@/services/hasPermissionService';

/**
 * Wrapper component to add permission checks to website settings components
 * Shows access denied message if user lacks required permission
 */
export const withPermissionCheck = (Component, permissionAction = 'update') => {
  return function PermissionWrappedComponent(props) {
    const permission = `website_settings.${permissionAction}`;
    const hasAccess = hasPermission(permission);

    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 text-sm mb-4">
              You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{permission}</span>
            </p>
            <p className="text-gray-500 text-xs">
              Please contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

export default withPermissionCheck;
