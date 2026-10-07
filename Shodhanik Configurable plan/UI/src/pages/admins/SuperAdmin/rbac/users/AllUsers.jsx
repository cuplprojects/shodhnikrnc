import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from 'antd';
import { User, Mail, Phone, Shield, Search, Plus } from 'lucide-react';
import { userService } from '@/services/userService';
import notification from '@/services/NotificationService';
import Button from '@/components/ui/Button';
import { hasPermission } from '@/services/hasPermissionService';

const AllUsers = () => {

  //permission
  const canRead = hasPermission('user_management.read');
  const canCreate = hasPermission('user_management.create');
  const canUpdate = hasPermission('user_management.update');
  const canDelete = hasPermission('user_management.delete');
  if(!canRead){
    return;
  }
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const users = await userService.getAllUsers();
      setUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      notification().error(error.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await userService.deleteUser(userId);
      notification().success('User deleted successfully');
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user:', error);
      notification().error(error.message || 'Error deleting user');
    }
  };

  const handleAddUser = () => {
    navigate('/dashboard/rbac/users/add');
  };

  const handleView = (record) => {
    navigate(`/dashboard/rbac/users/edit/${record.id}`);
  };

  const handleEdit = (record) => {
    navigate(`/dashboard/rbac/users/edit/${record.id}`);
  };



  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
            {text?.charAt(0)?.toUpperCase() || <User size={16} />}
          </div>
          <div>
            <div className="font-medium text-sm text-gray-900">
              {text}
            </div>
          </div>
        </div>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
      width: 200,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => (
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-gray-400" />
          <a 
            href={`mailto:${email}`}
            className="text-gray-900 no-underline hover:text-gray-700"
            style={{ textDecoration: 'none' }}
          >
            {email}
          </a>
        </div>
      ),
      sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
      width: 250,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone) => (
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-gray-400" />
          <span className="text-gray-900">
            {phone || <span className="text-gray-400 italic">Not provided</span>}
          </span>
        </div>
      ),
      sorter: (a, b) => (a.phone || '').localeCompare(b.phone || ''),
      width: 150,
    },
    {
      title: 'Role',
      dataIndex: 'roleName',
      key: 'roleName',
      render: (roleName) => (
        <span className="text-gray-900">
          {roleName || <span className="text-gray-400 italic">No Role</span>}
        </span>
      ),
      sorter: (a, b) => (a.roleName || '').localeCompare(b.roleName || ''),
      filters: [
        { text: 'Super Admin', value: 'Super Admin' },
        { text: 'Admin', value: 'Admin' },
        { text: 'Manager', value: 'Manager' },
        { text: 'User', value: 'User' },
      ],
      onFilter: (value, record) => record.roleName === value,
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex gap-1">
          {canRead && 
          <Button
            module="user_management"
            action="read"
            onClick={() => handleView(record)}
            size="sm"
            tooltip="View User"
          />}
          {canUpdate && 
          <Button
            module="user_management"
            action="update"
            onClick={() => handleEdit(record)}
            size="sm"
            tooltip="Edit User"
          />}
          {canDelete && 
          <Button
            module="user_management"
            action="delete"
            onClick={() => handleDeleteUser(record.id)}
            size="sm"
            tooltip="Delete User"
            requireConfirm
            confirmMessage={`Are you sure you want to delete "${record.name}"?`}
          />
          }
          {(!canCreate && !canUpdate && !canDelete) && "Permission Denied"}
        </div>
      ),
      width: 150,
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Users Management</h1>
          <p className="text-gray-600 mt-2">Create and manage user roles with permissions</p>
        </div>
        {canCreate && 
        <Button 
          module="user_management"
          action="create"
          label="Add User"
          icon={<Plus size={16} />}
          onClick={handleAddUser}
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
            placeholder="Search users by name, email, or role..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <Table
        columns={columns}
        dataSource={users.filter(user => 
          user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
          user.roleName?.toLowerCase().includes(searchText.toLowerCase())
        )}
        loading={loading}
        pagination={{
          total: users.filter(user => 
            user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
            user.roleName?.toLowerCase().includes(searchText.toLowerCase())
          ).length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
        }}
        scroll={{ x: 800 }}
        size="small"
      />

    </div>
  );
};

export default AllUsers;