import { useState, useEffect } from 'react';
import { Table, Pagination, Modal, DatePicker,Button } from 'antd';
import notification from '@/services/NotificationService';
import { getInterviewStatusCounts, getInterviewPendingDepartments, getInterviewPendingScholars, updatePhdApplicationStatus } from '@/services/phdAdmissionService';
import { hasPermission } from '@/services/hasPermissionService';

const ScheduleInterview = () => {

  //Permissions
  const canUpdate = hasPermission('schedule_interview.update')
  const canRead = hasPermission('schedule_interview.read')

  if(!canRead){
    return;
  }

  const [data, setData] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Department filter state
  const [selectedDepartment, setSelectedDepartment] = useState(0);
  const [departments, setDepartments] = useState([]);

  // Status filter state - default to pending (status 3)
  const [filters, setFilters] = useState({
    status: ['3']
  });

  // Status counts state
  const [statusCounts, setStatusCounts] = useState({
    3: 0,
    4: 0,
    5: 0
  });

  // Interview scheduling modal state
  const [interviewModalVisible, setInterviewModalVisible] = useState(false);
  const [interviewDate, setInterviewDate] = useState(null);
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);

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
      title: 'Mobile No',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    // {
    //   title: 'Status',
    //   dataIndex: 'decisionStatus',
    //   key: 'decisionStatus',
    //   width: 130,
    //   render: (decisionStatus) => {
    //     const getStatusDisplay = (status) => {
    //       switch (status) {
    //         case 3:
    //           return { label: 'Interview Pending', color: 'bg-orange-100 text-orange-700 border-orange-300' };
    //         case 4:
    //           return { label: 'Interview Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    //         case 5:
    //           return { label: 'Interview Rejected', color: 'bg-red-100 text-red-700 border-red-300' };
    //         default:
    //           return { label: 'Unknown', color: 'bg-gray-100 text-gray-700 border-gray-300' };
    //       }
    //     };

    //     const display = getStatusDisplay(decisionStatus);
    //     return (
    //       <span className={`px-2 py-1 rounded text-xs font-medium border ${display.color}`}>
    //         {display.label}
    //       </span>
    //     );
    //   },
    // },
  ];

  // Fetch status counts
  const fetchStatusCounts = async () => {
    try {
      const counts = await getInterviewStatusCounts();
      console.log('Interview Status counts received:', counts);
      setStatusCounts({
        3: counts.interviewPending || 0,
        4: counts.interviewScheduled || 0,
        5: counts.interviewRejected || 0
      });
    } catch (error) {
      console.error('Error fetching interview status counts:', error);
    }
  };

  // Fetch interview pending departments
  const fetchDepartments = async () => {
    try {
      const depts = await getInterviewPendingDepartments();
      console.log('Interview pending departments:', depts);
      setDepartments(depts);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  // Handle status filter change (single-select)
  const handleStatusChange = async (statusKey) => {
    // If clicking the same status, deselect it; otherwise select only this status
    const newStatuses = filters.status.includes(statusKey) ? [] : [statusKey];
    setFilters({ status: newStatuses });

    // Reload data with new status filter
    await handleDepartmentChange(selectedDepartment);
  };

  // Handle department filter change
  const handleDepartmentChange = async (deptId) => {
    setSelectedDepartment(deptId);

    try {
      // Fetch scholars for selected department with pagination and status filter
      const result = await getInterviewPendingScholars(deptId || 0, pagination.current, pagination.pageSize, filters.status.length > 0 ? parseInt(filters.status[0]) : null);
      console.log('Interview pending scholars for department:', result);

      // Map the scholars data to match table format
      const mappedScholars = (result.data || []).map(item => ({
        key: item.sid,
        sid: item.sid,
        scholarId: item.scholarId,
        name: item.name,
        email: item.email,
        phone: item.phoneNumber,
        department: item.subjectName,
        decisionStatus: item.decisionStatus,
        statusText: item.statusText
      }));

      setData(mappedScholars);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: result.page || 1,
      }));
    } catch (error) {
      console.error('Error fetching scholars for department:', error);
      const notify = notification();
      notify.error('Failed to load scholars for this department');
    }
  };

  // Handle schedule interview
  const handleScheduleInterview = () => {
    if (selectedRowKeys.length === 0) {
      const notify = notification();
      notify.error('Please select at least one application');
      return;
    }

    // Open modal to ask for interview date
    setInterviewModalVisible(true);
  };

  // Handle interview submission
  const handleInterviewSubmit = async () => {
    try {
      if (!interviewDate) {
        const notify = notification();
        notify.error('Please select an interview date and time');
        return;
      }

      setInterviewSubmitting(true);

      // Get selected scholars data
      const selectedScholars = data.filter(scholar => selectedRowKeys.includes(scholar.key || scholar.sid));

      if (selectedScholars.length === 0) {
        const notify = notification();
        notify.error('No scholars selected');
        return;
      }

      // Prepare interview date and time as ISO string (includes both date and time)
      const interviewDateTimeStr = interviewDate.toISOString();

      console.log('=== Interview Scheduling Submission ===');
      console.log('Selected Scholars:', selectedScholars.length);
      console.log('Interview DateTime:', interviewDateTimeStr);

      // Send PATCH requests for each selected scholar
      const updatePromises = selectedScholars.map(scholar =>
        updatePhdApplicationStatus(scholar.sid, {
          DecisionStatus: 4,  // InterviewScheduled
          InterviewDate: interviewDateTimeStr
        })
      );

      // Wait for all updates to complete
      const results = await Promise.allSettled(updatePromises);

      // Check results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const notify = notification();
      if (failed > 0) {
        notify.warning(`Interview scheduled for ${successful} application(s), but ${failed} failed`);
      } else {
        notify.success(`Interview scheduled for ${successful} application(s) on ${interviewDate.format('DD-MM-YYYY HH:mm')}`);
      }

      // Reset states
      setInterviewModalVisible(false);
      setInterviewDate(null);
      setSelectedRowKeys([]);

      // Refresh table data
      await handleDepartmentChange(selectedDepartment);

    } catch (error) {
      console.error('Error scheduling interview:', error);
      const notify = notification();
      notify.error('Failed to schedule interview');
    } finally {
      setInterviewSubmitting(false);
    }
  };

  // Handle table pagination and sorting changes
  const handleTableChange = async (paginationConfig, filters, sorter) => {
    setPagination(paginationConfig);

    // Reload data with new pagination
    try {
      const result = await getInterviewPendingScholars(
        selectedDepartment || 0,
        paginationConfig.current,
        paginationConfig.pageSize,
        filters.status?.length > 0 ? parseInt(filters.status[0]) : (filters.status?.length > 0 ? parseInt(filters.status[0]) : null)
      );

      const mappedScholars = (result.data || []).map(item => ({
        key: item.sid,
        sid: item.sid,
        scholarId: item.scholarId,
        name: item.name,
        email: item.email,
        phone: item.phoneNumber,
        department: item.subjectName,
        decisionStatus: item.decisionStatus,
        statusText: item.statusText
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
    fetchStatusCounts();
    fetchDepartments();
    // Load all interview pending scholars (subjectId=0 for all)
    handleDepartmentChange(0);
  }, []);

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      console.log('Selected row keys:', newSelectedRowKeys);
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: selectedDepartment === 0 || record.decisionStatus >= 4, // Disable if all departments selected or interview already scheduled
      title: selectedDepartment === 0 ? 'Select a specific department first' : (record.decisionStatus >= 4 ? 'Interview already scheduled' : ''),
    }),
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Filter Panel */}
      <div className="bg-white rounded-lg shadow-sm mb-4">

        {/* Header with Stats */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Schedule Interview</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Total: <span className="font-semibold text-gray-900">{pagination.total}</span>
              </span>
              <span>Selected: <span className="font-semibold text-gray-900">{selectedRowKeys.length}</span></span>
            </div>
          </div>
        </div>

        {/* Department Filter - Primary Filter */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Department Filter</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDepartmentChange(0)}
              className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all ${selectedDepartment === 0
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
                className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all ${selectedDepartment === dept.departmentId
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {dept.departmentName} ({dept.pendingCount})
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter - Hardcoded 3 Status Buttons */}
        {/* <div className="p-4 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Status Filter</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { key: '3', label: 'Interview Pending', color: 'orange' },
              { key: '4', label: 'Interview Scheduled', color: 'blue' },
              { key: '5', label: 'Interview Rejected', color: 'red' }
            ].map((status) => {
              const isSelected = filters.status.includes(status.key);
              const count = statusCounts[parseInt(status.key)] || 0;
              const colorMap = {
                orange: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
                blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
              };
              
              return (
                <button
                  key={status.key}
                  onClick={() => handleStatusChange(status.key)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : `${colorMap[status.color]} border-2`
                  }`}
                >
                  <span>{status.label}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    isSelected
                      ? 'bg-indigo-700 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div> */}
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex gap-2">
        {canUpdate &&
          <Button
            variant="solid"
            label={`Schedule Interview (${selectedRowKeys.length})`}
            onClick={handleScheduleInterview}
            disabled={selectedRowKeys.length === 0}
            type='primary'
          >Schedule</Button>
        }
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
          onChange={(_, __, sorter) => {
            handleTableChange(pagination, {}, sorter);
          }}
          rowSelection={rowSelection}
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

      {/* Interview Scheduling Modal */}
      <Modal
        title="Schedule Interview"
        open={interviewModalVisible}
        onOk={handleInterviewSubmit}
        onCancel={() => setInterviewModalVisible(false)}
        confirmLoading={interviewSubmitting}
        width={500}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Date & Time
            </label>
            <DatePicker
              showTime
              format="DD-MM-YYYY HH:mm"
              value={interviewDate}
              onChange={setInterviewDate}
              className="w-full"
              placeholder="Select date and time"
              disabledDate={(current) => {
                // Disable dates before today
                return current && current < new Date().setHours(0, 0, 0, 0);
              }}
              disabledTime={(now) => {
                const today = new Date();
                // now is a Dayjs object, convert to Date
                const selectedDate = now?.toDate?.() || new Date();

                const isToday =
                  selectedDate.getFullYear() === today.getFullYear() &&
                  selectedDate.getMonth() === today.getMonth() &&
                  selectedDate.getDate() === today.getDate();

                if (!isToday) return {};

                // For today, disable hours and minutes before current time
                const currentHour = today.getHours();
                const currentMinute = today.getMinutes();

                return {
                  disabledHours: () => {
                    const hours = [];
                    for (let i = 0; i < currentHour; i++) {
                      hours.push(i);
                    }
                    return hours;
                  },
                  disabledMinutes: (selectedHour) => {
                    if (selectedHour === currentHour) {
                      const minutes = [];
                      for (let i = 0; i < currentMinute; i++) {
                        minutes.push(i);
                      }
                      return minutes;
                    }
                    return [];
                  }
                };
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Applications ({selectedRowKeys.length})
            </label>
            <div className="bg-gray-50 p-3 rounded-lg max-h-48 overflow-y-auto">
              {data
                .filter(scholar => selectedRowKeys.includes(scholar.key || scholar.sid))
                .map((scholar, index) => (
                  <div key={index} className="text-sm text-gray-600 py-1">
                    {index + 1}. {scholar.name} ({scholar.scholarId})
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Interview will be scheduled for {selectedRowKeys.length} application(s) on {interviewDate?.format('DD-MM-YYYY HH:mm')}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ScheduleInterview;
