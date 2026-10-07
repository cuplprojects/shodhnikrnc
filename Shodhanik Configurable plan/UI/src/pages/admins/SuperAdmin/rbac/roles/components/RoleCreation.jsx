import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, AlertCircle, X } from "lucide-react";
import { roleService } from "@/services/roleService";
import notification from "@/services/NotificationService";
import Button from "@/components/ui/Button";
import PermissionsTree from "../../components/PermissionTree";

const RoleCreation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [formData, setFormData] = useState({
    roleName: '',
    description: ''
  });
  const [errors, setErrors] = useState({});

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
      
      await roleService.createRole(roleData);
      
      notification().success('Role created successfully!');
      setFormData({ roleName: '', description: '' });
      setSelectedPermissions([]);
      
      // Navigate back to roles list
      navigate('/dashboard/rbac/roles');
    } catch (error) {
      console.error('Error creating role:', error);
      notification().error(error.message || 'Failed to create role. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900 m-0">Create New Role</h1>
          <p className="text-gray-600 mt-2">Define role details and assign permissions</p>
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
                onPermissionsChange={setSelectedPermissions}
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
            action="create"
            label="Create Role"
            onClick={handleSubmit}
            loading={loading}
            className="bg-green-500 hover:bg-green-600 text-white border-0"
          />
        </div>
      </form>
    </div>
  );
};

export default RoleCreation;