import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiShield, FiUserPlus, FiEdit } from 'react-icons/fi';

// Import existing components
import AllUsers from './users/AllUsers';
import AllRoles from './roles/AllRoles';
import RoleCreation from './roles/components/RoleCreation';
import UpdateRole from './roles/components/UpdateRole';

const USERS & PERMISSIONS = () => {
  const [activeView, setActiveView] = useState('overview');
  const [selectedRole, setSelectedRole] = useState(null);

  const handleCreateRole = () => {
    setActiveView('create-role');
  };

  const handleEditRole = (role) => {
    setSelectedRole(role);
    setActiveView('edit-role');
  };

  const handleBackToOverview = () => {
    setActiveView('overview');
    setSelectedRole(null);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'users':
        return <AllUsers />;
      case 'roles':
        return <AllRoles onCreateRole={handleCreateRole} onEditRole={handleEditRole} />;
      case 'create-role':
        return <RoleCreation onBack={handleBackToOverview} />;
      case 'edit-role':
        return <UpdateRole role={selectedRole} onBack={handleBackToOverview} />;
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Users Management Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white p-6 rounded-lg shadow-md border border-gray-200 cursor-pointer"
              onClick={() => setActiveView('users')}
            >
              <div className="flex items-center mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FiUsers className="text-blue-600" size={24} />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-gray-900">Users</h3>
              </div>
              <p className="text-gray-600 mb-4">Manage Users and assign roles to them</p>
              <div className="flex items-center text-blue-600 text-sm font-medium">
                <span>Manage Users</span>
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.div>

            {/* Roles Management Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white p-6 rounded-lg shadow-md border border-gray-200 cursor-pointer"
              onClick={() => setActiveView('roles')}
            >
              <div className="flex items-center mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FiShield className="text-green-600" size={24} />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-gray-900">Roles</h3>
              </div>
              <p className="text-gray-600 mb-4">Create, edit, and manage user roles</p>
              <div className="flex items-center text-green-600 text-sm font-medium">
                <span>Manage Roles</span>
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.div>
          </div>
        );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">USERS & PERMISSIONS Management</h1>
            <p className="text-gray-600 mt-2">Role-Based Access Control System</p>
          </div>
          
          {activeView !== 'overview' && (
            <button
              onClick={handleBackToOverview}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Overview</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};

export default USERS & PERMISSIONS;