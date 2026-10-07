import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Shield, AlertCircle, Edit, X } from "lucide-react";
import { userService } from "@/services/userService";
import { roleService } from "@/services/roleService";
import notification from "@/services/NotificationService";
import Button from "@/components/ui/Button";

const UpdateUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    roleId: ''
  });
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState({});

  useEffect(() => {
    const fetchUserAndRoles = async () => {
      if (id) {
        try {
          // Fetch user data and roles in parallel
          const [userData, rolesData] = await Promise.all([
            userService.getUserById(id),
            roleService.getAllRoles()
          ]);

          const initialData = {
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            roleId: userData.roleId || ''
          };

          setFormData(initialData);
          setOriginalData(initialData);
          setRoles(rolesData);
        } catch (error) {
          console.error('Error fetching user:', error);
          notification().error('Failed to load user data');
          navigate('/dashboard/rbac/users');
        } finally {
          setPageLoading(false);
        }
      }
    };

    fetchUserAndRoles();
  }, [id, navigate]);

  // Track changes
  useEffect(() => {
    const dataChanged = 
      formData.name !== originalData.name ||
      formData.email !== originalData.email ||
      formData.phone !== originalData.phone ||
      formData.roleId !== originalData.roleId;
    setHasChanges(dataChanged);
  }, [formData, originalData]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Please enter user name';
    } else if (formData.name.length < 2) {
      newErrors.name = 'User name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name cannot exceed 100 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (formData.email.length > 255) {
      newErrors.email = 'Email cannot exceed 255 characters';
    }

    if (formData.phone && formData.phone.length > 20) {
      newErrors.phone = 'Phone number cannot exceed 20 characters';
    }

    if (!formData.roleId) {
      newErrors.roleId = 'Please select a role';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!id) {
      notification().error('User ID is missing');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await userService.updateUser(id, formData);
      
      notification().success('User updated successfully!');
      
      // Navigate back to users list
      navigate('/dashboard/rbac/users');
    } catch (error) {
      console.error('Error updating user:', error);
      notification().error(error.message || 'Failed to update user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (pageLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button 
          module="general"
          icon={<ArrowLeft size={20} />} 
          onClick={() => navigate('/dashboard/rbac/users')}
          variant="ghost"
          size="sm"
          tooltip="Go Back"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Update User</h1>
          <p className="text-gray-600 mt-2">Modify user details and role assignment</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Details */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">User Details</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter full name"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                </div>
                {errors.name && (
                  <div className="flex items-center space-x-1 mt-2 text-red-600">
                    <AlertCircle size={14} />
                    <p className="text-sm">{errors.name}</p>
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                </div>
                {errors.email && (
                  <div className="flex items-center space-x-1 mt-2 text-red-600">
                    <AlertCircle size={14} />
                    <p className="text-sm">{errors.email}</p>
                  </div>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter phone number (optional)"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                </div>
                {errors.phone && (
                  <div className="flex items-center space-x-1 mt-2 text-red-600">
                    <AlertCircle size={14} />
                    <p className="text-sm">{errors.phone}</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Role Selection */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Role Assignment</h3>
            </div>
            <div className="p-6">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield size={16} className="text-gray-400" />
                  </div>
                  <select
                    value={formData.roleId}
                    onChange={(e) => handleInputChange('roleId', e.target.value)}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.roleId ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    disabled={loading}
                  >
                    <option value="">Select a role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.roleName || role.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.roleId && (
                  <div className="flex items-center space-x-1 mt-2 text-red-600">
                    <AlertCircle size={14} />
                    <p className="text-sm">{errors.roleId}</p>
                  </div>
                )}
              </div>

              {/* Role Description and Permissions */}
              {formData.roleId && (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Shield size={16} className="text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Selected Role</p>
                        <p className="text-sm text-blue-700">
                          {roles.find(role => role.id == formData.roleId)?.name || 
                           roles.find(role => role.id == formData.roleId)?.roleName || 'Unknown Role'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role Permissions */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Role Permissions</h4>
                    {formData.roleId ? (
                      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                        {roles.find(role => role.id == formData.roleId)?.permissions?.map((permission, index) => (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded-md">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">{permission}</span>
                          </div>
                        )) || (
                          <p className="text-sm text-gray-500 italic">No permissions assigned to this role</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Please select a role to view permissions</p>
                    )}
                  </div>
                </div>
              )}

              {/* Changes Indicator */}
              {hasChanges && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-yellow-800">
                    <AlertCircle size={16} />
                    <p className="text-sm font-medium">You have unsaved changes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Buttons at Bottom */}
        <div className="mt-6 flex justify-end space-x-3">
          <Button 
            module="general"
            label="Cancel"
            onClick={() => navigate('/dashboard/rbac/users')} 
            variant="outline"
            className="text-gray-700 border-gray-300 hover:bg-gray-50"
            icon={<X size={16} />}
          />
          <Button 
            module="user_management"
            action="update"
            label="Update User"
            onClick={handleSubmit}
            loading={loading}
            disabled={!hasChanges}
            className="bg-blue-500 hover:bg-blue-600 text-white border-0"
            icon={<Edit size={16} />}
          />
        </div>
      </form>
    </div>
  );
};

export default UpdateUser;