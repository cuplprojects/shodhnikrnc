import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Modal, Table } from 'antd';
import { ArrowLeft, Check, X, Eye } from 'lucide-react';
import Button from '@/components/ui/Button';
import notification from '@/services/NotificationService';
import { fetchPhdApplicationDetails, getScholarDocuments, updateDocumentVerificationStatus, updatePhdApplicationStatus } from '@/services/phdAdmissionService';
import { getBaseServerURL } from '@/utils/getBaseApiURL';

const DocumentVerificationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applicationData, setApplicationData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Confirmation modal state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState({
    action: null, // 'approve' or 'reject'
    documentIndex: null,
    remarks: ''
  });
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // Fetch application details and documents
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const appData = await fetchPhdApplicationDetails(id);
        console.log('Application details:', appData);
        setApplicationData(appData);

        // Get documents from the API
        const docs = await getScholarDocuments(id);
        console.log('Scholar documents:', docs);
        setDocuments(docs);
      } catch (error) {
        console.error('Error loading data:', error);
        const notify = notification();
        notify.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // Handle quick approve/reject from table
  const handleQuickApprove = (index) => {
    setConfirmData({
      action: 'approve',
      documentIndex: index,
      remarks: ''
    });
    setConfirmModalVisible(true);
  };

  const handleQuickReject = (index) => {
    setConfirmData({
      action: 'reject',
      documentIndex: index,
      remarks: ''
    });
    setConfirmModalVisible(true);
  };

  // Handle confirmation submission
  const handleConfirmSubmit = async () => {
    try {
      if (confirmData.action === 'reject' && !confirmData.remarks.trim()) {
        const notify = notification();
        notify.error('Remarks are required when rejecting a document');
        return;
      }

      setConfirmSubmitting(true);

      const doc = documents[confirmData.documentIndex];
      const isApprove = confirmData.action === 'approve';
      const decisionStatus = isApprove ? 1 : 2; // 1=Accepted, 2=Rejected
      const actionLabel = isApprove ? 'Approved' : 'Rejected';

      console.log('=== Document Verification Submission ===');
      console.log('Scholar Upload ID:', doc.scholarUploadID);
      console.log('Document:', doc.documentName);
      console.log('Action:', confirmData.action);
      console.log('Decision Status:', decisionStatus);
      console.log('Remarks:', confirmData.remarks);

      // Call API to update document verification status
      await updateDocumentVerificationStatus(
        doc.scholarUploadID,
        decisionStatus,
        confirmData.remarks
      );

      // Update the document status in local state
      const updatedDocs = [...documents];
      updatedDocs[confirmData.documentIndex].decisionStatus = decisionStatus;
      setDocuments(updatedDocs);

      const notify = notification();
      notify.success(`Document ${actionLabel}`);

      // Reset states
      setConfirmModalVisible(false);
      setConfirmData({ action: null, documentIndex: null, remarks: '' });

    } catch (error) {
      console.error('Error submitting verification:', error);
      const notify = notification();
      notify.error('Failed to submit verification');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  // Check if all documents are verified and accepted
  const allDocumentsVerified = documents.length > 0 && documents.every(doc => doc.decisionStatus === 1);
  
  // Check if any document is rejected
  const hasRejectedDocument = documents.some(doc => doc.decisionStatus === 2);

  // Handle submit button click - update PhD application status to 10
  const handleSubmitVerification = async () => {
    try {
      setSubmitLoading(true);
      
      console.log('=== Submitting Document Verification ===');
      console.log('Scholar ID (SID):', id);
      console.log('Decision Status: 10 (Counselling Approved Final)');
      
      // Update PhD application status to 10 (Counselling Approved Final)
      await updatePhdApplicationStatus(id, {
        DecisionStatus: 10
      });
      
      const notify = notification();
      notify.success('Document verification completed and application status updated');
      
    } catch (error) {
      console.error('Error submitting verification:', error);
      const notify = notification();
      notify.error('Failed to submit verification');
    } finally {
      setSubmitLoading(false);
    }
  };
  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Document Name',
      dataIndex: 'documentName',
      key: 'documentName',
      width: 200,
      render: (text, record) => {
        const baseServerURL = getBaseServerURL();
        const fileURL = `${baseServerURL}/${record.path}`;
        return (
          <a
            href={fileURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-bold"
          >
            {text}
          </a>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'decisionStatus',
      key: 'decisionStatus',
      width: 120,
      render: (status) => {
        if (status === 1) {
          return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Accepted</span>;
        } else if (status === 2) {
          return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Rejected</span>;
        } else {
          return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pending</span>;
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_, record, index) => {
        const baseServerURL = getBaseServerURL();
        const fileURL = `${baseServerURL}/${record.path}`;
        const isVerified = record.decisionStatus === 1 || record.decisionStatus === 2;
        
        return (
        <div className="flex gap-2">
          <Button
            variant="solid"
            label="View"
            onClick={() => window.open(fileURL, '_blank')}
            module="phd_applications"
            action="read"
            size="small"
            icon={<Eye size={14} />}
            className="!px-3 !py-1 !text-xs !bg-blue-200 !text-blue-800 hover:!bg-blue-200"
          />
          {!isVerified && (
            <>
              <Button
                variant="solid"
                label="Approve"
                onClick={() => handleQuickApprove(index)}
                module="phd_applications"
                action="update"
                size="small"
                icon={<Check size={14} />}
                className="!px-3 !py-1 !text-xs !bg-green-200 !text-green-800 hover:!bg-green-200 !border !border-green-600"
              />
              <Button
                variant="solid"
                label="Reject"
                onClick={() => handleQuickReject(index)}
                module="phd_applications"
                action="delete"
                size="small"
                icon={<X size={14} />}
                className="!px-3 !py-1 !text-xs !bg-red-200 !text-red-800 hover:!bg-red-200"
              />
            </>
          )}
        </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admission-cell/document-verification')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Document Verification</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* Documents Table */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Documents ({documents.length})</h2>
        </div>
        <Table
          columns={columns}
          dataSource={documents.map((doc, idx) => ({ ...doc, key: idx }))}
          pagination={false}
          scroll={{ x: 800 }}
          bordered
          size="small"
        />
        
        {/* Status Summary and Submit Button */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Verification Status:</span>
                {allDocumentsVerified && !hasRejectedDocument ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ All Documents Accepted
                  </span>
                ) : hasRejectedDocument ? (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                    ✗ Some Documents Rejected
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    ⏳ Verification Pending
                  </span>
                )}
              </div>
            </div>
            
            {allDocumentsVerified && !hasRejectedDocument && (
              <Button
                variant="solid"
                label="Submit Verification"
                onClick={handleSubmitVerification}
                loading={submitLoading}
                module="phd_applications"
                action="update"
                className="!bg-green-600 hover:!bg-green-700 !text-white !border-0"
              />
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        title={confirmData.action === 'approve' ? 'Approve Document' : 'Reject Document'}
        open={confirmModalVisible}
        onOk={handleConfirmSubmit}
        onCancel={() => setConfirmModalVisible(false)}
        confirmLoading={confirmSubmitting}
        width={500}
        okText={confirmData.action === 'approve' ? 'Approve' : 'Reject'}
        okButtonProps={{
          className: confirmData.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
        }}
      >
        <div className="space-y-4">
          {/* Document Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Document Details</h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-600">Document Name</label>
                <p className="text-gray-900">{documents[confirmData.documentIndex]?.documentName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Scholar</label>
                <p className="text-gray-900">{applicationData?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Scholar ID</label>
                <p className="text-gray-900">{applicationData?.scholarId}</p>
              </div>
            </div>
          </div>

          {/* Action Confirmation */}
          <div className={`p-4 rounded-lg ${confirmData.action === 'approve' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-medium ${confirmData.action === 'approve' ? 'text-green-800' : 'text-red-800'}`}>
              {confirmData.action === 'approve' 
                ? '✓ You are about to APPROVE this document' 
                : '✗ You are about to REJECT this document'}
            </p>
          </div>

          {/* Remarks (required for reject) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks {confirmData.action === 'reject' && <span className="text-red-600">*</span>}
            </label>
            <textarea
              value={confirmData.remarks}
              onChange={(e) => setConfirmData({ ...confirmData, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder={confirmData.action === 'reject' ? 'Enter reason for rejection' : 'Enter any additional remarks (optional)'}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentVerificationDetails;
