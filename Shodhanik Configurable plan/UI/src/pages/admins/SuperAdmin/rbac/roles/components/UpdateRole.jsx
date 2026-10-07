import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, AlertCircle, Edit, X } from "lucide-react";
import { roleService } from "@/services/roleService";
import notification from "@/services/NotificationService";
import Button from "@/components/ui/Button";
import PermissionsTree from "../../components/PermissionTree";

const UpdateRole = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [formData, setFormData] = useState({
    roleName: '',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState({});

  useEffect(() => {
    const fetchRole = async () => {
      if (id) {
        try {
          const roleData = await roleService.getRoleById(id);
          const initialData = {
            roleName: roleData.name || '',
            description: roleData.description || ''
          };
          setFormData(initialData);
          setOriginalData(initialData);
          
          const permissions = roleData.permissions || [];
          setSelectedPermissions(permissions);
        } catch (error) {
          console.error('Error fetching role:', error);
          notification().error('Failed to load role data');
          navigate('/dashboard/rbac/roles');
        } finally {
          setPageLoading(false);
        }
      }
    };

    fetchRole();
  }, [id, navigate]);

  // Track changes
  useEffect(() => {
    const dataChanged = 
      formData.roleName !== originalData.roleName ||
      formData.description !== originalData.description ||
      JSON.stringify(selectedPermissions) !== JSON.stringify(originalData.permissions || []);
    setHasChanges(dataChanged);
  }, [formData, selectedPermissions, originalData]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.roleName.trim()) {
      newErrors.roleName = 'Please enter role name';
    } else if (formData.roleName.length < 2) {
      newErrors.roleName = 'Role name must be at least 2 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }

    if (selectedPermissions.length === 0) {
      newErrors.permissions = 'Please select at least one permission';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!id) {
      notification().error('Role ID is missing');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const roleData = {
        roleName: formData.roleName,
        description: formData.description,
        permissions: selectedPermissions
      };
      
      await roleService.updateRole(id, roleData);
      
      notification().success('Role updated successfully!');
      
      // Navigate back to roles list
      navigate('/dashboard/rbac/roles');
    } catch (error) {
      console.error('Error updating role:', error);
      notification().error(error.message || 'Failed to update role. Please try again.');
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

  const handlePermissionsChange = (newPermissions) => {
    setSelectedPermissions(newPermissions);
    if (errors.permissions) {
      setErrors(prev => ({ ...prev, permissions: '' }));
    }
  };

  if (pageLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading role details...</p>
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
          onClick={() => navigate('/dashboard/rbac/roles')}
          variant="ghost"
          size="sm"
          tooltip="Go Back"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Update Role</h1>
          <p className="text-gray-600 mt-2">Modify role details and permissions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Details */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Role Details</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Role Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.roleName}
                    onChange={(e) => handleInputChange('roleName', e.target.value)}
                    placeholder="Enter role name"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.roleName ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                </div>
                {errors.roleName && (
                  <div className="flex items-center space-x-1 mt-2 text-red-600">
                    <AlertCircle size={14} />
                    <p className="text-sm">{errors.roleName}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter role description (optional)"
                  rows={3}
                  maxLength={500}
                  className={`block w-full px-3 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                    errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {errors.description && (
                      <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle size={14} />
                        <p className="text-sm">{errors.description}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formData.description.length}/500
                  </span>
                </div>
              </div>

              {/* Changes Indicator */}
              {hasChanges && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-yellow-800">
                    <AlertCircle size={16} />
                    <p className="text-sm font-medium">You have unsaved changes</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Permissions Selection */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Permissions ({selectedPermissions.length} selected)
              </h3>
            </div>
            <div className="p-6 max-h-96 overflow-auto">
              <PermissionsTree
                selectedPermissions={selectedPermissions}
                onPermissionsChange={handlePermissionsChange}
                disabled={loading}
              />
              {errors.permissions && (
                <div className="flex items-center space-x-1 mt-4 text-red-600">
                  <AlertCircle size={14} />
                  <p className="text-sm">{errors.permissions}</p>
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
            onClick={() => navigate('/dashboard/rbac/roles')} 
            variant="outline"
            className="text-gray-700 border-gray-300 hover:bg-gray-50"
            icon={<X size={16} />}
          />
          <Button 
            module="role_management"
            action="update"
            label="Update Role"
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

export default UpdateRole;