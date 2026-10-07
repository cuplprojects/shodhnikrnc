import { useState, useEffect } from 'react';
import { Table, Pagination, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { fetchPhdApplications, getPhdStatusCounts, getPhdRegTypeCounts, sendPhdApplicationForReview } from '@/services/phdAdmissionService';
import workflowService from "@/services/workflowService";
import notification from '@/services/NotificationService';


const PhDApplications = () => {
  //permissions
  
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: parseInt(searchParams.get('page')) || 1,
    pageSize: parseInt(searchParams.get('pageSize')) || 10,
    total: 0,
  });
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    regType: searchParams.get('regType') || '',
    sortField: searchParams.get('sortField') || '',
    sortOrder: searchParams.get('sortOrder') || '',
    onlyReadyForReview: true, // Always filter for step 5 completed applications
  });

  const DECISION_STATUS = {
    ApplicationScreeningPending: 0,
    ApplicationScreeningHold: 1,
    ApplicationScreeningRejected: 2,
    ApplicationScreeningPassed: 3,
    InterviewScheduled: 4,
    InterviewRejected: 5,
    InterviewApproved: 6,
    CounsellingScheduled: 7,
    CounsellingUnderReview: 8,
    CounsellingRejectedFinal: 9,
    CounsellingApprovedFinal: 10,
    CourseworkRejected: 11,
    CourseworkApproved: 12,
  };

  const STATUS_CONFIG_MAP = {
    all: { label: 'All Applications', color: 'default', count: 0, section: 'primary' },
    0: { label: 'Application Screening Pending', color: 'orange', count: 0, section: 'primary' },
    1: { label: 'Application Screening Hold', color: 'slate', count: 0, section: 'primary' },
    2: { label: 'Application Screening Rejected', color: 'red', count: 0, section: 'primary' },
    3: { label: 'Application Screening Passed', color: 'green', count: 0, section: 'primary', isCumulative: true },
    4: { label: 'Interview Scheduled', color: 'blue', count: 0, section: 'advanced' },
    5: { label: 'Interview Rejected', color: 'red', count: 0, section: 'advanced' },
    6: { label: 'Interview Approved', color: 'green', count: 0, section: 'advanced' },
    7: { label: 'Counselling Scheduled', color: 'blue', count: 0, section: 'advanced' },
    8: { label: 'Counselling Under Review', color: 'slate', count: 0, section: 'advanced' },
    9: { label: 'Counselling Rejected (Final)', color: 'red', count: 0, section: 'advanced' },
    10: { label: 'Counselling Approved (Final)', color: 'green', count: 0, section: 'advanced' },
    11: { label: 'Coursework Rejected', color: 'red', count: 0, section: 'advanced' },
    12: { label: 'Coursework Approved', color: 'green', count: 0, section: 'advanced' },
  };

  const [statusConfig, setStatusConfig] = useState(STATUS_CONFIG_MAP);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Registration type configuration for tabs
  const [regTypeConfig, setRegTypeConfig] = useState({
    all: { label: 'All Types', color: 'default', count: 0 }
  });

  // Update filters when URL params change
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      current: parseInt(searchParams.get('page')) || 1,
      pageSize: parseInt(searchParams.get('pageSize')) || 10,
    }));
    
    setFilters({
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      regType: searchParams.get('regType') || '',
      sortField: searchParams.get('sortField') || '',
      sortOrder: searchParams.get('sortOrder') || '',
      onlyReadyForReview: true, // Always filter for step 5 completed applications
    });
  }, [searchParams]);

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
      title: 'Registration Type',
      dataIndex: 'regType',
      key: 'regType',
      width: 180,
      render: (regType) => (
        <span className="text-sm font-medium text-gray-700">{regType}</span>
      ),
    },
    {
      title: 'Exemption Category',
      dataIndex: 'exemptCategory',
      key: 'exemptCategory',
      width: 150,
      render: (exemptCategory) => exemptCategory ? (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
          {exemptCategory}
        </span>
      ) : (
        <span className="text-gray-400 text-xs">-</span>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 180,
    },
    {
      title: 'Mobile No',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: 'Part Time',
      dataIndex: 'isPartTime',
      key: 'isPartTime',
      width: 100,
      render: (isPartTime) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          isPartTime 
            ? 'bg-red-100 text-red-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isPartTime ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 100,
      render: (year) => (
        <span className="text-sm text-gray-600">{year || '-'}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
       fixed: 'right',
      width: 130,
      render: (status) => {
        const getStatusDisplay = (status) => {
          // Map workflow string statuses
          const workflowStatusMap = {
            "Pending": { label: 'Pending', color: 'bg-orange-100 text-orange-700 border-orange-300' },
            "Approved": { label: 'Accepted', color: 'bg-green-100 text-green-700 border-green-300' },
            "Rejected": { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-300' },
          };
          
          const display = workflowStatusMap[status];
          
          if (!display) {
            return { label: status || 'Unknown', color: 'bg-gray-100 text-gray-700 border-gray-300' };
          }

          return display;
        };
        
        const display = getStatusDisplay(status);
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium border ${display.color}`}>
            {display.label}
          </span>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <div className="flex gap-1">
          <Button
            module="phd_applications"
            action="read"
            label="View"
            variant="link"
            size="sm"
            onClick={() => handleViewDetails(record)}
          />
          {record.canSendForReview && record.status !== 'under_review' && (
            <Button
              module="phd_applications"
              action="update"
              label="Review"
              variant="primary"
              size="sm"
              onClick={() => handleSendForReview(record)}
            />
          )}
        </div>
      ),
    },
  ];

  // Fetch registration type counts
  const fetchRegTypeCounts = async () => {
    try {
      console.log('=== Fetching RegType Counts ===');
      const regTypes = await getPhdRegTypeCounts();
      console.log('PhD RegType counts received:', regTypes);
      console.log('RegTypes keys:', Object.keys(regTypes));
      console.log('RegTypes values:', Object.values(regTypes));
      
      // Build dynamic regType configuration using IDs - ALWAYS include all 6 filters
      const newRegTypeConfig = {};
      
      // Define the expected 6 filters in order
      const expectedFilters = [
        { id: 'all', name: 'All Applications', defaultCount: 0 },
        { id: 'ret_regular', name: 'Research Entrance Test (RET)', defaultCount: 0 },
        { id: 'ret_exemption', name: 'Exemption from Entrance Test (RET)', defaultCount: 0 },
        { id: 'foreign_students', name: 'Ph.D. Admission for Foreign Students', defaultCount: 0 },
        { id: 'part_time', name: 'Part Time Ph.D', defaultCount: 0 },
        { id: 'phd_direct', name: 'Ph.D. Direct Admission', defaultCount: 0 }
      ];
      
      // First, add all expected filters with default values
      expectedFilters.forEach(filter => {
        newRegTypeConfig[filter.id] = {
          id: filter.id,
          label: filter.name,
          color: getColorForRegType(filter.name),
          count: filter.defaultCount
        };
      });
      
      // Then, update with actual data from API
      Object.entries(regTypes).forEach(([id, regTypeData]) => {
        console.log(`Processing regType: ${id}`, regTypeData);
        if (newRegTypeConfig[id]) {
          newRegTypeConfig[id].count = regTypeData.count || 0;
        } else {
          // If API returns unexpected filter, add it
          newRegTypeConfig[id] = {
            id: regTypeData.id,
            label: regTypeData.name,
            color: getColorForRegType(regTypeData.name),
            count: regTypeData.count || 0
          };
        }
      });
      
      console.log('Final regTypeConfig:', newRegTypeConfig);
      setRegTypeConfig(newRegTypeConfig);
    } catch (error) {
      console.error('Error fetching PhD registration type counts:', error);
      
      // Fallback: Set default configuration with all 6 filters
      const fallbackConfig = {
        all: { id: 'all', label: 'All Applications', color: 'default', count: 0 },
        ret_regular: { id: 'ret_regular', label: 'Research Entrance Test (RET)', color: 'blue', count: 0 },
        ret_exemption: { id: 'ret_exemption', label: 'Exemption from Entrance Test (RET)', color: 'cyan', count: 0 },
        foreign_students: { id: 'foreign_students', label: 'Ph.D. Admission for Foreign Students', color: 'purple', count: 0 },
        part_time: { id: 'part_time', label: 'Part Time Ph.D', color: 'red', count: 0 },
        phd_direct: { id: 'phd_direct', label: 'Ph.D. Direct Admission', color: 'green', count: 0 }
      };
      setRegTypeConfig(fallbackConfig);
    }
  };

  // Helper function to get color based on registration type name
  const getColorForRegType = (name) => {
    if (name.includes('All Applications')) return 'default';
    if (name.includes('Research Entrance Test (RET)')) return 'blue';
    if (name.includes('Exemption from Entrance Test (RET)')) return 'cyan';
    if (name.includes('Ph.D. Admission for Foreign Students')) return 'purple';
    if (name.includes('Part Time Ph.D')) return 'red';
    if (name.includes('Ph.D. Direct Admission')) return 'green';
    return 'blue';
  };

  const fetchStatusCounts = async (regTypeFilter = null) => {
    try {
      const counts = await getPhdStatusCounts(regTypeFilter);
      console.log('PhD Status counts received:', counts);
      
      const newStatusConfig = { ...STATUS_CONFIG_MAP };
      newStatusConfig.all.count = counts.total || 0;

      Object.entries(counts).forEach(([key, value]) => {
        if (key !== 'total' && newStatusConfig[key]) {
          newStatusConfig[key].count = value || 0;
        }
      });

      setStatusConfig(newStatusConfig);
    } catch (error) {
      console.error('Error fetching PhD status counts:', error);
    }
  };

  // Fetch data from backend
  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const result = await workflowService.getScholarWorkflowList({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        search: params.search || filters.search,
        status: params.status || filters.status,
        workflowName: "Scholar Registration"
      });
      
      const mappedData = (result.data || []).map((record, index) => ({
        key: record.entityID,
        sid: record.entityID,
        scholarId: record.applicationNumber || record.entityID,
        name: record.name,
        email: record.email,
        phone: record.phone,
        regType: record.registrationType,
        department: record.department,
        status: record.status,
        currentStep: record.currentStepName,
        instanceId: record.instanceID
      }));
      
      setData(mappedData);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: result.page || 1,
      }));
    } catch (error) {
      console.error('Error fetching Scholar applications data:', error);
      setData([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // Handle table change (pagination, sorter)
  const handleTableChange = (newPagination, tableFilters, sorter) => {
    const params = {
      page: newPagination.current,
      pageSize: newPagination.pageSize,
      search: filters.search,
      status: filters.status,
      regType: filters.regType,
      sortField: sorter.field,
      sortOrder: sorter.order,
    };
    
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
    
    updateURLParams(params);
    fetchData(params);
  };

  // Handle search
  const handleSearch = (value) => {
    const newFilters = { ...filters, search: value };
    setFilters(newFilters);
    const params = { ...newFilters, page: 1, pageSize: pagination.pageSize };
    updateURLParams(params);
    fetchData(params);
  };

  const handleStatusChange = (status) => {
    const statusValue = status === 'all' ? '' : String(status);
    const newFilters = { ...filters, status: statusValue };
    setFilters(newFilters);
    const params = { ...newFilters, page: 1, pageSize: pagination.pageSize };
    updateURLParams(params);
    fetchData(params);
  };

  // Handle registration type change
  const handleRegTypeChange = (regType) => {
    const regTypeValue = regType === 'all' ? '' : regType;
    const newFilters = { ...filters, regType: regTypeValue, status: '' }; // Reset status when regType changes
    setFilters(newFilters);
    
    // Update status counts based on selected registration type
    const regTypeFilter = regType === 'all' ? null : regType;
    fetchStatusCounts(regTypeFilter);
    
    const params = { ...newFilters, page: 1, pageSize: pagination.pageSize };
    updateURLParams(params);
    fetchData(params);
  };

  // Update URL params
  const updateURLParams = (params) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== '') {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  // Handle view details - Navigate to separate page instead of modal
  const handleViewDetails = (record) => {
    console.log('=== Navigating to Details Page ===');
    console.log('Record data:', record);
    console.log('Scholar SID (key):', record.key);
    console.log('Scholar SID (sid):', record.sid);
    console.log('Application Number (scholarId):', record.scholarId);
    console.log('Scholar Name:', record.name);
    
    // Navigate to the details page with the scholar ID
    const scholarId = record.key || record.sid;
    navigate(`/admission-cell/phd-applications/${scholarId}`, {
      state: { 
        returnPath: '/admission-cell/phd-applications',
        applicationData: record 
      }
    });
  };

  // const handleCloseDetailsModal = () => {
  //   // No longer needed - keeping for compatibility
  // };

  // Handle send for review
  const handleSendForReview = async (record) => {
    try {
      console.log('=== Sending Application for Review ===');
      console.log('Record:', record);
      console.log('Can send for review:', record.canSendForReview);
      console.log('Steps completed up to 5:', record.allStepsUpTo5Completed);
      
      if (!record.canSendForReview) {
        notification().error('Application cannot be sent for review. Please ensure all steps 1-5 are completed.');
        return;
      }

      const result = await sendPhdApplicationForReview(record.key);
      notification().success(`Application ${record.scholarId} successfully sent for review`);
      
      // Refresh the data to show updated status
      fetchData({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
      
    } catch (error) {
      console.error('Error sending application for review:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to send application for review';
      notification().error(errorMessage);
    }
  };

  // Initial load
  useEffect(() => {
    fetchRegTypeCounts();
    fetchStatusCounts();
    fetchData({
      page: pagination.current,
      pageSize: pagination.pageSize,
      ...filters,
    });
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Simplified Filter Panel */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        
        {/* Header with Stats */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">PhD Applications</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Total: <span className="font-semibold text-gray-900">{pagination.total}</span>
              </span>
              <span>Page {pagination.current}</span>
            </div>
          </div>
        </div>

        {/* Combined Registration Type Filter */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Registration Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(regTypeConfig).map(([key, config]) => {
              const isActive = key === 'all' ? !filters.regType : filters.regType === key;
              
              // Define colors based on registration type using helper function
              const getTypeColor = (label) => {
                const colorType = getColorForRegType(label);
                const colorMap = {
                  blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
                  purple: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
                  red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
                  green: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
                  default: 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100',
                };
                return colorMap[colorType] || colorMap.default;
              };
              
              return (
                <button
                  key={key}
                  onClick={() => handleRegTypeChange(key)}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm border-2 transition-all duration-200 inline-flex items-center gap-2 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105'
                      : `${getTypeColor(config.label)} border-2 hover:shadow-md`
                  }`}
                >
                  <span>{config.label}</span>
                  <span className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-bold ${
                    isActive 
                      ? 'bg-white/25 text-white' 
                      : 'bg-white border border-current text-current'
                  }`}>
                    {config.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Filter & Search */}
        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Status Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Status</h3>
              <div>
                {/* Primary Status Filters */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(statusConfig)
                    .filter(([_, config]) => config.section === 'primary')
                    .map(([key, config]) => {
                      const isActive = key === 'all' ? !filters.status : String(filters.status) === key;
                      const colorMap = {
                        orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
                        green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
                        red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                        blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                        slate: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                        default: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                      };
                      return (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 inline-flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-slate-700 text-white border-slate-700 shadow-md'
                              : `${colorMap[config.color] || colorMap.default} border`
                          }`}
                        >
                          <span>{config.label}</span>
                          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
                            isActive ? 'bg-white/25 text-white' : 'bg-white border border-current text-current'
                          }`}>
                            {config.count}
                          </span>
                        </button>
                      );
                    })}
                </div>

                {/* Advanced Status Filters */}
                <div>
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mb-2"
                  >
                    <span>{showAdvancedFilters ? '▼' : '▶'}</span>
                    <span>Advanced Filters</span>
                  </button>
                  {showAdvancedFilters && (
                    <div className="flex flex-wrap gap-1.5 pl-2">
                      {Object.entries(statusConfig)
                        .filter(([_, config]) => config.section === 'advanced')
                        .map(([key, config]) => {
                          const isActive = String(filters.status) === key;
                          const colorMap = {
                            orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
                            green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
                            red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                            blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                            slate: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                            default: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                          };
                          return (
                            <button
                              key={key}
                              onClick={() => handleStatusChange(key)}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 inline-flex items-center gap-1.5 ${
                                isActive
                                  ? 'bg-slate-700 text-white border-slate-700 shadow-md'
                                  : `${colorMap[config.color] || colorMap.default} border`
                              }`}
                            >
                              <span>{config.label}</span>
                              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
                                isActive ? 'bg-white/25 text-white' : 'bg-white border border-current text-current'
                              }`}>
                                {config.count}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Search */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Search</h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search applications..."
                  className="w-full pl-10 pr-16 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(e.target.value);
                    }
                  }}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors"
                  onClick={(e) => {
                    const input = e.target.closest('div').querySelector('input');
                    handleSearch(input.value);
                  }}
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {((pagination.current - 1) * pagination.pageSize) + 1} to {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total} applications
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
                { current: page, pageSize },
                {},
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
            onShowSizeChange={(_, size) => {
              handleTableChange(
                { current: 1, pageSize: size },
                {},
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
          onChange={(_, __, sorter) => {
            handleTableChange(pagination, {}, sorter);
          }}
          scroll={{ x: 1600 }}
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
            showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} applications`}
            pageSizeOptions={['10', '20', '50', '100']}
            size="small"
            onChange={(page, pageSize) => {
              handleTableChange(
                { current: page, pageSize },
                {},
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
            onShowSizeChange={(_, size) => {
              handleTableChange(
                { current: 1, pageSize: size },
                {},
                { field: filters.sortField, order: filters.sortOrder }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PhDApplications;