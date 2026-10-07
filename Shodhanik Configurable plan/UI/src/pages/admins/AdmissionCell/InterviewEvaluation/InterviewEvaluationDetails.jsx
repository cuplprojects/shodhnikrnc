  import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import notification from '@/services/NotificationService';
import PrintHeader from '@/components/cms/PrintHeader';
import { fetchPhdApplicationDetails, updatePhdApplicationStatus } from '@/services/phdAdmissionService';

const InterviewEvaluationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applicationData, setApplicationData] = useState(null);
  
  // Evaluation modal state
  const [evaluationModalVisible, setEvaluationModalVisible] = useState(false);
  const [evaluationData, setEvaluationData] = useState({
    decision: null,
    remarks: ''
  });
  const [evaluationSubmitting, setEvaluationSubmitting] = useState(false);

  // Fetch application details
  useEffect(() => {
    const loadApplicationDetails = async () => {
      try {
        setLoading(true);
        const data = await fetchPhdApplicationDetails(id);
        console.log('Application details:', data);
        setApplicationData(data);
      } catch (error) {
        console.error('Error loading application details:', error);
        const notify = notification();
        notify.error('Failed to load application details');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadApplicationDetails();
    }
  }, [id]);

  // Handle evaluate button
  const handleEvaluate = () => {
    setEvaluationData({ decision: null, remarks: '' });
    setEvaluationModalVisible(true);
  };

  // Handle evaluation submission
  const handleEvaluationSubmit = async () => {
    try {
      if (!evaluationData.decision) {
        const notify = notification();
        notify.error('Please select a decision (Pass/Fail)');
        return;
      }

      // If failed, remarks are required
      if (evaluationData.decision === 'rejected' && !evaluationData.remarks.trim()) {
        const notify = notification();
        notify.error('Remarks are required when marking as Fail');
        return;
      }

      setEvaluationSubmitting(true);

      // Map decision to DecisionStatus
      const decisionStatusMap = {
        approved: 6,  // InterviewApproved
        rejected: 5   // InterviewRejected
      };

      const decisionStatus = decisionStatusMap[evaluationData.decision];
      const decisionLabel = evaluationData.decision === 'approved' ? 'Pass' : 'Fail';

      console.log('=== Interview Evaluation Submission ===');
      console.log('Scholar ID:', id);
      console.log('Decision:', evaluationData.decision);
      console.log('Decision Status:', decisionStatus);
      console.log('Remarks:', evaluationData.remarks);

      // Send PATCH request
      await updatePhdApplicationStatus(id, {
        DecisionStatus: decisionStatus,
        RejectReason: evaluationData.remarks || null
      });

      const notify = notification();
      notify.success(`Interview marked as ${decisionLabel}`);

      // Reset states
      setEvaluationModalVisible(false);
      setEvaluationData({ decision: null, remarks: '' });

      // Reload application data
      const data = await fetchPhdApplicationDetails(id);
      setApplicationData(data);

    } catch (error) {
      console.error('Error submitting evaluation:', error);
      const notify = notification();
      notify.error('Failed to submit evaluation');
    } finally {
      setEvaluationSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admission-cell/interview-evaluation')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Interview Evaluation</h1>
        </div>
        <Button
          variant="solid"
          label="Evaluate"
          onClick={handleEvaluate}
          module="phd_applications"
          action="update"
        />
      </div>

      {/* Printable Area */}
      <div id="printable-area" className="bg-white border border-gray-300 rounded-lg p-6 print:border-0 print:p-0">
        {/* Print Header */}
        <div className="hidden sm:flex justify-center mt-3 mb-6">
          <PrintHeader />
        </div>

        {/* Application Details */}
        {applicationData && (
          <div className="space-y-6">
            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Personal Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Scholar ID</label>
                  <p className="text-gray-900">{applicationData.scholarId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p className="text-gray-900">{applicationData.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-gray-900">{applicationData.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p className="text-gray-900">{applicationData.phoneNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Department</label>
                  <p className="text-gray-900">{applicationData.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Registration Type</label>
                  <p className="text-gray-900">{applicationData.regType}</p>
                </div>
              </div>
            </div>

            {/* Interview Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Interview Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Interview Date</label>
                  <p className="text-gray-900">
                    {applicationData.interviewDate 
                      ? new Date(applicationData.interviewDate).toLocaleDateString('en-IN')
                      : 'Not scheduled'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Interview Time</label>
                  <p className="text-gray-900">
                    {applicationData.interviewDate 
                      ? new Date(applicationData.interviewDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : 'Not scheduled'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Current Status</label>
                  <p className="text-gray-900">{applicationData.statusText || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Academic Details */}
            {applicationData.academicDetails && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Academic Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Graduation Year</label>
                    <p className="text-gray-900">{applicationData.academicDetails.graduationYear || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">CGPA</label>
                    <p className="text-gray-900">{applicationData.academicDetails.cgpa || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
              Decision
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setEvaluationData({ ...evaluationData, decision: 'approved' })}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                  evaluationData.decision === 'approved'
                    ? 'bg-green-600 text-white border-2 border-green-600'
                    : 'bg-green-100 text-green-700 border-2 border-green-300 hover:bg-green-200'
                }`}
              >
                Pass
              </button>
              <button
                onClick={() => setEvaluationData({ ...evaluationData, decision: 'rejected' })}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                  evaluationData.decision === 'rejected'
                    ? 'bg-red-600 text-white border-2 border-red-600'
                    : 'bg-red-100 text-red-700 border-2 border-red-300 hover:bg-red-200'
                }`}
              >
                Fail
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks {evaluationData.decision === 'rejected' && <span className="text-red-600">*</span>}
            </label>
            <textarea
              value={evaluationData.remarks}
              onChange={(e) => setEvaluationData({ ...evaluationData, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={4}
              placeholder="Enter remarks for this evaluation"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InterviewEvaluationDetails;
