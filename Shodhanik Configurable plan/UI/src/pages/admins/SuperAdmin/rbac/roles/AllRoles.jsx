import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from 'antd';
import { Shield, Search, User, Plus } from 'lucide-react';
import { roleService } from '@/services/roleService';
import notification from '@/services/NotificationService';
import Button from '@/components/ui/Button';
import { hasPermission } from '@/services/hasPermissionService';

const AllRoles = () => {

  //permissions
  const canRead = hasPermission('role_management.read')
  const canCreate = hasPermission('role_management.create')
  const canUpdate = hasPermission('role_management.update')
  const canDelete = hasPermission('role_management.delete')
  if (!canRead) {
    return;
  }

  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const roles = await roleService.getAllRoles();
      setRoles(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      notification().error(error.message || 'Error loading roles');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId) => {
    try {
      await roleService.deleteRole(roleId);
      notification().success('Role deleted successfully');
      fetchRoles(); // Refresh the list
    } catch (error) {
      console.error('Error deleting role:', error);
      notification().error(error.message || 'Error deleting role');
    }
  };

  const columns = [
    {
      title: 'Role',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-blue-500" />
          <div>
            <div className="font-medium text-sm">
              {record.description ? (
                <span title={record.description} className="cursor-help">
                  {text}
                </span>
              ) : (
                text
              )}
            </div>
            <div className="text-gray-500 text-xs">ID: {record.id}</div>
          </div>
        </div>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text) => (
        text ? (
          <div
            title={text}
            className="max-w-48 overflow-hidden text-ellipsis whitespace-nowrap cursor-help"
          >
            {text}
          </div>
        ) : (
          <span className="text-gray-400 italic">No description</span>
        )
      ),
      width: 220,
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      key: 'userCount',
      render: (count) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400" />
          <span>{count || 0}</span>
        </div>
      ),
      sorter: (a, b) => (a.userCount || 0) - (b.userCount || 0),
      width: 100,
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions) => (
        <div className="flex flex-wrap gap-1">
          {(permissions || []).slice(0, 2).map((permission, index) => (
            <span key={index} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
              {permission}
            </span>
          ))}
          {(permissions || []).length > 2 && (
            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
              +{permissions.length - 2} more
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex gap-1">
          {canDelete && 
          <Button
            module="role_management"
            action="update"
            size="sm"
            tooltip="Edit Role"
            onClick={() => navigate(`/dashboard/rbac/roles/edit/${record.id}`)}
          />
          }
          {canDelete &&
            <Button
              module="role_management"
              action="delete"
              size="sm"
              tooltip="Delete Role"
              requireConfirm
              confirmMessage={`Are you sure you want to delete the role "${record.name}"?`}
              onClick={() => handleDeleteRole(record.id)}
            />
          }
          {(!canDelete && !canUpdate) && "Permission Denied" }
        </div>
      ),
      width: 120,
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Roles Management</h1>
          <p className="text-gray-600 mt-2">Create and manage user roles with permissions</p>
        </div>
        {canCreate && 
        <Button
          module="role_management"
          action="create"
          label="Create Role"
          icon={<Plus size={16} />}
          onClick={() => navigate('/dashboard/rbac/roles/create')}
          className="bg-green-500 hover:bg-green-600 text-white border-0"
        />
        }
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search roles by name or description..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Roles Table */}
      <Table
        columns={columns}
        dataSource={roles.filter(role =>
          role.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (role.description && role.description.toLowerCase().includes(searchText.toLowerCase()))
        )}
        loading={loading}
        pagination={{
          total: roles.filter(role =>
            role.name.toLowerCase().includes(searchText.toLowerCase()) ||
            (role.description && role.description.toLowerCase().includes(searchText.toLowerCase()))
          ).length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} roles`,
        }}
        scroll={{ x: 800 }}
        size="small"
      />
    </div>
  );
};

export default AllRoles;