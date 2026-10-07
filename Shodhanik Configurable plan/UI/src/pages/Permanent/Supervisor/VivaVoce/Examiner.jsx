import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Plus } from 'lucide-react';
import { Table, Button, Tag, Space, Spin, Alert } from 'antd';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';


const Examiner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getSupId } = useSupervisorAuthStore();
    const notify = notification();
  
  // Get submission data from location state
  const submissionData = location.state?.submissionData;
  const shodhanikId = submissionData?.shodhanikId;
  const supId = getSupId();
console.log(supId)
  const [examiners, setExaminers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    const fetchExaminers = async () => {
      if (shodhanikId && supId) {
        try {
          setLoading(true);
          setError(null);

          // Use the sid from submissionData to fetch examiners
          const sid = submissionData?.sid || 1; // fallback to 1 for testing
          const response = await API.get(`/Confidential/${sid}`);

          console.log('API Response:', response.data);
          console.log('User ID:', supId);

          if (Array.isArray(response.data)) {
            const filteredData = response.data.filter(item => {
              console.log('Filtering item:', {
                id: item.id,
                isAddedBySupervisor: item.isAddedBySupervisor,
                addedBy: item.addedBy,
                addedByType: typeof item.addedBy,
                userId: supId,
                userIdType: typeof supId,
                match: item.isAddedBySupervisor === true && Number(item.addedBy) === Number(supId)
              });
              return item.isAddedBySupervisor === true && Number(item.addedBy) === Number(supId);
            });

            console.log('Filtered Data:', filteredData);

            // Transform API data to match our component structure
            const transformedExaminers = filteredData.map((examiner, index) => ({
              id: examiner.id,
              srNo: index + 1,
              examinerId: examiner.examinerId,
              name: examiner.examinerName,
              email: examiner.examinerEmail,
              phone: examiner.contactNo,
              address: examiner.address,
              state: examiner.state,
              institution: examiner.institution,
              designationId: examiner.designation,
              designation: examiner.designationName,
              supervisorName: examiner.supervisorName,
              adminName: examiner.adminName,
              status: examiner.status,
              sid: examiner.sid,
              // Additional fields for display
              university: examiner.institution,
              supervisor: examiner.supervisorName === 'Test1' ? 'Itself' : examiner.supervisorName,
              recommendedBy: examiner.adminName ||"",
              // Flag to indicate if this examiner is already forwarded (status === 1)
              isForwarded: examiner.status === 1
            }));

            console.log('Transformed Examiners:', transformedExaminers);
            setExaminers(transformedExaminers);
          } else {
            console.log('No data or data is not array');
            setExaminers([]);
          }
        } catch (err) {
          console.error('Error fetching examiners:', err);
          setExaminers([]);
        } finally {
          setLoading(false);
        }
      } else {
        console.log('Missing shodhanikId or user.id:', { shodhanikId, userId: supId });
        setLoading(false);
      }
    };

    fetchExaminers();
  }, [shodhanikId, supId, submissionData?.sid]); // Fixed dependency array with stable values

  const handleAddExaminer = () => {
    if (examiners.length >= 6) {
      notify.warning('Maximum 6 examiners can be added for thesis evaluation');
      return;
    }

    navigate('/supervisor-dashboard/addnewexaminer', {
      state: { submissionData }
    });
  };

  const handleEditExaminer = (examiner) => {
    navigate('/supervisor-dashboard/addnewexaminer', {
      state: {
        submissionData,
        editMode: true,
        examinerData: examiner
      }
    });
  };

  const handleForwardToDoR = async () => {
    // Get all examiners that are not yet forwarded
    const examinersToForward = examiners.filter(e => e.status !== 1);

    if (examinersToForward.length === 0) {
      notify.warning('All examiners have already been forwarded to DoR');
      return;
    }

    // Check exactly 6 examiners requirement
    if (examinersToForward.length !== 6) {
      notify.warning('Please add exactly 6 examiners before forwarding to DoR');
      return;
    }

    try {
      setForwarding(true);

      // Prepare the payload with all examiners to forward
      const payload = {
        vivaExaminerIds: examinersToForward.map(e => e.id),
        status: 1
      };

      console.log('Forwarding to DoR with payload:', payload);

      // Make PATCH API call
      const response = await API.patch('/Confidential/update-status', payload);

      if (response.data) {
        notify.success(`Successfully forwarded ${examinersToForward.length} examiner(s) to DoR`);

        // Refresh the examiner list
        const sid = submissionData?.sid || 1;
        const refreshResponse = await API.get(`/Confidential/${sid}`);

        if (refreshResponse.data && Array.isArray(refreshResponse.data)) {
          const filteredData = refreshResponse.data.filter(item =>
            item.isAddedBySupervisor === true && Number(item.addedBy) === Number(supId)
          );
          
          const transformedExaminers = filteredData.map((examiner, index) => ({
            id: examiner.id,
            srNo: index + 1,
            examinerId: examiner.examinerId,
            name: examiner.examinerName,
            email: examiner.examinerEmail,
            phone: examiner.contactNo,
            address: examiner.address,
            state: examiner.state,
            institution: examiner.institution,
            designation: examiner.designationName,
            supervisorName: examiner.supervisorName,
            adminName: examiner.adminName,
            status: examiner.status,
            sid: examiner.sid,
            // Additional fields for display
            university: examiner.institution,
            supervisor: examiner.supervisorName === 'Test1' ? 'Itself' : examiner.supervisorName,
            recommendedBy: examiner.adminName || 'Dean',
            // Flag to indicate if this examiner is already forwarded (status === 1)
            isForwarded: examiner.status === 1
          }));

          setExaminers(transformedExaminers);
        }
      }
    } catch (error) {
      console.error('Error forwarding to DoR:', error);
      notify.error('Failed to forward to DoR. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleBackToList = () => {
    navigate('/supervisor-dashboard/thesissubmittedlist');
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
          {record.status === 2 && (
            <div className="mt-1">
              <Tag color="red" className="text-xs">
                Request Rejected
              </Tag>
            </div>
          )}
          {record.status === 1 && (
            <div className="mt-1">
              <Tag color="blue" className="text-xs">
                Forwarded to DoR
              </Tag>
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
            <span className="font-medium">University / Institution:</span> {record.institution}
          </div>
          <div>
            <span className="font-medium">Address:</span> {record.address}
          </div>
          <div>
            <span className="font-medium">Email:</span>
            <span className="text-blue-600"> {record.email}</span>
            <span className="ml-4 font-medium">Phone:</span> {record.phone}
          </div>
          <div>
            <span className="font-medium">State:</span> {record.state}
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
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            onClick={() => handleEditExaminer(record)}
            disabled={record.status === 1}
            className={record.status === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 p-0'}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  if (!shodhanikId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No candidate selected</p>
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
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
              Examiner Recommendation for {shodhanikId} - {submissionData?.candidateName || 'CHIRANJI LAL'} - {submissionData?.department || 'Applied Physics'} / {submissionData?.subject || 'Physics'}
            </h1>
          </div>
        </div>
        <Button
          type="primary"
          onClick={handleAddExaminer}
          disabled={examiners.length >= 6}
          className={examiners.length >= 6 ? 'bg-gray-400 border-gray-400' : 'bg-blue-600 hover:bg-blue-700 border-blue-600'}
        >
          {examiners.length >= 6 ? 'Maximum 6 Examiners Reached' : 'Add New Examiner'}
        </Button>
      </div>

      {/* Examiners Table */}
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
      </div>



      {/* Action Buttons for Selected Examiners */}
      {examiners.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Forward Examiners to DoR
            </h3>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Total Examiners: {examiners.length}/6</span>
              {examiners.length < 6 && (
                <span className="ml-2 text-blue-600">({6 - examiners.length} more required)</span>
              )}
            </div>
          </div>

          {/* Validation Messages */}
          <div className="mb-4">
            {examiners.length < 6 && (
              <Alert
                message={`📋 Add ${6 - examiners.length} more examiner(s) to reach the required 6 examiners`}
                type="info"
                showIcon
                className="mb-2"
              />
            )}
            {examiners.length === 6 && examiners.filter(e => e.status !== 1).length === 6 && (
              <Alert
                message={`✅ All 6 examiners added - Ready to forward to DoR`}
                type="success"
                showIcon
                className="mb-2"
              />
            )}
            {examiners.filter(e => e.status === 1).length > 0 && (
              <Alert
                message={`✅ ${examiners.filter(e => e.status === 1).length} examiner(s) already forwarded to DoR`}
                type="success"
                showIcon
                className="mb-2"
              />
            )}
            {examiners.filter(e => e.status === 2).length > 0 && (
              <Alert
                message={`❌ ${examiners.filter(e => e.status === 2).length} examiner(s) rejected the request`}
                type="error"
                showIcon
                className="mb-2"
              />
            )}
          </div>

          <div className="flex gap-4">
            <Button
              type="primary"
              onClick={handleForwardToDoR}
              loading={forwarding}
              disabled={examiners.length !== 6 || examiners.filter(e => e.status !== 1).length === 0}
              className="bg-purple-600 hover:bg-purple-700 border-purple-600"
            >
              Forward All to DoR
            </Button>
          </div>
        </div>
      )}

      {examiners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Examiners Added
          </h3>
          <p className="text-gray-500 mb-2">
            Add examiners for this candidate's thesis evaluation.
          </p>
          <p className="text-sm text-blue-600 mb-4">
            📋 Requirement: Add exactly 6 examiners (all will be forwarded to DoR)
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

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Examiner;