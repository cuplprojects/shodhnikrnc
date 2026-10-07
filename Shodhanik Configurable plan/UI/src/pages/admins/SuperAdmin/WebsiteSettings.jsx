import { hasPermission } from '@/services/hasPermissionService';
import SettingsPage from '@/websiteSettings/pages/SettingsPage';

const WebsiteSettings = () => {
  // Check permission
  const canRead = hasPermission('website_settings.read');
  
  if (!canRead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access website settings.</p>
        </div>
      </div>
    );
  }

  return <SettingsPage />;
};

export default WebsiteSettings;
