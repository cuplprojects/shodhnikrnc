/**
 * Default Dashboard Component
 * Permission-based dashboard that shows content based on user permissions
 * Replaces role-based dashboard routing
 */
import React from 'react';
import { hasPermission } from '@/services/hasPermissionService';
import useStaffAuthStore from '@/store/staffAuthStore';

const DefaultDashboard = () => {
  const { user, userPermissions } = useStaffAuthStore();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.name || user?.username}
        </h1>
        <p className="text-gray-600">
          Dashboard - Access based on your permissions
        </p>
      </div>

      {/* Permission-based content sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Supervisor Applications */}
        {hasPermission('supervisor_applications.view') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Supervisor Applications</h3>
            <p className="text-gray-600 mb-4">Manage supervisor registration applications</p>
            <div className="space-y-2">
              {hasPermission('supervisor_applications.approve') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded">
                  Review Applications
                </button>
              )}
              {hasPermission('supervisor_applications.download') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-green-50 hover:bg-green-100 rounded">
                  Download Reports
                </button>
              )}
            </div>
          </div>
        )}

        {/* Payment Status */}
        {hasPermission('payment_status.view') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Payment Status</h3>
            <p className="text-gray-600 mb-4">View and search payment records</p>
            <div className="space-y-2">
              {hasPermission('payment_status.search') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-yellow-50 hover:bg-yellow-100 rounded">
                  Search Payments
                </button>
              )}
            </div>
          </div>
        )}

        {/* RMS Settings */}
        {hasPermission('rms_settings.view') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Shodhanik Settings</h3>
            <p className="text-gray-600 mb-4">System configuration and management</p>
            <div className="space-y-2">
              {hasPermission('content_management.view') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 rounded">
                  Content Management
                </button>
              )}
              {hasPermission('application_control.view') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-indigo-50 hover:bg-indigo-100 rounded">
                  Application Control
                </button>
              )}
              {hasPermission('communication_templates.view') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-pink-50 hover:bg-pink-100 rounded">
                  SMS/Email Templates
                </button>
              )}
            </div>
          </div>
        )}

        {/* Document Verification */}
        {hasPermission('document_verification.view') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Document Verification</h3>
            <p className="text-gray-600 mb-4">Review and verify submitted documents</p>
            <div className="space-y-2">
              {hasPermission('document_verification.approve') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-green-50 hover:bg-green-100 rounded">
                  Approve Documents
                </button>
              )}
              {hasPermission('document_verification.reject') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-red-50 hover:bg-red-100 rounded">
                  Reject Documents
                </button>
              )}
            </div>
          </div>
        )}

        {/* Qualified for Admission */}
        {hasPermission('qualified_for_admission.view') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Qualified Candidates</h3>
            <p className="text-gray-600 mb-4">View candidates qualified for admission</p>
            <button className="block w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded">
              View Qualified List
            </button>
          </div>
        )}

        {/* Website Management */}
        {hasPermission('website_management.view') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Website Management</h3>
            <p className="text-gray-600 mb-4">Manage website content and settings</p>
            <div className="space-y-2">
              {hasPermission('homepage_slider.view') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-cyan-50 hover:bg-cyan-100 rounded">
                  Homepage Slider
                </button>
              )}
              {hasPermission('website_news.view') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-orange-50 hover:bg-orange-100 rounded">
                  News Management
                </button>
              )}
              {hasPermission('phone_directory.view') && (
                <button className="block w-full text-left px-3 py-2 text-sm bg-teal-50 hover:bg-teal-100 rounded">
                  Phone Directory
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Debug info for development */}
      {import.meta.env.DEV && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-semibold mb-2">Debug Info (Development Only)</h4>
          <p className="text-sm text-gray-600 mb-2">
            User: {user?.username} ({user?.email})
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Permissions: {userPermissions?.length || 0} total
          </p>
          {userPermissions?.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-600">View Permissions</summary>
              <ul className="mt-2 space-y-1">
                {userPermissions.map((permission, index) => (
                  <li key={index} className="text-gray-700">• {permission}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default DefaultDashboard;