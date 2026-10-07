import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Plus } from 'lucide-react';
import { Table, Button, Tag, Space, Spin, Alert } from 'antd';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import useStaffAuthStore from '@/store/staffAuthStore';
import {hasPermission} from '@/services/hasPermissionService';

const ExaminersLists = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const notify = notification();
  const submissionData = location.state?.submissionData;
  const [examiners, setExaminers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const cancreate = hasPermission('thesis.create');
  const candelete = hasPermission('thesis.delete');
  const canedit = hasPermission('thesis.update');

  useEffect(() => {
    const fetchExaminers = async () => {
      if (submissionData?.sid && user?.id) {
        try {
          setLoading(true);
          console.log('DoR - Submission Data:', submissionData);
          console.log('DoR - User ID:', user?.id);
          
          const sid = submissionData.sid;
          const response = await API.get(`/Confidential/${sid}`);
          
          console.log('DoR - API Response:', response.data);
          
          if (response.data && Array.isArray(response.data)) {
            const filteredData = response.data.filter(item => {
              console.log('DoR - Filtering item:', {
                id: item.id,
                status: item.status,
                isAddedBySupervisor: item.isAddedBySupervisor,
                addedBy: item.addedBy,
              });
              // Show examiners with status 1 (supervisor approved) or status 0 added by current DoR user
              return item.status === 1 || (item.status === 0 && item.isAddedBySupervisor === false && Number(item.addedBy) === Number(user?.id));
            });

            console.log('DoR - Filtered Data:', filteredData);
          // Transform API response to match component structure
          const transformedExaminers = filteredData.map((examiner, index) => ({
            id: examiner.id,
            srNo: index + 1,
            name: examiner.examinerName,
            designation: examiner.designationName,
            university: examiner.institution,
            address: examiner.address,
            email: examiner.examinerEmail,
            phone: examiner.contactNo,
            supervisor: examiner.supervisorName,
            state: examiner.state,
            recommendations: null,
            remarks: null,
            reportStatus: null,
            status: examiner.status,
            requestStatus: examiner.status === 0 ? 'Pending' : examiner.status === 1 ? 'Approved' : examiner.status === 2 ? 'Forwarded to VC' : 'Rejected',
            recommendedBy: examiner.adminName,
            selected: false,
            isAddedBySupervisor: examiner.isAddedBySupervisor
          }));
          
          setExaminers(transformedExaminers);
          
          // Set candidate info from first examiner record (all records have same candidate info)
          if (filteredData.length > 0) {
            setCandidateInfo({
              permUserName: filteredData[0].permUserName,
              name: filteredData[0].name,
              subjectName: filteredData[0].subjectName
            });
          }
        } else {
          console.log('DoR - No data or data is not array');
          setExaminers([]);
        }
      } catch (error) {
        console.error('DoR - Error fetching examiners:', error);
        notify.error('Failed to fetch examiners data');
        setExaminers([]);
      } finally {
        setLoading(false);
      }
    } else {
      console.log('DoR - Missing sid or user.id:', { sid: submissionData?.sid, userId: user?.id });
      setLoading(false);
    }
  };

  fetchExaminers();
}, [submissionData?.sid, user?.id]);

  const handleAddExaminer = () => {
    navigate('/director_panel/add-examiner', {
      state: { submissionData }
    });
  };

  const handleBackToList = () => {
    navigate('/director_panel/thesis');
  };

  // Define table columns for Ant Design Table
  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 80,
      align: 'center',
    },
    {
      title: 'Name of Examiner',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <div>
          <div className="font-medium text-gray-900">{text}</div>
          {record.reportStatus && (
            <div className="mt-1">
              <span className="text-blue-600 underline text-xs cursor-pointer">
                {record.reportStatus}
              </span>
            </div>
          )}
          
        </div>
      ),
    },
    {
      title: 'Detail',
      key: 'detail',
      render: (_, record) => (
        <div className="space-y-1 text-sm">
          <div>
            <span className="font-medium">Designation:</span> {record.designation}
          </div>
          <div>
            <span className="font-medium">University / Institution:</span> {record.university}
          </div>
          <div>
            <span className="font-medium">Address:</span> {record.address}
          </div>
          <div>
            <span className="font-medium">State:</span> {record.state}
          </div>
          <div>
            <span className="font-medium">Email:</span> 
            <span className="text-blue-600"> {record.email}</span>
            <span className="ml-4 font-medium">Phone:</span> {record.phone}
          
          </div>
          {record.recommendations && (
            <div>
              <span className="font-medium">Recommendations:</span> {record.recommendations}
              {record.reportStatus && (
                <span className="ml-4 text-blue-600 underline cursor-pointer">
                  {record.reportStatus}
                </span>
              )}
            </div>
          )}
          {record.remarks && (
            <div>
              <span className="font-medium">Remarks:</span> {record.remarks}
            </div>
          )}
          {record.recommendedBy && (
            <div>
              <span className="font-medium">Recommended by:</span> {record.recommendedBy}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {canedit && (
             <Button type="link" size="small" className="text-blue-600 hover:text-blue-800 p-0">
            Edit
          </Button>
          )}
         {candelete && (
           <Button type="link" size="small" className="text-red-600 hover:text-red-800 p-0">
            Delete
          </Button>
         )}
         
          {!record.reportStatus && !record.requestStatus && (
            <Button type="link" size="small" className="text-green-600 hover:text-green-800 p-0">
              Send Request
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleForwardToVC = async () => {
    // Get all examiners (both status 1 and status 0) that are not yet forwarded
    const examinersToForward = examiners.filter(e => e.requestStatus !== 'Forwarded to VC');

    if (examinersToForward.length === 0) {
      notify.warning('All examiners have already been forwarded to VC');
      return;
    }

    // Check exactly 12 examiners requirement (6 status 1 + 6 status 0)
    const status1Count = examinersToForward.filter(e => e.status === 1).length;
    const status0Count = examinersToForward.filter(e => e.status === 0).length;
    
    if (status1Count !== 6 || status0Count !== 6) {
      notify.warning('Please add exactly 6 supervisor-approved and 6 DoR-added examiners before forwarding to VC');
      return;
    }

    try {
      setForwarding(true);

      // Prepare the payload with all examiners to forward
      const payload = {
        vivaExaminerIds: examinersToForward.map(e => e.id),
        status: 2
      };

      console.log('Forwarding to VC with payload:', payload);

      // Make PATCH API call
      const response = await API.patch('/Confidential/update-status', payload);

      if (response.data) {
        notify.success(`Successfully forwarded ${examinersToForward.length} examiner(s) to VC`);

        // Refresh the examiner list
        const sid = submissionData.sid;
        const refreshResponse = await API.get(`/Confidential/${sid}`);

        if (refreshResponse.data && Array.isArray(refreshResponse.data)) {
          const filteredData = refreshResponse.data.filter(item => {
            return item.status === 1 || (item.isAddedBySupervisor === false && Number(item.addedBy) === Number(user?.id));
          });

          const transformedExaminers = filteredData.map((examiner, index) => ({
            id: examiner.id,
            srNo: index + 1,
            name: examiner.examinerName,
            designation: examiner.designationName,
            university: examiner.institution,
            address: examiner.address,
            email: examiner.examinerEmail,
            phone: examiner.contactNo,
            supervisor: examiner.supervisorName,
            state: examiner.state,
            recommendations: null,
            remarks: null,
            reportStatus: null,
            status: examiner.status,
            requestStatus: examiner.status === 0 ? 'Pending' : examiner.status === 1 ? 'Approved' : examiner.status === 2 ? 'Forwarded to VC' : 'Rejected',
            recommendedBy: examiner.adminName,
            selected: false,
            isAddedBySupervisor: examiner.isAddedBySupervisor
          }));

          setExaminers(transformedExaminers);
        }
      }
    } catch (error) {
      console.error('Error forwarding to VC:', error);
      notify.error('Failed to forward to VC. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  if (!candidateInfo && !loading && examiners.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No examiner data available</p>
          <button
            onClick={handleBackToList}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Thesis Submitted List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={20} />
            Back to Thesis List
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Examiner Recommendation for {candidateInfo?.permUserName} - {candidateInfo?.name} - {candidateInfo?.subjectName}
            </h1>
          </div>
        </div>
        <div className="flex gap-3">
          {cancreate && (
          <Button
            type="primary"
            onClick={handleAddExaminer}
            disabled={examiners.length >= 12}
            className={examiners.length >= 12 ? 'bg-gray-400 border-gray-400' : 'bg-blue-600 hover:bg-blue-700 border-blue-600'}
          >
            {examiners.length >= 12 ? 'Maximum 12 Examiners Reached' : 'Add New Examiner'}
          </Button>)}
        </div>
      </div>

      {/* Examiners Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-8">
          <div className="text-center">
            <Spin size="large" />
            <p className="text-gray-600 mt-4">Loading examiners...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
          <Table
            columns={columns}
            dataSource={examiners}
            rowKey="id"
            pagination={false}
            bordered
            size="small"
            className="examiner-table"
            scroll={{ x: 'max-content' }}
          />
          {/* Summary Section */}
          <div className="p-4 bg-gray-50 border-t border-gray-300">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span>Supervisor Approved: <span className="font-medium">{examiners.filter(e => e.status === 1).length}/6</span></span>
                <span className="ml-4">DoR Added: <span className="font-medium">{examiners.filter(e => e.status === 0).length}/6</span></span>
                <span className="ml-4">Total: <span className="font-medium">{examiners.length}/12</span></span>
                {examiners.length < 12 && (
                  <span className="ml-4 text-blue-600">({12 - examiners.length} more required)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons for Forward to VC */}
      {examiners.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Forward Examiners to VC
            </h3>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Total Examiners: {examiners.length}/12</span>
              {examiners.length < 12 && (
                <span className="ml-2 text-blue-600">({12 - examiners.length} more required)</span>
              )}
            </div>
          </div>

          {/* Validation Messages */}
          <div className="mb-4">
            {(examiners.filter(e => e.status === 1).length < 6 || examiners.filter(e => e.status === 0).length < 6) && (
              <Alert
                message={`📋 Need ${6 - examiners.filter(e => e.status === 1).length} more supervisor-approved examiner(s) and ${6 - examiners.filter(e => e.status === 0).length} more DoR-added examiner(s)`}
                type="info"
                showIcon
                className="mb-2"
              />
            )}
            {examiners.filter(e => e.status === 1).length === 6 && examiners.filter(e => e.status === 0).length === 6 && (
              <Alert
                message={`✅ All 12 examiners ready (6 supervisor-approved + 6 DoR-added) - Ready to forward to VC`}
                type="success"
                showIcon
                className="mb-2"
              />
            )}
            {examiners.filter(e => e.requestStatus === 'Forwarded to VC').length > 0 && (
              <Alert
                message={`✅ ${examiners.filter(e => e.requestStatus === 'Forwarded to VC').length} examiner(s) already forwarded to VC`}
                type="success"
                showIcon
                className="mb-2"
              />
            )}
            {examiners.filter(e => e.requestStatus === 'Rejected').length > 0 && (
              <Alert
                message={`❌ ${examiners.filter(e => e.requestStatus === 'Rejected').length} examiner(s) rejected the request`}
                type="error"
                showIcon
                className="mb-2"
              />
            )}
          </div>

          <div className="flex gap-4">
            <Button
              type="primary"
              onClick={handleForwardToVC}
              loading={forwarding}
              disabled={examiners.filter(e => e.status === 1).length !== 6 || examiners.filter(e => e.status === 0).length !== 6}
              className="bg-purple-600 hover:bg-purple-700 border-purple-600"
            >
              Forward All to VC
            </Button>
          </div>
        </div>
      )}

      {!loading && examiners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Examiners Added
          </h3>
          <p className="text-gray-500 mb-2">
            Add examiners for this candidate's thesis evaluation.
          </p>
          <p className="text-sm text-blue-600 mb-4">
            📋 Requirement: Add exactly 12 examiners (all will be forwarded to VC)
          </p>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleAddExaminer}
            className="bg-blue-600 hover:bg-blue-700 border-blue-600"
          >
            Add First Examiner
          </Button>
        </div>
      )}
    </div>
  );
};

export default ExaminersLists;