import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Pagination } from 'antd';
import { Eye } from 'lucide-react';
import notification from '@/services/NotificationService';
import { getDocumentVerificationSubjects, getDocumentVerificationScholars } from '@/services/phdAdmissionService';
import { hasPermission } from '@/services/hasPermissionService';

const DocumentVerification = () => {

  //permissions
  const canRead = hasPermission('.read')
  const canCreate = hasPermission('.create')
  const canUpdate = hasPermission('.update')
  const canDelete = hasPermission('.delete')
  const canApprove = hasPermission('.approve')
  const canReject = hasPermission('.reject')

  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  
  // Department filter state
  const [selectedDepartment, setSelectedDepartment] = useState(0);
  const [departments, setDepartments] = useState([]);

  // Table columns
  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: 'Scholar ID',
      dataIndex: 'scholarId',
      key: 'scholarId',
      sorter: true,
      width: 120,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      width: 200,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 180,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleVerifyDocuments(record)}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            <Eye size={14} className="inline mr-1" /> Verify
          </button>
        </div>
      ),
    },
  ];

  // Fetch document verification departments
  const fetchDepartments = async () => {
    try {
      const depts = await getDocumentVerificationSubjects();
      console.log('Document verification subjects:', depts);
      const mappedDepts = (depts || []).map(dept => ({
        departmentId: dept.departmentID,
        departmentName: dept.subjectName
      }));
      setDepartments(mappedDepts);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  // Handle department filter change
  const handleDepartmentChange = async (deptId) => {
    setSelectedDepartment(deptId);
    
    try {
      const result = await getDocumentVerificationScholars(
        deptId || 0,
        1,
        pagination.pageSize
      );
      console.log('Document verification scholars:', result);
      
      const mappedScholars = (result.data || []).map(item => ({
        key: item.sid,
        sid: item.sid,
        scholarId: item.applicationNo,
        name: item.name,
        email: item.email,
        phone: item.phoneNumber,
        department: item.subjectName
      }));
      
      setData(mappedScholars);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: 1,
      }));
    } catch (error) {
      console.error('Error fetching scholars:', error);
      const notify = notification();
      notify.error('Failed to load scholars');
    }
  };

  // Handle verify documents
  const handleVerifyDocuments = (record) => {
    navigate(`/admission-cell/document-verification/${record.sid}`);
  };

  // Handle table pagination changes
  const handleTableChange = async (paginationConfig) => {
    setPagination(paginationConfig);
    
    try {
      const result = await getDocumentVerificationScholars(
        selectedDepartment || 0,
        paginationConfig.current,
        paginationConfig.pageSize
      );
      
      const mappedScholars = (result.data || []).map(item => ({
        key: item.sid,
        sid: item.sid,
        scholarId: item.applicationNo,
        name: item.name,
        email: item.email,
        phone: item.phoneNumber,
        department: item.subjectName
      }));
      
      setData(mappedScholars);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: result.page || 1,
      }));
    } catch (error) {
      console.error('Error handling table change:', error);
      const notify = notification();
      notify.error('Failed to load data');
    }
  };

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      await fetchDepartments();
      await handleDepartmentChange(0);
    };
    initializeData();
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Filter Panel */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        
        {/* Header with Stats */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Document Verification</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Total: <span className="font-semibold text-gray-900">{pagination.total}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Department Filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Department Filter</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDepartmentChange(0)}
              className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all ${
                selectedDepartment === 0
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              All Departments
            </button>
            {departments.map((dept) => (
              <button
                key={dept.departmentId}
                onClick={() => handleDepartmentChange(dept.departmentId)}
                className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all ${
                  selectedDepartment === dept.departmentId
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {dept.departmentName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {((pagination.current - 1) * pagination.pageSize) + 1} to {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total} scholars
          </div>
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showTotal={false}
            pageSizeOptions={['10', '20', '50', '100']}
            size="small"
            onChange={(page, pageSize) => {
              handleTableChange(
                { current: page, pageSize }
              );
            }}
            onShowSizeChange={(_, size) => {
              handleTableChange(
                { current: 1, pageSize: size }
              );
            }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={data}
          pagination={false}
          onChange={(paginationConfig) => {
            handleTableChange(paginationConfig);
          }}
          scroll={{ x: 1000 }}
          bordered
          size="small"
        />

        {/* Bottom Pagination */}
        <div className="flex justify-end p-4 border-t border-gray-200">
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} scholars`}
            pageSizeOptions={['10', '20', '50', '100']}
            size="small"
            onChange={(page, pageSize) => {
              handleTableChange(
                { current: page, pageSize }
              );
            }}
            onShowSizeChange={(_, size) => {
              handleTableChange(
                { current: 1, pageSize: size }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentVerification;
