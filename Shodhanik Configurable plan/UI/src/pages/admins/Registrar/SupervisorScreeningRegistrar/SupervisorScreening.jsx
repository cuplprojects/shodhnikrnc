import { useState, useEffect } from 'react';
import { Table, Pagination } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import workflowService from '@/services/workflowService';
import { getStatusCounts } from '@/services/supervisorRecognitionCellService';
import Button from '@/components/ui/Button';
import { hasPermission } from '@/services/hasPermissionService';
const SupervisorScreening = () => {
  //permissions
  const canRead = hasPermission('registrar_supervisor_approval.read')
  const canCreate = hasPermission('registrar_supervisor_approval.create')
  const canUpdate = hasPermission('registrar_supervisor_approval.update')
  const canDelete = hasPermission('registrar_supervisor_approval.delete')
  const canApprove = hasPermission('registrar_supervisor_approval.approve')
  const canReject = hasPermission('registrar_supervisor_approval.reject')
  if (!canRead) {
    return;
  }
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialStatus = () => {
    const statusParam = searchParams.get('status');
    if (!statusParam || statusParam === 'all') return [];
    return statusParam.split(',').filter(Boolean);
  };

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: parseInt(searchParams.get('page')) || 1,
    pageSize: parseInt(searchParams.get('pageSize')) || 10,
    total: 0,
  });

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: getInitialStatus(),
    sortField: searchParams.get('sortField') || 'applicationDate',
    sortOrder: searchParams.get('sortOrder') || 'descend',
  });

  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      current: parseInt(searchParams.get('page')) || 1,
      pageSize: parseInt(searchParams.get('pageSize')) || 10,
    }));

    setFilters({
      search: searchParams.get('search') || '',
      status: getInitialStatus(),
      sortField: searchParams.get('sortField') || 'applicationDate',
      sortOrder: searchParams.get('sortOrder') || 'descend',
    });
  }, [searchParams]);

  const [statusConfig, setStatusConfig] = useState({
    all: { label: 'All Applications', color: 'default', count: 0 },
    'Pending': { label: 'Pending', color: 'orange', count: 0 },
    'Approved': { label: 'Approved', color: 'green', count: 0 },
    'Rejected': { label: 'Rejected', color: 'red', count: 0 },
  });

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: 'Appl. No.',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      sorter: true,
      width: 120,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      width: 200,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      sorter: true,
      width: 180,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      width: 250,
      render: (text) => (
        <div className="truncate" title={text}>
          {text || 'N/A'}
        </div>
      ),
    },
    {
      title: 'Mobile No',
      dataIndex: 'mobileNo',
      key: 'mobileNo',
      width: 130,
      render: (text) => text || 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      filters: [
        { text: 'Pending', value: 'Pending' },
        { text: 'Approved', value: 'Approved' },
        { text: 'Rejected', value: 'Rejected' },
      ],
      filterMultiple: true,
      filteredValue: filters.status.length > 0 ? filters.status : null,
      render: (status) => {
        const getStatusConfig = (status) => {
          switch (status) {
            case 'Approved':
              return { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-300' };
            case 'Rejected':
              return { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-300' };
            case 'Pending':
              return { label: 'Pending', color: 'bg-orange-100 text-orange-700 border-orange-300' };
            default:
              return { label: status || 'Unknown', color: 'bg-gray-100 text-gray-700 border-gray-300' };
          }
        };

        const config = getStatusConfig(status);
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium border ${config.color}`}>
            {config.label}
          </span>
        );
      },
    },
    {
      title: 'Form Stage',
      dataIndex: 'form',
      key: 'form',
      width: 110,
      render: (text) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          text === 'Completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-50 text-slate-700 border border-slate-200'
        }`}>
          {text || 'Stage 3'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, record) => (
        (canApprove || canReject) ?
          <Button
            module="registrar_supervisor_approval"
            action="read"
            label="View"
            variant="link"
            size="sm"
            onClick={() => handleViewDetails(record)}
          /> :
          "Permission Denied"

      ),
    },
  ];

  const fetchStatusCounts = async () => {
    try {
      const counts = await workflowService.getSupervisorWorkflowStats({ workflowId: 5, stepOrder: 3 });
      setStatusConfig(prev => ({
        all: { ...prev.all, count: counts.total || 0 },
        'Pending': { ...prev['Pending'], count: counts.pending || 0 },
        'Approved': { ...prev['Approved'], count: counts.approved || 0 },
        'Rejected': { ...prev['Rejected'], count: counts.rejected || 0 },
      }));
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  const deduplicateSubject = (subject) => {
    if (!subject) return subject;
    
    // Split by ' / ' and remove ALL duplicates while preserving order
    const parts = subject.split(' / ').map(part => part.trim());
    const seen = new Set();
    const uniqueParts = [];
    
    for (const part of parts) {
      if (!seen.has(part)) {
        seen.add(part);
        uniqueParts.push(part);
      }
    }
    
    return uniqueParts.join(' / ');
  };

  const mapApiDataToTable = (apiData) => {
    return apiData.map((item, index) => ({
      key: item.supId || item.key || index,
      supId: item.supId,
      applicationNo: item.applicationNo || item.applicationNumber,
      name: item.name,
      designation: item.designation,
      subject: deduplicateSubject(item.subject),
      mobileNo: item.mobileNo,
      status: item.status,
      form: item.form || 'Level 3',
      deptEst: item.deptEst,
      screening1Status: item.screening1Status,
      screening1Count: item.screening1Count,
      screening2Status: item.screening2Status,
      screening2Count: item.screening2Count,
      screening3Status: item.screening3Status,
      screening3Count: item.screening3Count,
      originalData: item.originalData || item
    }));
  };

  // Fetch data from backend
  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const workflowParams = {
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        search: params.search || filters.search,
        workflowId: 5, // Supervisor Registration
      };

      // Map status filter to workflow parameters
      if (params.status && params.status.length > 0) {
        if (params.status.includes('Pending')) {
          workflowParams.currentStepOrder = 3; // Step 3 is for Registrar (RoleID 3)
          workflowParams.status = "Pending";
        } else if (params.status.includes('Approved')) {
          workflowParams.minStepOrder = 4; // Approved means forwarded to Dean (Step 4) or beyond
        } else if (params.status.includes('Rejected')) {
          workflowParams.status = "Rejected";
        }
      } else {
        // "All Applications": applications that reached Registrar (Step 3) or beyond
        workflowParams.minStepOrder = 3;
      }

      const result = await workflowService.getSupervisorWorkflowList(workflowParams);
      
      const mappedData = result.data.map(item => ({
        ...item,
        key: item.supId,
        applicationNo: item.applicationNumber,
        subject: deduplicateSubject(item.subject),
        form: item.form || (item.workflowStatus === 'Approved' ? 'Completed' : `Stage ${item.currentStepOrder || 3}`),
        // Map workflow state back to legacy UI status labels
        status: (item.currentStepOrder > 3 || item.workflowStatus === 'Approved') ? 'Approved' : 
                (item.workflowStatus === 'Rejected' ? 'Rejected' : 'Pending')
      }));

      setData(mappedData);
      setPagination({
        ...pagination,
        total: result.total || 0,
        current: result.page || 1,
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination, tableFilters, sorter) => {
    const statusFilter = tableFilters?.status || [];

    const params = {
      page: newPagination.current,
      pageSize: newPagination.pageSize,
      search: filters.search,
      status: statusFilter,
      sortField: sorter.field,
      sortOrder: sorter.order,
    };

    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));

    setFilters(prev => ({ ...prev, status: statusFilter }));

    updateURLParams(params);
    fetchData(params);
  };

  const handleSearch = (value) => {
    const newFilters = { ...filters, search: value };
    setFilters(newFilters);
    updateURLParams({ ...newFilters, page: 1, pageSize: pagination.pageSize });
    fetchData({ ...newFilters, page: 1, pageSize: pagination.pageSize });
  };

  const handleStatusChange = (status) => {
    const statusArray = status === 'all' ? [] : [status];
    const newFilters = { ...filters, status: statusArray };
    setFilters(newFilters);
    updateURLParams({ ...newFilters, page: 1, pageSize: pagination.pageSize });
    fetchData({ ...newFilters, page: 1, pageSize: pagination.pageSize });
  };

  const updateURLParams = (params) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'status') {
        if (Array.isArray(value) && value.length > 0) {
          newParams.set(key, value.join(','));
        } else if (Array.isArray(value) && value.length === 0) {
          newParams.set(key, 'all');
        }
      } else if (value) {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  const handleViewDetails = (record) => {
    navigate(`/registrar-supervisor-approval/${record.supId}`, {
      state: {
        status: filters.status.length > 0 ? filters.status.join(',') : 'all',
        returnPath: '/registrar-supervisor-approval'
      }
    });
  };

  useEffect(() => {
    fetchStatusCounts();
    fetchData({
      page: pagination.current,
      pageSize: pagination.pageSize,
      ...filters,
    });
  }, []);

  // Refresh data when user navigates back to this page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatusCounts();
        fetchData({
          page: pagination.current,
          pageSize: pagination.pageSize,
          ...filters,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pagination.current, pagination.pageSize, filters]);

  // Refresh data when component receives focus (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      fetchStatusCounts();
      fetchData({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [pagination.current, pagination.pageSize, filters]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Supervisor Screening</h1>
        <p className="text-gray-600">Review and approve supervisors forwarded by Deputy Registrar</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusConfig).map(([key, config]) => {
            const isActive = key === 'all' ? filters.status.length === 0 : filters.status.includes(key);
            const colorMap = {
              orange: 'bg-orange-100 text-orange-700 border-orange-300',
              green: 'bg-green-100 text-green-700 border-green-300',
              red: 'bg-red-100 text-red-700 border-red-300',
              slate: 'bg-slate-100 text-slate-700 border-slate-300',
              default: 'bg-gray-100 text-gray-700 border-gray-300',
            };
            return (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors inline-flex items-center gap-2 flex-shrink-0 ${isActive
                  ? 'bg-slate-600 text-white shadow-md'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <span className="whitespace-nowrap">{config.label}</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border w-[2.5rem] text-center ${isActive ? 'bg-white/20 border-white/30' : colorMap[config.color] || colorMap.default
                  }`}>
                  {config.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by ID, name, designation..."
              className="w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e.target.value);
                }
              }}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-600 text-white rounded text-sm hover:bg-slate-700"
              onClick={(e) => {
                const input = e.target.closest('div').querySelector('input');
                handleSearch(input.value);
              }}
            >
              Search
            </button>
          </div>
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showTotal={(total) => `Total ${total} applications`}
            pageSizeOptions={['10', '20', '50', '100']}
            size="small"
            onChange={(page, pageSize) => {
              handleTableChange(
                { current: page, pageSize },
                { status: filters.status },
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
            onShowSizeChange={(_, size) => {
              handleTableChange(
                { current: 1, pageSize: size },
                { status: filters.status },
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={data}
          pagination={false}
          loading={loading}
          onChange={(_, tableFilters, sorter) => {
            handleTableChange(pagination, tableFilters, sorter);
          }}
          scroll={{ x: 1200 }}
          bordered
          size="small"
        />

        <div className="flex justify-end p-4">
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showTotal={(total) => `Total ${total} applications`}
            pageSizeOptions={['10', '20', '50', '100']}
            size="small"
            onChange={(page, pageSize) => {
              handleTableChange(
                { current: page, pageSize },
                { status: filters.status },
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
            onShowSizeChange={(_, size) => {
              handleTableChange(
                { current: 1, pageSize: size },
                { status: filters.status },
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SupervisorScreening;
