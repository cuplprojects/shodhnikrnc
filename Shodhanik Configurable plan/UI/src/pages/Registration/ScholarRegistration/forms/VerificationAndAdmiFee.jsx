import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const VerificationAndAdmiFee = () => {
  const { getSId } = useScholarRegAuthStore();
  const { saveStep, getIsReadOnly } = useSteps();
  const navigate = useNavigate();
  const scholarId = getSId();
  const isReadOnly = getIsReadOnly ? getIsReadOnly(8) : false;

  // Auto-refresh steps from API on component load
  useStepRefresh();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [regTypeName, setRegTypeName] = useState('N/A');
  const [admissionFees, setAdmissionFees] = useState('N/A');
  const [paymentDataLoading, setPaymentDataLoading] = useState(true);

  // Fetch all uploaded documents with their verification status
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);

        // Fetch uploaded documents for this scholar
        const uploadsResponse = await API.get(`/ScholarUpload/GetBySID?sid=${scholarId}`);

        if (uploadsResponse.data && uploadsResponse.data.length > 0) {
          // Map uploaded documents with their verification status
          const documentsWithStatus = uploadsResponse.data.map((upload, index) => {
            // Determine decision status based on decisionStatus
            let decisionStatus = 'Under Review'; // Default for null or 0
            
            if (upload.decisionStatus === 1) {
              decisionStatus = 'Verified';
            } else if (upload.decisionStatus === 2) {
              decisionStatus = 'Rejected';
            }
            // For 0 or null, keep default 'Under Review'

            return {
              key: upload.scholarUploadID,
              srNo: index + 1,
              documentName: upload.documentName || "Unknown",
              decisionStatus: decisionStatus,
              upload: upload,
            };
          });

          setDocuments(documentsWithStatus);

          // Check if all documents are verified
          const allVerified = documentsWithStatus.every(doc => doc.decisionStatus === 'Verified');
          setShowPaymentSection(allVerified);
          // setShowPaymentSection(true);
        }

      } catch (error) {
        console.error('Error fetching documents:', error);
        const notify = notification();
        notify.error('Failed to load document verification status');
      } finally {
        setLoading(false);
      }
    };

    if (scholarId) {
      fetchDocuments();
    }
  }, [scholarId]);

  // Fetch payment data from API using dual endpoint strategy
  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        setPaymentDataLoading(true);

        // Fetch from both endpoints
        const previewResponse = await API.get(`/Scholars/PreviewAllDetails/${scholarId}`);
        const scholarResponse = await API.get(`/Scholars/${scholarId}`);

        if (previewResponse.data && scholarResponse.data) {
          // Merge data with scholar details taking precedence
          const mergedData = {
            ...previewResponse.data,
            scholar: {
              ...previewResponse.data.scholar,
              ...scholarResponse.data
            }
          };
          
          setPreviewData(mergedData);
          
          // Fetch registration type name if regType is available
          if (mergedData.scholar?.regType) {
            try {
              const regTypeResponse = await API.get(`/RegTypes/${mergedData.scholar.regType}`);
              if (regTypeResponse.data?.regTypeName) {
                setRegTypeName(regTypeResponse.data.regTypeName);
              }
            } catch (regTypeError) {
              console.error('Error fetching registration type:', regTypeError);
              setRegTypeName('Unknown');
            }
          }

          // Fetch admission fee from fee category
          if (mergedData.personalDetails?.category) {
            try {
              const feeCategoryResponse = await API.get(`/FeeCategory/GetByCategory/${mergedData.personalDetails.category}`);
              if (feeCategoryResponse.data?.admissionFee) {
                setAdmissionFees(feeCategoryResponse.data.admissionFee.toString());
              }
            } catch (feeError) {
              console.error('Error fetching admission fee:', feeError);
              setAdmissionFees('N/A');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching payment data:', err);
      } finally {
        setPaymentDataLoading(false);
      }
    };

    if (scholarId) {
      fetchPaymentData();
    }
  }, [scholarId]);

  // Real payment data from API
  const paymentData = {
    applicationId: previewData?.scholar?.applicationNo || 'N/A',
    applicantName: previewData?.scholar?.name || 'N/A',
    subject: previewData?.scholar?.subjectName || 'N/A',
    email: previewData?.scholar?.email || 'N/A',
    mobile: previewData?.scholar?.phoneNumber || 'N/A',
    registrationType: regTypeName,
    category: previewData?.personalDetails?.category || 'N/A',
    gender: previewData?.personalDetails?.gender || 'N/A',
    admissionFees: admissionFees || '₹25000',
    rmsOrderId: previewData?.scholar?.sid || 'N/A',
  };

  // Handle document view
  const handleView = (document) => {
    setViewingDocument(document);
    setViewModalVisible(true);
  };

  // Handle payment submission
  const handleSubmitPayment = () => {
    if (acceptTerms) {
      setShowConfirmation(true);
    }
  };

  // Handle confirm and pay
  const handleConfirmAndPay = async () => {
    const notify = notification();
    setIsSubmitting(true);
    try {
      console.log('Starting fee submission for scholar:', scholarId);
      
      // Save step 8 (Fee Submission)
      const step8Saved = await saveStep(8);
      console.log('Step 8 saved:', step8Saved);
      
      if (step8Saved) {
        // Update scholar decision status to 10
        try {
          console.log('Updating scholar decision status to 10');
          await API.patch(`/Scholars/${scholarId}`, {
            decisionStatus: 10
          });
          console.log('Scholar decision status updated to 10');
        } catch (patchError) {
          console.error('Error updating scholar decision status:', patchError);
          notify.warning('Fee submitted but status update failed. Please contact support.');
        }
        
        // Save step 9 (Admission Details)
        console.log('Saving step 9');
        const step9Saved = await saveStep(9);
        console.log('Step 9 saved:', step9Saved);
        
        if (step9Saved) {
          notify.success('Fee submitted successfully!');
          // Navigate to admission details page
          setTimeout(() => {
            navigate('/register-scholar/admission-details');
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error saving fee submission step:', error);
      notify.error('Error submitting fee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table columns
  // const columns = [
  //   {
  //     title: 'Sr. No.',
  //     dataIndex: 'srNo',
  //     key: 'srNo',
  //     width: 80,
  //     align: 'center',
  //   },
  //   {
  //     title: 'Document Name',
  //     dataIndex: 'documentName',
  //     key: 'documentName',
  //   },
  //   {
  //     title: 'Decision Status',
  //     dataIndex: 'decisionStatus',
  //     key: 'decisionStatus',
  //     width: 120,
  //     align: 'center',
  //     render: (decisionStatus) => (
  //       <span className={`px-2 py-1 rounded text-xs font-medium ${decisionStatus === 'Verified'
  //         ? 'bg-green-100 text-green-800'
  //         : decisionStatus === 'Under Review'
  //           ? 'bg-blue-100 text-blue-800'
  //           : 'bg-red-100 text-red-800'
  //         }`}>
  //         {decisionStatus}
  //       </span>
  //     ),
  //   },
  //   // {
  //   //   title: 'Remarks',
  //   //   dataIndex: 'remarks',
  //   //   key: 'remarks',
  //   //   width: 150,
  //   // },
  //   {
  //     title: 'View',
  //     key: 'view',
  //     width: 80,
  //     align: 'center',
  //     render: (_, record) => (
  //       <Button
  //         type="link"
  //         icon={<EyeOutlined />}
  //         onClick={() => handleView(record)}
  //         className="text-blue-600"
  //       >
  //         View
  //       </Button>
  //     ),
  //   },
  // ];

  // If confirmation screen should be shown
  //<--- added ! in showConfirmation to directly show the payment page 
  if (!showConfirmation) {
    return (
      <div className="p-4 md:p-5">
        <div className="bg-white">
          {/* Confirmation Header */}
          <div className="mb-6 pb-3 border-b-2 border-[#1e40af]">
            <h2 className="text-2xl font-bold text-[#1e40af] font-inter">Fee Submission</h2>
          </div>

          {/* Confirmation Details */}
          <div className="space-y-4 mb-8">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Application ID :</span>
              <span className="text-base text-[#6b7280]">{paymentData.applicationId}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Applicant's Name :</span>
              <span className="text-base text-[#6b7280]">{paymentData.applicantName}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Category :</span>
              <span className="text-base text-[#6b7280]">{paymentData.category}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Department/Subject :</span>
              <span className="text-base text-[#6b7280]">{paymentData.subject}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Mobile No. :</span>
              <span className="text-base text-[#6b7280]">{paymentData.mobile}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Email ID :</span>
              <span className="text-base text-[#6b7280]">{paymentData.email}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Shodhanik Order ID :</span>
              <span className="text-base text-[#6b7280]">{paymentData.rmsOrderId}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Admission Fee Amount :</span>
              <span className="text-2xl font-bold text-[#6b7280]">₹{paymentData.admissionFees}</span>
            </div>
          </div>

          {/* Confirm & Pay Button */}
          <div className="flex justify-end">
            <button
              onClick={handleConfirmAndPay}
              disabled={isReadOnly || isSubmitting}
              className="bg-[#1e40af] text-white py-3 px-10 rounded-md font-semibold font-inter text-base transition-all duration-200 hover:bg-[#1e3a8a] active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : isReadOnly ? 'Read Only' : 'Submit Fee'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // return (
  //   <div className="p-4 md:p-5">
  //     <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
  //       {/* Header */}
  //       <div className="flex items-center gap-2 mb-6">
  //         <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
  //           <FileText className="text-blue-600" />
  //         </div>
  //         <h2 className="text-xl font-bold text-[#111827] font-inter">
  //           Document Verification Status
  //         </h2>
  //       </div>

  //       {/* Documents Table */}
  //       <div className="mb-6">
  //         <Table
  //           columns={columns}
  //           dataSource={documents}
  //           loading={loading}
  //           pagination={false}
  //           bordered
  //           size="middle"
  //           className="ant-table-striped"
  //           locale={{
  //             emptyText: 'No documents found'
  //           }}
  //         />
  //       </div>

  //       {/* Decision Status Summary */}
  //       {documents.length > 0 && (
  //         <div className="mb-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
  //           <h4 className="text-sm font-semibold text-blue-900 mb-1">Decision Status Summary</h4>
  //           <div className="grid grid-cols-3 gap-4 text-center">
  //             <div>
  //               <div className="text-2xl font-bold text-green-600">
  //                 {documents.filter(doc => doc.decisionStatus === 'Verified').length}
  //               </div>
  //               <div className="text-xs text-green-700">Verified</div>
  //             </div>
  //             <div>
  //               <div className="text-2xl font-bold text-blue-600">
  //                 {documents.filter(doc => doc.decisionStatus === 'Under Review').length}
  //               </div>
  //               <div className="text-xs text-blue-700">Under Review</div>
  //             </div>
  //             <div>
  //               <div className="text-2xl font-bold text-red-600">
  //                 {documents.filter(doc => doc.decisionStatus === 'Rejected').length}
  //               </div>
  //               <div className="text-xs text-red-700">Rejected</div>
  //             </div>
  //           </div>
  //         </div>
  //       )}

  //       {/* Payment Section - Only show when all documents are verified */}
  //       {showPaymentSection && (
  //         <div className="border-t border-[#e5e7eb] pt-6">
  //           {/* Success Message */}
  //           <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
  //             <div className="flex items-center gap-2">
  //               <CheckCircle className="text-green-600" size={20} />
  //               <p className="text-green-800 font-medium">
  //                 All documents have been verified successfully!
  //               </p>
  //             </div>
  //             <p className="text-green-700 text-sm mt-1">
  //               You can now proceed with the admission fee payment.
  //             </p>
  //           </div>

  //           {/* Payment Header */}
  //           <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-[#1e40af]">
  //             <CreditCard size={24} className="text-[#1e40af]" />
  //             <h2 className="text-xl font-bold text-[#1e40af] font-inter">Admission Fee Payment</h2>
  //           </div>

  //           {/* Payment Details */}
  //           <div className="space-y-3 mb-6">
  //             <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
  //               <span className="text-sm font-medium text-[#92400e]">Application ID</span>
  //               <span className="text-sm text-[#6b7280]">:</span>
  //               <span className="text-sm text-[#6b7280]">{paymentData.applicationId}</span>
  //             </div>

  //             <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
  //               <span className="text-sm font-medium text-[#92400e]">Applicant's Name</span>
  //               <span className="text-sm text-[#6b7280]">:</span>
  //               <span className="text-sm text-[#6b7280]">{paymentData.applicantName}</span>
  //             </div>

  //             <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
  //               <span className="text-sm font-medium text-[#92400e]">Subject</span>
  //               <span className="text-sm text-[#6b7280]">:</span>
  //               <span className="text-sm text-[#6b7280]">{paymentData.subject}</span>
  //             </div>

  //             <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
  //               <span className="text-sm font-medium text-[#92400e]">Category</span>
  //               <span className="text-sm text-[#6b7280]">:</span>
  //               <span className="text-sm text-[#6b7280]">{paymentData.category}</span>
  //             </div>

  //             <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
  //               <span className="text-sm font-medium text-[#92400e]">Admission Fees</span>
  //               <span className="text-sm text-[#6b7280]">:</span>
  //               <span className="text-2xl font-bold text-green-600">₹{paymentData.admissionFees}</span>
  //             </div>
  //           </div>

  //           {/* Terms and Conditions */}
  //           <div className="mb-6">
  //             <h3 className="text-sm font-bold text-red-600 mb-2">TERMS AND CONDITIONS FOR ONLINE PAYMENTS</h3>
  //             <p className="text-xs text-red-600 mb-4 leading-relaxed">
  //               Payment(s) through this Service may only be made with a Credit Card, Debit card or Net Banking. The service is provided using a payment gateway service provider through a secure website. However, neither the payment gateway service provider nor the CCSU gives any assurance, that the information so provided online by a user is secured or may be read or intercepted by a third party. Fees once paid will not be refunded under any circumstances.
  //             </p>

  //             <div className="flex items-start gap-2">
  //               <input
  //                 type="checkbox"
  //                 checked={acceptTerms || isReadOnly}
  //                 onChange={(e) => setAcceptTerms(e.target.checked)}
  //                 className="w-4 h-4 mt-0.5 text-[#1e40af] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af]"
  //                 disabled={isReadOnly}
  //                 required
  //               />
  //               <label className="text-sm text-[#6b7280] font-inter">
  //                 I hereby confirm that I have read this document and agree to the conditions listed thereof.
  //               </label>
  //             </div>
  //           </div>

  //           {/* Submit Button */}
  //           <div className="flex justify-end">
  //             <button
  //               onClick={handleSubmitPayment}
  //               disabled={isReadOnly || !acceptTerms}
  //               className="bg-[#1e40af] text-white py-2.5 px-8 rounded-md font-semibold font-inter text-sm transition-all duration-200 hover:bg-[#1e3a8a] active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
  //             >
  //               {isReadOnly ? 'Read Only' : 'Proceed to Payment'}
  //             </button>
  //           </div>
  //         </div>
  //       )}

  //       {/* Waiting Message - Show when not all documents are verified */}
  //       {!showPaymentSection && documents.length > 0 && (
  //         <div className="border-t border-[#e5e7eb] pt-6">
  //           <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
  //             <p className="text-yellow-800 font-medium mb-2">
  //               Document Review in Progress
  //             </p>
  //             <p className="text-yellow-700 text-sm">
  //               Please wait for all documents to be verified before proceeding with admission fee payment.
  //             </p>
  //           </div>
  //         </div>
  //       )}
  //     </div>

  //     {/* View Document Modal */}
  //     <Modal
  //       title="View Document"
  //       open={viewModalVisible}
  //       onCancel={() => {
  //         setViewModalVisible(false);
  //         setViewingDocument(null);
  //       }}
  //       footer={[
  //         <Button
  //           key="close"
  //           onClick={() => {
  //             setViewModalVisible(false);
  //             setViewingDocument(null);
  //           }}
  //         >
  //           Close
  //         </Button>,
  //         <Button
  //           key="download"
  //           type="primary"
  //           onClick={() => {
  //             if (viewingDocument) {
  //               const baseURL = getBaseFileURL();
  //               const fileUrl = `${baseURL}/${viewingDocument.upload.path}`;
  //               window.open(fileUrl, '_blank');
  //             }
  //           }}
  //           className="bg-blue-600 hover:bg-blue-700"
  //         >
  //           Open in New Tab
  //         </Button>,
  //       ]}
  //       width={800}
  //       style={{ top: 20 }}
  //     >
  //       {viewingDocument && (
  //         <div className="space-y-4">
  //           <div>
  //             <h4 className="text-sm font-semibold text-[#374151] mb-2">
  //               Document: {viewingDocument.documentName}
  //             </h4>
  //             <p className="text-sm text-gray-600 mb-2">
  //               Decision Status: <span className={`font-medium ${viewingDocument.decisionStatus === 'Verified'
  //                 ? 'text-green-600'
  //                 : viewingDocument.decisionStatus === 'Under Review'
  //                   ? 'text-blue-600'
  //                   : 'text-red-600'
  //                 }`}>
  //                 {viewingDocument.decisionStatus}
  //               </span>
  //             </p>
  //           </div>

  //           <div className="border border-gray-200 rounded-lg overflow-hidden">
  //             <iframe
  //               src={`${getBaseFileURL()}/${viewingDocument.upload.path}`}
  //               width="100%"
  //               height="600px"
  //               title="Document Preview"
  //               className="border-0"
  //             />
  //           </div>
  //         </div>
  //       )}
  //     </Modal>
  //   </div>
  // );
};

export default VerificationAndAdmiFee;