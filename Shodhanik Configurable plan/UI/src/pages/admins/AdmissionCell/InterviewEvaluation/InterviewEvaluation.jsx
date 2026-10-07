import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Pagination, Modal } from 'antd';
import { Eye } from 'lucide-react';
import notification from '@/services/NotificationService';
import { getInterviewEvaluationSubjects, getInterviewEvaluationScholars, updatePhdApplicationStatus } from '@/services/phdAdmissionService';
import { hasPermission } from '@/services/hasPermissionService';

const InterviewEvaluation = () => {

  //permissions
  const canRead = hasPermission('interview_evaluation.read')
  const canEvaluate = hasPermission('interview_evaluation.evaluation')

  if(!canRead){
    return;
  }

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

  // Status filter state - default to all (no status filter)
  const [filters, setFilters] = useState({
    status: []
  });

  // Evaluation modal state
  const [evaluationModalVisible, setEvaluationModalVisible] = useState(false);
  const [evaluationData, setEvaluationData] = useState({
    scholarId: null,
    interviewMarks: '',
    remarks: ''
  });
  const [evaluationSubmitting, setEvaluationSubmitting] = useState(false);

  // Table columns
  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    // {
    //   title: 'Scholar ID',
    //   dataIndex: 'scholarId',
    //   key: 'scholarId',
    //   sorter: true,
    //   width: 120,
    // },
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
    // {
    //   title: 'Department',
    //   dataIndex: 'department',
    //   key: 'department',
    //   width: 180,
    // },
    {
      title: 'Interview Date',
      dataIndex: 'interviewDate',
      key: 'interviewDate',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleDateString('en-IN') : 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'decisionStatus',
      key: 'decisionStatus',
      width: 130,
      render: (decisionStatus, record) => {
        const status = parseInt(decisionStatus);

        const getColorByStatus = (statusVal) => {
          if (statusVal === 4) return 'blue';
          if (statusVal === 5) return 'red';
          if (statusVal === 6 || statusVal >= 6 || statusVal === 10) return 'green';
          return 'gray';
        };

        // Prioritize statusText from API if valid
        let displayLabel = record.statusText && record.statusText !== 'N/A' && record.statusText !== 'Unknown'
          ? record.statusText
          : '';

        // If no statusText, use fallback labels based on decisionStatus
        if (!displayLabel) {
          if (status === 4) {
            displayLabel = 'Interview Scheduled';
          } else if (status === 5) {
            displayLabel = 'Interview Rejected';
          } else if (status === 6 || status >= 6) {
            displayLabel = 'Marks Uploaded';
          } else if (status === 10) {
            displayLabel = 'Selected';
          } else {
            displayLabel = 'Unknown';
          }
        }

        const displayColor = getColorByStatus(status);

        const colorMap = {
          blue: 'bg-blue-100 text-blue-800',
          green: 'bg-green-100 text-green-800',
          red: 'bg-red-100 text-red-800',
          gray: 'bg-gray-100 text-gray-800'
        };
        
        return <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorMap[displayColor]}`}>{displayLabel}</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <div className="flex gap-2">
          {/* <button
            onClick={() => handleViewProfile(record)}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            <Eye size={14} className="inline mr-1" /> Profile
          </button> */}
          <button
            onClick={() => handleEvaluate(record)}
            disabled={record.decisionStatus !== 4}
            className={`px-3 py-1 rounded text-sm ${record.decisionStatus === 4
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            Evaluate
          </button>
        </div>
      ),
    },
  ];

  // Fetch interview evaluation departments
  const fetchDepartments = async () => {
    try {
      const depts = await getInterviewEvaluationSubjects();
      console.log('Interview evaluation subjects:', depts);
      // Map API response to component format
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

  // Handle status filter change (single-select)
  const handleStatusChange = async (statusKey) => {
    const newStatuses = filters.status.includes(statusKey) ? [] : [statusKey];
    setFilters({ status: newStatuses });

    // Fetch data with new status filter
    try {
      const result = await getInterviewEvaluationScholars(
        selectedDepartment || 0,
        1,
        pagination.pageSize,
        newStatuses.length > 0 ? parseInt(newStatuses[0]) : null
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
        statusText: item.statusText,
        interviewDate: item.interviewDate
      }));

      setData(mappedScholars);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: 1,
      }));
    } catch (error) {
      console.error('Error fetching scholars for evaluation:', error);
      const notify = notification();
      notify.error('Failed to load scholars');
    }
  };

  // Handle department filter change
  const handleDepartmentChange = async (deptId) => {
    setSelectedDepartment(deptId);

    try {
      const result = await getInterviewEvaluationScholars(
        deptId || 0,
        pagination.current,
        pagination.pageSize,
        filters.status.length > 0 ? parseInt(filters.status[0]) : null
      );
      console.log('Interview scholars for evaluation:', result);

      const mappedScholars = (result.data || []).map(item => ({
        key: item.sid,
        sid: item.sid,
        scholarId: item.scholarId,
        name: item.name,
        email: item.email,
        phone: item.phoneNumber,
        department: item.subjectName,
        decisionStatus: item.decisionStatus,
        statusText: item.statusText,
        interviewDate: item.interviewDate
      }));

      setData(mappedScholars);
      setPagination(prev => ({
        ...prev,
        total: result.total || 0,
        current: result.page || 1,
      }));
    } catch (error) {
      console.error('Error fetching scholars for evaluation:', error);
      const notify = notification();
      notify.error('Failed to load scholars');
    }
  };

  // Handle view profile
  const handleViewProfile = (record) => {
    navigate(`/admission-cell/phd-applications/${record.sid}`);
  };

  // Handle evaluate
  const handleEvaluate = (record) => {
    setEvaluationData({
      scholarId: record.sid,
      interviewMarks: '',
      remarks: ''
    });
    setEvaluationModalVisible(true);
  };

  // Handle evaluation submission
  const handleEvaluationSubmit = async () => {
    try {
      if (!evaluationData.interviewMarks || evaluationData.interviewMarks === '') {
        const notify = notification();
        notify.error('Please enter interview marks');
        return;
      }

      const marks = parseFloat(evaluationData.interviewMarks);
      if (isNaN(marks) || marks < 0 || marks > 30) {
        const notify = notification();
        notify.error('Please enter valid marks (0-30)');
        return;
      }

      setEvaluationSubmitting(true);

      console.log('=== Interview Evaluation Submission ===');
      console.log('Scholar ID:', evaluationData.scholarId);
      console.log('Interview Marks:', marks);
      console.log('Remarks:', evaluationData.remarks);

      // Send PATCH request with interview marks
      await updatePhdApplicationStatus(evaluationData.scholarId, {
        InterviewMarks: marks,
        RejectReason: evaluationData.remarks || null,
        DecisionStatus:6
      });

      const notify = notification();
      notify.success('Interview marks submitted successfully');

      // Reset states
      setEvaluationModalVisible(false);
      setEvaluationData({ scholarId: null, interviewMarks: '', remarks: '' });

      // Refresh table data
      await handleDepartmentChange(selectedDepartment);

    } catch (error) {
      console.error('Error submitting evaluation:', error);
      const notify = notification();
      notify.error('Failed to submit evaluation');
    } finally {
      setEvaluationSubmitting(false);
    }
  };

  // Handle table pagination and sorting changes
  const handleTableChange = async (paginationConfig) => {
    setPagination(paginationConfig);

    try {
      const result = await getInterviewEvaluationScholars(
        selectedDepartment || 0,
        paginationConfig.current,
        paginationConfig.pageSize,
        filters.status?.length > 0 ? parseInt(filters.status[0]) : null
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
        statusText: item.statusText,
        interviewDate: item.interviewDate
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
      // Load data after departments are fetched
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
            <h2 className="text-lg font-semibold text-gray-900">Interview Evaluation</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
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
                {dept.departmentName}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="p-4 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">Status Filter</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                setFilters({ status: [] });
                try {
                  const result = await getInterviewEvaluationScholars(
                    selectedDepartment || 0,
                    1,
                    pagination.pageSize,
                    null
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
                    statusText: item.statusText,
                    interviewDate: item.interviewDate
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
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all ${filters.status.length === 0
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
            >
              All
            </button>
            {[
              { key: '4', label: 'Interview Scheduled', color: 'blue' },
              { key: '6', label: 'Marks Uploaded', color: 'green' },
              // { key: '5', label: 'Fail Interview', color: 'red' }
            ].map((status) => {
              const isSelected = filters.status.includes(status.key);
              const colorMap = {
                blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                green: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
                red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
              };

              return (
                <button
                  key={status.key}
                  onClick={() => handleStatusChange(status.key)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all ${isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : `${colorMap[status.color]} border-2`
                    }`}
                >
                  {status.label}
                </button>
              );
            })}
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

      {/* Evaluation Modal */}
      <Modal
        title="Interview Evaluation"
        open={evaluationModalVisible}
        onOk={handleEvaluationSubmit}
        onCancel={() => setEvaluationModalVisible(false)}
        confirmLoading={evaluationSubmitting}
        width={500}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Marks <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={evaluationData.interviewMarks}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setEvaluationData({ ...evaluationData, interviewMarks: '' });
                } else {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= 30) {
                    setEvaluationData({ ...evaluationData, interviewMarks: value });
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter interview marks (0-30)"
              min="0"
              max="30"
              step="0.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks
            </label>
            <textarea
              value={evaluationData.remarks}
              onChange={(e) => setEvaluationData({ ...evaluationData, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={4}
              placeholder="Enter remarks for this evaluation (optional)"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InterviewEvaluation;
