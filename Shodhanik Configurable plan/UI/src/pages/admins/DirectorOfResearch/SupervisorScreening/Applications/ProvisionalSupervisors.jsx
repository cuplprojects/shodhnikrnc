import { useState, useEffect } from 'react';
import { Table, Pagination } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import workflowService from '@/services/workflowService';
import { getStatusCounts } from '@/services/supervisorRecognitionCellService';
import Button from '@/components/ui/Button';
import { getStepOrderForRole, getStatusForStep, parseWorkflowHistoryResponse } from '@/utils/workflowStepMapper';

const ProvisionalSupervisors = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get status from URL or default to empty array (all)
  const getInitialStatus = () => {
    const statusParam = searchParams.get('status');
    if (!statusParam || statusParam === 'all') return [];
    // Handle comma-separated statuses from URL
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

  // Update pagination and filters when URL params change
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

  // Status configuration
  const [statusConfig, setStatusConfig] = useState({
    all: { label: 'All Applications', color: 'default', count: 0 },
    'Unscreened': { label: 'Unscreened', color: 'orange', count: 0 },
    'Eligible': { label: 'Eligible', color: 'green', count: 0 },
    'Not Eligible': { label: 'Not Eligible', color: 'red', count: 0 },
  });

  // Table columns
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
        { text: 'Unscreened', value: 'Unscreened' },
        { text: 'Eligible', value: 'Eligible' },
        { text: 'Not Eligible', value: 'Not Eligible' },
      ],
      filterMultiple: false,
      filteredValue: filters.status.length > 0 ? filters.status : null,
      render: (status) => {
        const getStatusConfig = (status) => {
          switch (status) {
            case 'Eligible':
              return { label: 'Eligible', color: 'bg-green-100 text-green-700 border-green-300' };
            case 'Not Eligible':
              return { label: 'Not Eligible', color: 'bg-red-100 text-red-700 border-red-300' };
            case 'Unscreened':
              return { label: 'Unscreened', color: 'bg-orange-100 text-orange-700 border-orange-300' };
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
          {text || 'Stage 5'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          module="provisional_supervisors"
          action="read"
          label="View"
          variant="link"
          size="sm"
          onClick={() => handleViewDetails(record)}
        />
      ),
    },
  ];

  // Fetch status counts
  const fetchStatusCounts = async () => {
    try {
      const counts = await workflowService.getSupervisorWorkflowStats({ workflowId: 5, stepOrder: 5 });
      setStatusConfig(prev => ({
        all: { ...prev.all, count: counts.total || 0 },
        'Unscreened': { ...prev['Unscreened'], count: counts.pending || 0 },
        'Eligible': { ...prev['Eligible'], count: counts.approved || 0 },
        'Not Eligible': { ...prev['Not Eligible'], count: counts.rejected || 0 },
      }));
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  // Map API response to table format - handle the new data structure
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
      key: item.supId || item.key || index, // Unique key for React table
      supId: item.supId,
      applicationNo: item.applicationNo || item.applicationNumber,
      name: item.name,
      designation: item.designation,
      subject: deduplicateSubject(item.subject),
      mobileNo: item.mobileNo,
      status: item.status,
      form: item.form || 'Level 5',
      deptEst: item.deptEst,
      screening1Status: item.screening1Status,
      screening1Count: item.screening1Count,
      screening2Status: item.screening2Status,
      screening2Count: item.screening2Count,
      originalData: item.originalData || item
    }));
  };

  // Fetch data from backend
  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const currentStatus = params.status !== undefined ? params.status : filters.status;
      const currentPage = params.page || pagination.current;
      const currentPageSize = params.pageSize || pagination.pageSize;
      const currentSearch = params.search !== undefined ? params.search : filters.search;
      const currentSortField = params.sortField || filters.sortField;
      const currentSortOrder = params.sortOrder || filters.sortOrder;

      const workflowParams = {
        page: currentPage,
        pageSize: currentPageSize,
        search: currentSearch,
        sortField: currentSortField,
        sortOrder: currentSortOrder,
        workflowId: 5, // Supervisor Registration
      };

      // Map status filter to workflow parameters
      if (currentStatus && currentStatus.length > 0) {
        if (currentStatus.includes('Unscreened')) {
          workflowParams.currentStepOrder = 5; // Step 5 is for Role 18 (DOR)
          workflowParams.status = "Pending";
        } else if (currentStatus.includes('Eligible')) {
          // If approved by DOR, it moves to step 6 or beyond
          workflowParams.minStepOrder = 6;
        } else if (currentStatus.includes('Not Eligible')) {
          workflowParams.status = "Rejected";
        }
      } else {
        // "All Applications": applications that reached DOR (Step 5) or beyond
        workflowParams.minStepOrder = 5;
      }

      const result = await workflowService.getSupervisorWorkflowList(workflowParams);
      
      // Fetch workflow history for all supervisors to get accurate status
      const entityIds = (result.data || []).map(item => item.supId);
      let historyMap = {};
      
      if (entityIds.length > 0) {
        try {
          historyMap = await workflowService.getBulkHistory("Supervisor", entityIds);
        } catch (error) {
          console.error('Error fetching bulk history:', error);
        }
      }
      
      const mappedData = (result.data || []).map(item => {
        // Get workflow history for this supervisor
        const historyResponse = historyMap[item.supId];
        const { logs: history } = parseWorkflowHistoryResponse(historyResponse);
        
        // Step order for DOR role is 5
        const dorStepOrder = 5;
        
        // Determine status using utility function
        const status = getStatusForStep({
          stepOrder: dorStepOrder,
          workflowHistory: history,
          currentStepOrder: item.currentStepOrder || 0,
          workflowStatus: item.workflowStatus || 'Pending',
          isLocked: item.isLocked || false
        });
        
        return {
          ...item,
          key: item.supId,
          applicationNo: item.applicationNumber,
          subject: deduplicateSubject(item.subject),
          form: item.form || (item.workflowStatus === 'Approved' ? 'Completed' : `Stage ${item.currentStepOrder || 5}`),
          status: status,
          workflowHistory: history
        };
      });

      setData(mappedData);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: result.page || currentPage,
        pageSize: result.pageSize || currentPageSize,
      }));

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle table change (pagination, filters, sorter)
  const handleTableChange = (newPagination, tableFilters, sorter) => {
    // Extract status filter from table filters (array of selected statuses)
    const rawStatus = tableFilters?.status;
    const statusFilter = rawStatus !== undefined && rawStatus !== null
      ? (Array.isArray(rawStatus) ? rawStatus : [rawStatus])
      : [];

    const params = {
      page: newPagination.current,
      pageSize: newPagination.pageSize,
      search: filters.search,
      status: statusFilter,
      sortField: sorter?.field,
      sortOrder: sorter?.order,
    };

    // Update pagination state
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));

    // Update local filters state
    setFilters(prev => ({ 
      ...prev, 
      status: statusFilter,
      sortField: sorter?.field || prev.sortField,
      sortOrder: sorter?.order || prev.sortOrder
    }));

    updateURLParams(params);
    fetchData(params);
  };

  // Handle search
  const handleSearch = (value) => {
    const newFilters = { ...filters, search: value };
    setFilters(newFilters);
    updateURLParams({ ...newFilters, page: 1, pageSize: pagination.pageSize });
    fetchData({ ...newFilters, page: 1, pageSize: pagination.pageSize });
  };

  // Handle status change
  const handleStatusChange = (status) => {
    const statusArray = status === 'all' ? [] : [status];
    const newFilters = { ...filters, status: statusArray };
    setFilters(newFilters);
    updateURLParams({ ...newFilters, page: 1, pageSize: pagination.pageSize });
    fetchData({ ...newFilters, page: 1, pageSize: pagination.pageSize });
  };

  // Update URL params
  const updateURLParams = (params) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'status') {
        // Handle status array
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

  // Handle view details
  const handleViewDetails = (record) => {
    navigate(`/director_panel/supervisor-details/${record.supId}`, {
      state: {
        status: filters.status.length > 0 ? filters.status.join(',') : 'all',
        returnPath: '/director_panel/provisional-supervisors'
      }
    });
  };



  // Initial load
  useEffect(() => {
    fetchStatusCounts();
    fetchData({
      page: pagination.current,
      pageSize: pagination.pageSize,
      ...filters,
    });
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Supervisors Screening</h1>
        <p className="text-gray-600">Review and approve supervisors forwarded by Dean Office</p>
      </div>

      {/* Status Tabs */}
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* Search and Pagination Bar */}
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

        {/* Bottom Pagination */}
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

export default ProvisionalSupervisors;