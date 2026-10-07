import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Plus } from 'lucide-react';
import { Table, Button, Tag, Spin, Modal, Input } from 'antd';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { getBaseURL } from '@/utils/getBaseURL';
import useStaffAuthStore from '@/store/staffAuthStore';

const { TextArea } = Input;

const ViewExaminers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStaffAuthStore();
  const notify = notification();
  const baseUrl = getBaseURL();
  const isDevEnv = import.meta.env.VITE_APP_STAGE === 'development' || import.meta.env.VITE_APP_STAGE === 'livetest'
  // Get submission data from location state
  const submissionData = location.state?.submissionData;

  const [examiners, setExaminers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [candidateInfo, setCandidateInfo] = useState(null);
  const baseFileURL = getBaseFileURL();
  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingExaminerId, setRejectingExaminerId] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectingFinal, setSelectingFinal] = useState(false);
  const [sendingRequestId, setSendingRequestId] = useState(null);
  console.log(user?.id)
  useEffect(() => {
    const fetchExaminers = async () => {
      if (submissionData?.sid && user?.id) {
        try {
          setLoading(true);
          console.log('VC Office - Submission Data:', submissionData);
          console.log('VC Office - User ID:', user?.id);
          
          const sid = submissionData.sid;
          const response = await API.get(`/Confidential/${sid}`);

          console.log('VC Office - API Response:', response.data);

          if (response.data && Array.isArray(response.data)) {
            const filteredData = response.data.filter(item => {
              console.log('VC Office - Filtering item:', {
                id: item.id,
                isAddedBySupervisor: item.isAddedBySupervisor,
                addedBy: item.addedBy,
                addedByType: typeof item.addedBy,
                userId: user?.id,
                userIdType: typeof user?.id,
                status: item.status,
                matchAdmin: item.isAddedBySupervisor === false && Number(item.addedBy) === Number(user?.id),
                matchStatus: item.status >= 2
              });
              return item.status >= 2 || (item.isAddedBySupervisor === false && Number(item.addedBy) === Number(user?.id));
            });

            console.log('VC Office - Filtered Data:', filteredData);
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
            remarks: examiner.remarks || '', // Remarks from API
            examiner1Remarks: examiner.examiner1Remarks || '', // Examiner1 remarks from API
            reportStatus: null,
            status: examiner.status, // Raw status value
            examiner1Status: Number(examiner.examiner1Report) || 0, // Examiner1 status (0=Pending, 1=Approved, 2=Revision)
            uploadReport: examiner.uploadReport, // Report file path
            requestStatus: examiner.status === 0 ? 'Pending' : examiner.status === 1 ? 'Approved' : 'Rejected',
            examinerStatus: examiner.examinerStatus === 0 ? 'Pending' : examiner.examinerStatus === 1 ? 'Approved' : examiner.examinerStatus === 2 ? 'Rejected' : 'Unknown',
            recommendedBy: examiner.adminName,
            selected: false
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
          console.log('VC Office - No data or data is not array');
          setExaminers([]);
        }
      } catch (error) {
        console.error('VC Office - Error fetching examiners:', error);
        notify.error('Failed to fetch examiners data');
        setExaminers([]);
      } finally {
        setLoading(false);
      }
    } else {
      console.log('VC Office - Missing sid or user.id:', { sid: submissionData?.sid, userId: user?.id });
      setLoading(false);
    }
  };

  fetchExaminers();
}, [submissionData?.sid, user?.id]);

  const handleAddExaminer = () => {
    navigate('/vc_office/add-examiner', {
      state: { submissionData }
    });
  };

  const handleBackToList = () => {
    navigate('/vc_office/thesis');
  };

  const handleSendRequestForEvaluation = async (examinerId) => {
    try {
      setSendingRequestId(examinerId);
      const payload = {
        vivaExaminerIds: [examinerId], // Send only the clicked examiner's ID
        status: 3,
        consentBaseUrl:isDevEnv? `${baseUrl}/#/thesisevaluationconsent` : `${baseUrl}/thesisevaluationconsent`,
        summaryBaseUrl:isDevEnv? `${baseUrl}/#/thesissummary` : `${baseUrl}/thesissummary`,
      };

      const response = await API.patch('/Confidential/update-status', payload);

      if (response.status === 200) {
        notify.success('Request for evaluation sent successfully');

        // Update the local state to reflect the change
        // Keep examinerStatus as 'Pending' until examiner accepts consent
        setExaminers(prev =>
          prev.map(examiner =>
            examiner.id === examinerId
              ? { ...examiner, status: 3, examinerStatus: 'Pending' }
              : examiner
          )
        );
      }
    } catch (error) {
      console.error('Error sending request for evaluation:', error);
      notify.error('Failed to send request for evaluation');
    } finally {
      setSendingRequestId(null);
    }
  };

  // Handle reject examiner - opens modal for remarks
  const handleRejectExaminer = (examinerId) => {
    setRejectingExaminerId(examinerId);
    setRejectRemarks('');
    setRejectModalVisible(true);
  };

  // Submit rejection with remarks
  const handleConfirmReject = async () => {
    if (!rejectRemarks.trim()) {
      notify.error('Please enter remarks for rejection');
      return;
    }

    setIsRejecting(true);
    try {
      const payload = {
        vivaExaminerIds: [rejectingExaminerId],
        status: 4,
        remarks: rejectRemarks.trim()
      };

      const response = await API.patch('/Confidential/update-status', payload);

      if (response.status === 200) {
        notify.success('Examiner rejected successfully');

        // Update the local state to reflect the change
        setExaminers(prev =>
          prev.map(examiner =>
            examiner.id === rejectingExaminerId
              ? { ...examiner, status: 4, requestStatus: 'Rejected', remarks: rejectRemarks.trim() }
              : examiner
          )
        );

        // Close modal and reset state
        setRejectModalVisible(false);
        setRejectingExaminerId(null);
        setRejectRemarks('');
      }
    } catch (error) {
      console.error('Error rejecting examiner:', error);
      notify.error('Failed to reject examiner');
    } finally {
      setIsRejecting(false);
    }
  };

  // Cancel rejection
  const handleCancelReject = () => {
    setRejectModalVisible(false);
    setRejectingExaminerId(null);
    setRejectRemarks('');
  };

  // Handle select final examiner
  const handleSelectFinalExaminer = async (examinerId) => {
    setSelectingFinal(true);
    try {
      const response = await API.patch(`/Confidential/final-selection/${examinerId}`, {
        status: 2
      });

      if (response.status === 200) {
        notify.success('Examiner selected as Final Examiner successfully');

        // Update the local state to reflect the change
        setExaminers(prev =>
          prev.map(examiner =>
            examiner.id === examinerId
              ? { ...examiner, status: 5, isFinalExaminer: true }
              : examiner
          )
        );
      }
    } catch (error) {
      console.error('Error selecting final examiner:', error);
      notify.error('Failed to select final examiner');
    } finally {
      setSelectingFinal(false);
    }
  };

  // Check if any examiner is already selected as final
  const hasFinalExaminerSelected = () => {
    return examiners.some(examiner => examiner.status === 5 || examiner.isFinalExaminer);
  };

  // Helper function to count examiners with submitted reports (View Report showing)
  const getReportSubmittedCount = () => {
    return examiners.filter(examiner => examiner.status === 3 && examiner.uploadReport?.trim()).length;
  };

  // Helper function to count pending evaluation requests
  const getPendingEvaluationCount = () => {
    return examiners.filter(examiner => examiner.examinerStatus === 'Pending').length;
  };

  // Helper function to check if exactly 18 examiners are present
  const hasExactly18Examiners = () => {
    return examiners.length === 18;
  };

  // Helper function to count examiners by state
  const getExaminersByState = () => {
    const stateCount = {};
    examiners.forEach(examiner => {
      const state = examiner.state || 'Unknown';
      stateCount[state] = (stateCount[state] || 0) + 1;
    });
    return stateCount;
  };

  // Helper function to count examiners with status 3 (request sent) by state
  const getRequestSentByState = () => {
    const stateCount = {};
    examiners.forEach(examiner => {
      if (examiner.status === 3) {
        const state = examiner.state || 'Unknown';
        stateCount[state] = (stateCount[state] || 0) + 1;
      }
    });
    return stateCount;
  };

  // Helper function to check if an examiner can send request
  const canSendRequest = (examiner) => {
    // Must have exactly 18 examiners
    if (!hasExactly18Examiners()) {
      return false;
    }

    // Check if this examiner already sent request (status === 3)
    if (examiner.status === 3) {
      return false;
    }

    // Check if another examiner from same state already sent request
    const requestSentByState = getRequestSentByState();
    const state = examiner.state || 'Unknown';
    
    // If a request has already been sent from this state, disable button
    if (requestSentByState[state] && requestSentByState[state] > 0) {
      return false;
    }

    // Allow sending only if no request has been sent from this state yet
    return true;
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
            <div className="break-words whitespace-normal">
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
      title: "Status",
      key: "status",
      width: 120,
      align: "center",
      render: (_, record) => (
        <>
          {/* examinerStatus = 2 → Examiner Rejected */}
          {record.examinerStatus === 'Rejected' && (
            <Tag color="red" className="text-xs">
              ✗ Examiner Rejected
            </Tag>
          )}

          {/* Status = 4 → Rejected */}
          {/* Status = 3 → Show Reject button */}
          {record.status === 3 &&
            record.examinerStatus !== 'Approved' &&
            record.examinerStatus !== 'Rejected' &&
            (
              <>
                <Tag color="green" className="text-xs">
                  Request Sent to Examiner
                </Tag>
                <Button
                  type="primary"
                  danger
                  size="small"
                  onClick={() => handleRejectExaminer(record.id)}
                  className="text-xs mt-3"
                >
                  Cancel Request
                </Button>

              </>
            )}

          {/* Status = 3 & Examiner Approved - Show report */}
          {record.status === 3 && record.examinerStatus === 'Approved' &&  (
            <div className="flex flex-col items-center gap-2">
              <Tag color="green" className="text-xs">
                ✓ Consent Accepted
              </Tag>
              {record.uploadReport && (
                <a
                  href={`${baseFileURL}/${record.uploadReport}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-xs"
                >
                  View Report
                </a>
              )}
              {record.examiner1Remarks && (
                <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border border-gray-200 max-w-xs break-words whitespace-normal">
                  <span className="font-medium">Remarks:</span> {record.examiner1Remarks}
                </div>
              )}
              {!hasFinalExaminerSelected() && getReportSubmittedCount() >= 3 && (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleSelectFinalExaminer(record.id)}
                  loading={selectingFinal}
                  className="bg-purple-600 hover:bg-purple-700 border-purple-600 text-xs mt-1"
                >
                  Select Final Examiner
                </Button>
              )}
            </div>
          )}

          {/* Status = 5 - Final Examiner Selected */}
          {(record.status === 5 || record.isFinalExaminer) && record.examinerStatus !== 'Rejected' && (
            <div className="flex flex-col items-center gap-2">
              <Tag color="purple" className="text-xs font-semibold">
                ★ Final Examiner
              </Tag>
              {record.uploadReport && (
                <a
                  href={`${baseFileURL}/${record.uploadReport}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-xs"
                >
                  View Report
                </a>
              )}
            </div>
          )}

          {/* Status = 3 & Examiner Revision */}
          {record.status === 3 && Number(record.examiner1Status) === 2 && record.examinerStatus !== 'Rejected' && (
            <div className="flex flex-col items-center gap-2">
              <Tag color="orange" className="text-xs">
                ⟳ Revision
              </Tag>
              {record.examiner1Remarks && (
                <div className="text-xs text-gray-600 mt-2 p-2 bg-yellow-50 rounded border border-yellow-200 max-w-xs break-words whitespace-normal">
                  <span className="font-medium">Remarks:</span> {record.examiner1Remarks}
                </div>
              )}
            </div>
          )}

          {/* Other statuses */}
          {record.status == 2 && record.examinerStatus !== 'Rejected' &&
            (
              <Button
                type="primary"
                size="small"
                onClick={() => handleSendRequestForEvaluation(record.id)}
                disabled={!canSendRequest(record)}
                loading={sendingRequestId === record.id}
                title={!hasExactly18Examiners() ? `Need exactly 18 examiners (currently ${examiners.length})` : getRequestSentByState()[record.state] > 0 ? `Already sent request from ${record.state}` : ''}
                className={!canSendRequest(record) ? 'bg-gray-400 border-gray-400 text-xs' : 'bg-green-600 hover:bg-green-700 border-green-600 text-xs'}
              >
                Send Request
              </Button>
            )}

          {record.status == 4 && record.examinerStatus !== 'Rejected' && (
            <>
              <Tag color="red" className="text-xs">
                ✗ Request Cancelled
              </Tag>

            </>
          )}
        </>
      ),
    }

  ];


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
              VC Office - Examiner Recommendation for {candidateInfo?.permUserName} - {candidateInfo?.name} - {candidateInfo?.subjectName}
            </h1>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleAddExaminer}
            className="bg-blue-600 hover:bg-blue-700 border-blue-600"
          >
            Add New Examiner
          </Button>
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
            scroll={{ x: false }}
          />

          {/* Summary Section */}
          <div className="p-4 bg-gray-50 border-t border-gray-300">
            <div className="flex flex-col gap-3">
              <div className="text-sm text-gray-600">
                <span>Total Examiners: <span className="font-medium">{examiners.length}/18</span></span>
                {examiners.length < 18 && (
                  <span className="ml-4 text-blue-600">({18 - examiners.length} more required)</span>
                )}
              </div>
              
              {/* State-wise breakdown */}
              {examiners.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Examiners by State:</span>
                  <div className="mt-2 grid grid-cols-3 gap-4">
                    {Object.entries(getExaminersByState()).map(([state, count]) => (
                      <div key={state} className="text-xs">
                        <span className="font-medium">{state}:</span> {count} examiner(s)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation message */}
              {examiners.length < 18 && (
                <div className="text-xs text-amber-600 font-medium">
                  ⚠ Add {18 - examiners.length} more examiner(s) to enable "Send Request" button
                </div>
              )}
              {examiners.length === 18 && (
                <div className="text-xs text-green-600 font-medium">
                  ✓ All 18 examiners added - Ready to send requests (max 1 per state)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && examiners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Examiners Found
          </h3>
          <p className="text-gray-500 mb-4">
            No examiner recommendations have been forwarded to VC Office yet.
          </p>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleAddExaminer}
            className="bg-blue-600 hover:bg-blue-700 border-blue-600"
          >
            Add New Examiner
          </Button>
        </div>
      )}

      {/* Reject Remarks Modal */}
      <Modal
        title="Reject Examiner"
        open={rejectModalVisible}
        onOk={handleConfirmReject}
        onCancel={handleCancelReject}
        confirmLoading={isRejecting}
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !rejectRemarks.trim() }}
        cancelText="Cancel"
      >
        <div className="py-4">
          <p className="text-gray-600 mb-4">
            Please provide a reason for rejecting this examiner. This remark will be recorded.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks <span className="text-red-500">*</span>
            </label>
            <TextArea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={4}
              maxLength={500}
              showCount
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ViewExaminers;