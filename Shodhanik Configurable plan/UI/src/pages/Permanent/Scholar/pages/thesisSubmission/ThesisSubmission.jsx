import { useState, useEffect } from 'react';
import { Button, Alert, Input, Modal, Radio, message, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, CreditCardOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import { getIP } from '@/utils/ipTracker';
import notification from '@/services/NotificationService';
import PrintHeader from '@/components/cms/PrintHeader';

const { TextArea } = Input;

const ThesisSubmission = () => {
  const [requirementsData, setRequirementsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [canProceed, setCanProceed] = useState(false);
  const [isAllUploaded, setIsAllUploaded] = useState(false);

  // Payment related states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // null, 0 (pending), 1 (paid)
  const [paymentRemark, setPaymentRemark] = useState('');

  // Award examiner states
  const [awardExamineeData, setAwardExamineeData] = useState(null);
  const [awardExamineeLoading, setAwardExamineeLoading] = useState(false);
  const [provisionalDegreePaymentStatus, setProvisionalDegreePaymentStatus] = useState(null);
  const [showProvisionalPaymentModal, setShowProvisionalPaymentModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [provisionalFeeAmount, setProvisionalFeeAmount] = useState(0);
  const [selectedProvisionalPaymentMethod, setSelectedProvisionalPaymentMethod] = useState('');
  const [provisionalPaymentLoading, setProvisionalPaymentLoading] = useState(false);
  const [provisionalPaymentRemark, setProvisionalPaymentRemark] = useState('');

  const { getSId } = useSelectedScholarAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequirementsData();
    checkUploadStatus();
    checkPaymentStatus();
    fetchAwardExamineeData();
    checkProvisionalDegreePaymentStatus();
  }, [getSId]);

  const fetchRequirementsData = async () => {
    try {
      setLoading(true);
      const sId = getSId();

      if (!sId) {
        setError('Scholar ID not found');
        return;
      }

      // Fetch thesis component report from API
      const response = await API.get(`/Thesis/Thesis-component-report/${sId}`);
      const data = response.data;

      // Create requirements array with status from API
      const requirements = [
        {
          key: 1,
          srNo: 1,
          description: 'Pre. Ph.D. Marksheet/Certificate',
          status: data.prePhDMarksheet ? 'completed' : 'pending',
          apiField: 'prePhDMarksheet'
        },
        {
          key: 2,
          srNo: 2,
          description: 'Synopsis',
          status: data.synopsis ? 'completed' : 'pending',
          apiField: 'synopsis'
        },
        {
          key: 3,
          srNo: 3,
          description: 'R.D.C. Letter',
          status: data.rdcLetter ? 'completed' : 'pending',
          apiField: 'rdcLetter'
        },
        {
          key: 4,
          srNo: 4,
          description: 'Progress Report (5)',
          status: data.progressReport ? 'completed' : 'pending',
          apiField: 'progressReport'
        },
        {
          key: 5,
          srNo: 5,
          description: 'Research Paper (2)',
          status: data.researchPaper ? 'completed' : 'pending',
          apiField: 'researchPaper'
        },
        {
          key: 6,
          srNo: 6,
          description: 'Conferences / Seminars (2)',
          status: data.conferences ? 'completed' : 'pending',
          apiField: 'conferences'
        },
        { key: 7, srNo: 7, description: 'No Dues Certificate from Related Department / Research Centre', status: 'required' },
        { key: 8, srNo: 8, description: 'Pre. Ph.D. Presentation Notice', status: 'required' },
        { key: 9, srNo: 9, description: 'Pre. Ph.D. Presentation Certificate issued by HoD/Principal', status: 'required' },
        { key: 10, srNo: 10, description: 'Time Extension Letter (If Applicable)', status: 'required' },
        { key: 11, srNo: 11, description: 'Thesis', status: 'required' },
        { key: 12, srNo: 12, description: 'Summary of the Thesis', status: 'required' }
      ];

      setRequirementsData(requirements);

      // Check if first 6 requirements are completed
      const firstSixCompleted = data.prePhDMarksheet &&
        data.synopsis &&
        data.rdcLetter &&
        data.progressReport &&
        data.researchPaper &&
        data.conferences;

      setCanProceed(firstSixCompleted);

    } catch (err) {
      console.error('Error fetching requirements data:', err);
      notification().error('Failed to load thesis submission requirements');
    } finally {
      setLoading(false);
    }
  };

  const checkUploadStatus = async () => {
    try {
      setLoading(true);
      const sId = getSId();

      if (!sId) {
        setError('Scholar ID not found');
        return;
      }

      const response = await API.get(`/Thesis/check-all-upload/${sId}`)
      setIsAllUploaded(response.data.isAllUploaded);
    } catch (error) {
      console.log(error)
    }
  }

  const checkPaymentStatus = async () => {
    try {
      const sId = getSId();
      if (!sId) return;

      const response = await API.get(`/ScholarPayments/by-sid/${sId}`);
      const payments = response.data || [];

      // Check if there's any payment with status 1 (paid)
      const paidPayment = payments.find(payment => payment.paymentStatus === 1 && payment.paymentCategory === 6) ;
      setPaymentStatus(paidPayment ? 1 : 0);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus(0); // Default to unpaid
    }
  };

  const fetchAwardExamineeData = async () => {
    try {
      setAwardExamineeLoading(true);
      const sId = getSId();
      if (!sId) return;

      const response = await API.get(`/AwardExaminee/${sId}`);
      if (response.data && response.data.length > 0) {
        setAwardExamineeData(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching award examinee data:', error);
    } finally {
      setAwardExamineeLoading(false);
    }
  };

  const checkProvisionalDegreePaymentStatus = async () => {
    try {
      const sId = getSId();
      if (!sId) return;

      const response = await API.get(`/ScholarPayments/by-sid/${sId}`);
      const payments = response.data || [];

      // Check if there's any payment with category "PROVISIONAL_DEGREE" or "Provisional Degree Fee" and status successful (1 or 2)
      const provisionalPayment = payments.find(payment =>
        (payment.paymentStatus === 1 || payment.paymentStatus === 2) &&
        (payment.paymentCategory === 8 || payment.category === 'PROVISIONAL_DEGREE' || payment.category === 'Provisional Degree Fee')
      );
      setProvisionalDegreePaymentStatus(provisionalPayment ? 1 : 0);
    } catch (error) {
      console.error('Error checking provisional degree payment status:', error);
      setProvisionalDegreePaymentStatus(0);
    }
  };

  const handlePrintCertificate = () => {
    const printContent = document.getElementById('provisional-certificate-content');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Provisional Degree Certificate - ${awardExamineeData?.name || 'Scholar'}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Times New Roman', Georgia, serif; background: white; color: #111827; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // const fetchFeeAmount = async () => {
  //   try {
  //     const response = await API.get('/FeeCategory/6');
  //     setFeeAmount(response.data.amount);
  //   } catch (error) {
  //     console.error('Error fetching fee amount:', error);
  //     notification().error('Failed to fetch fee amount');
  //   }
  // };

  const fetchProvisionalFeeAmount = async () => {
    try {
      const response = await API.get('/FeeCategory/11');
      setProvisionalFeeAmount(response.data.amount);
    } catch (error) {
      console.error('Error fetching provisional fee amount:', error);
      notification().error('Failed to fetch provisional degree fee amount');
    }
  };

  // const handlePaymentModalOpen = async () => {
  //   await fetchFeeAmount();
  //   setShowPaymentModal(true);
  // };

  const handleProvisionalPaymentModalOpen = async () => {
    await fetchProvisionalFeeAmount();
    setShowProvisionalPaymentModal(true);
  };

  // const handlePayment = async () => {
  //   if (!selectedPaymentMethod) {
  //     notification().error('Please select a payment method');
  //     return;
  //   }

  //   setPaymentLoading(true);
  //   try {
  //     const sId = getSId();
  //     const ipAddress = await getIP();
  //     const currentDate = new Date();

  //     const paymentData = {
  //       spid: 0,
  //       sid: parseInt(sId),
  //       token: "string",
  //       transactionID: `TXN_${Date.now()}_${sId}`,
  //       paymentStatus: 2,
  //       paymentCategory: 6,
  //       hashReturn: "string",
  //       discription: `Thesis fee payment via ${selectedPaymentMethod}`,
  //       paymentDate: currentDate.toISOString(),
  //       ipAddress: ipAddress,
  //       created: currentDate.toISOString(),
  //       modified: currentDate.toISOString(),
  //       remark: paymentRemark.trim() || '',
  //       transfer: currentDate.toISOString(),
  //       category: "GENERAL"
  //     };

  //     await API.post('/ScholarPayments', paymentData);

  //     notification().success('Payment successful!');
  //     setPaymentStatus(1);
  //     setShowPaymentModal(false);

  //     // Fetch award examinee data after payment
  //     await fetchAwardExamineeData();
  //     await checkProvisionalDegreePaymentStatus();

  //     // Reset form
  //     setSelectedPaymentMethod('');
  //     setPaymentRemark('');

  //   } catch (error) {
  //     console.error('Payment error:', error);
  //     notification().error('Payment failed. Please try again.');
  //   } finally {
  //     setPaymentLoading(false);
  //   }
  // };

  const handleProvisionalPayment = async () => {
    if (!selectedProvisionalPaymentMethod) {
      notification().error('Please select a payment method');
      return;
    }

    setProvisionalPaymentLoading(true);
    try {
      const sId = getSId();
      const ipAddress = await getIP();
      const currentDate = new Date();

      const paymentData = {
        spid: 0,
        sid: parseInt(sId),
        token: "string",
        transactionID: `TXN_${Date.now()}_${sId}`,
        paymentStatus: 1,
        paymentCategory: 1,
        hashReturn: "string",
        discription: `Provisional degree fee payment via ${selectedProvisionalPaymentMethod}`,
        paymentDate: currentDate.toISOString(),
        ipAddress: ipAddress,
        created: currentDate.toISOString(),
        modified: currentDate.toISOString(),
        remark: provisionalPaymentRemark.trim() || '',
        transfer: currentDate.toISOString(),
        category: "PROVISIONAL_DEGREE"
      };

      await API.post('/ScholarPayments', paymentData);

      notification().success('Provisional degree fee payment successful!');
      setProvisionalDegreePaymentStatus(1);
      setShowProvisionalPaymentModal(false);

      // Reset form
      setSelectedProvisionalPaymentMethod('');
      setProvisionalPaymentRemark('');

    } catch (error) {
      console.error('Payment error:', error);
      notification().error('Payment failed. Please try again.');
    } finally {
      setProvisionalPaymentLoading(false);
    }
  };

  const paymentMethods = [
    { value: 'credit_card', label: 'Credit Card', icon: '💳' },
    { value: 'debit_card', label: 'Debit Card', icon: '💳' },
    { value: 'net_banking', label: 'Net Banking', icon: '🏦' },
    { value: 'upi', label: 'UPI', icon: '📱' },
    { value: 'wallet', label: 'Digital Wallet', icon: '👛' },
  ];


  const handleProceedToUpload = () => {
    // Double-check that all documents are not already uploaded
    //<--- temp
    if (isAllUploaded) {
      console.log('All documents already uploaded, cannot proceed to upload page');
      return;
    }

    console.log('Navigating to uploads page...');
    navigate('uploads');
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading thesis submission requirements...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    );
  }

  if (isAllUploaded) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
        <div className="w-full max-w-2xl">

          {/* Single Centered Box */}
          <div className="bg-white rounded-xl shadow-lg p-8">

            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-gray-800 text-center">
              All Documents Uploaded
            </h1>

            {/* Message */}
            <p className="text-gray-600 mt-3 text-sm leading-relaxed text-center">
              All required documents for your thesis have been successfully uploaded.
              Your thesis has now been sent for <span className="font-medium">Plagiarism Check</span>.
            </p>

            {/* Status Badge */}
            <div className="mt-6 flex justify-center">
              {/* <div className="inline-block px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-medium">
                Status: Under Plagiarism Review
              </div> */}
            </div>

            {paymentStatus === 1 && !(awardExamineeData?.level5Status === 1) && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Payment Completed</h3>
                <p className="text-xs text-blue-700">
                  Thesis fee has been successfully paid. Your thesis is now under review.
                </p>
              </div>
            )}

            {/* Latest Examiner Status */}
            {awardExamineeData && (
              <div className={`mt-4 p-4 rounded-lg border ${
                (() => {
                  const levelNames = {
                    1: 'Associate Director',
                    2: 'Associate Director',
                    3: 'DOR',
                    4: 'Registrar',
                    5: 'VC Office'
                  };

                  // Find the latest level with a status
                  let latestLevel = null;
                  for (let i = 5; i >= 1; i--) {
                    const statusKey = `level${i}Status`;
                    if (awardExamineeData[statusKey] !== null && awardExamineeData[statusKey] !== undefined) {
                      latestLevel = i;
                      break;
                    }
                  }

                  if (latestLevel) {
                    const statusKey = `level${latestLevel}Status`;
                    const status = awardExamineeData[statusKey];
                    
                    // Return appropriate color classes based on status
                    if (status === 2) {
                      return 'bg-red-50 border-red-200';
                    } else {
                      return 'bg-blue-50 border-blue-200';
                    }
                  }
                  return 'bg-blue-50 border-blue-200';
                })()
              }`}>
                {(() => {
                  const levelNames = {
                    1: 'Associate Director',
                    2: 'Associate Director',
                    3: 'DOR',
                    4: 'Registrar',
                    5: 'VC Office'
                  };

                  // Find the latest level with a status
                  let latestLevel = null;
                  for (let i = 5; i >= 1; i--) {
                    const statusKey = `level${i}Status`;
                    if (awardExamineeData[statusKey] !== null && awardExamineeData[statusKey] !== undefined) {
                      latestLevel = i;
                      break;
                    }
                  }

                  if (latestLevel) {
                    const statusKey = `level${latestLevel}Status`;
                    const remarkKey = `level${latestLevel}Remark`;
                    const status = awardExamineeData[statusKey];
                    const remark = awardExamineeData[remarkKey];
                    const levelName = levelNames[latestLevel];

                    return (
                      <div>
                        <p className={`text-sm ${status === 2 ? 'text-red-700' : 'text-blue-700'}`}>
                          <span className="font-semibold">
                            {status === 1 ? '✓ Approved' : status === 2 ? '✗ Rejected' : 'Pending'}
                          </span>
                          {' at '}
                          <span className="font-semibold">{levelName}</span>
                          {remark && `: ${remark}`}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}


            {/* Payment Section */}
            {/* {paymentStatus !== 1 && (
              <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h3 className="text-sm font-semibold text-orange-800 mb-2">Payment Required</h3>
                <p className="text-xs text-orange-700 mb-3">
                  Please complete the thesis fee payment to proceed with the evaluation process.
                </p>
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  onClick={handlePaymentModalOpen}
                  className="w-full bg-orange-600 hover:bg-orange-700 border-orange-600"
                >
                  Pay Thesis Fee
                </Button>
              </div>
            )}
 */}


            {/* Provisional Degree Payment Section - Only show when Level 5 is approved */}
            {awardExamineeData?.level5Status === 1 && (
              <div className="mt-6 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-300 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-base font-bold text-emerald-900">
                    Ph.D. Degree Award Approved
                  </h3>
                </div>
                <p className="text-xs text-emerald-800 mb-4 leading-relaxed">
                  Congratulations! Your thesis and viva-voce examination have been successfully approved by the Vice-Chancellor Office (Level 5).
                </p>

                {provisionalDegreePaymentStatus !== 1 ? (
                  <Button
                    type="primary"
                    icon={<CreditCardOutlined />}
                    onClick={handleProvisionalPaymentModalOpen}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 border-emerald-600 font-medium h-10 shadow-sm"
                  >
                    Pay Provisional Degree Fee
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-100/80 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="text-xs text-emerald-800 font-semibold flex items-center">
                        <CheckCircleOutlined className="text-emerald-600 text-sm mr-2" />
                        Provisional Degree Fee Paid
                      </span>
                      <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                        Verified
                      </span>
                    </div>

                    <Button
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={() => setShowCertificateModal(true)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 border-indigo-600 font-semibold h-11 text-sm shadow-md"
                    >
                      🎓 View / Print Provisional Degree Certificate
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Thesis Fee Payment Modal */}
        <Modal
          title="Thesis Fee Payment"
          open={showPaymentModal}
          onCancel={() => setShowPaymentModal(false)}
          footer={null}
          width={500}
        >
          <div className="space-y-4">
            {/* Fee Amount */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Thesis Fee:</span>
                <span className="text-xl font-bold text-green-600">₹{feeAmount?.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <h4 className="font-medium text-gray-800 mb-3">Select Payment Method</h4>
              <Radio.Group
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full"
              >
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <Radio
                      key={method.value}
                      value={method.value}
                      className="w-full p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <span className="mr-2">{method.icon}</span>
                      {method.label}
                    </Radio>
                  ))}
                </div>
              </Radio.Group>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (Optional)
              </label>
              <Input.TextArea
                rows={3}
                value={paymentRemark}
                onChange={(e) => setPaymentRemark(e.target.value)}
                placeholder="Enter any additional remarks..."
              />
            </div>

            {/* Payment Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="primary"
               // onClick={handlePayment}
                loading={paymentLoading}
                disabled={!selectedPaymentMethod}
                className="flex-1 bg-green-600 hover:bg-green-700 border-green-600"
              >
                {paymentLoading ? 'Processing...' : `Pay ₹${feeAmount?.toLocaleString()}`}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Provisional Degree Payment Modal */}
        <Modal
          title="Provisional Degree Fee Payment"
          open={showProvisionalPaymentModal}
          onCancel={() => setShowProvisionalPaymentModal(false)}
          footer={null}
          width={500}
        >
          <div className="space-y-4">
            {/* Fee Amount */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Provisional Degree Fee:</span>
                <span className="text-xl font-bold text-green-600">₹{provisionalFeeAmount?.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <h4 className="font-medium text-gray-800 mb-3">Select Payment Method</h4>
              <Radio.Group
                value={selectedProvisionalPaymentMethod}
                onChange={(e) => setSelectedProvisionalPaymentMethod(e.target.value)}
                className="w-full"
              >
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <Radio
                      key={method.value}
                      value={method.value}
                      className="w-full p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <span className="mr-2">{method.icon}</span>
                      {method.label}
                    </Radio>
                  ))}
                </div>
              </Radio.Group>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (Optional)
              </label>
              <Input.TextArea
                rows={3}
                value={provisionalPaymentRemark}
                onChange={(e) => setProvisionalPaymentRemark(e.target.value)}
                placeholder="Enter any additional remarks..."
              />
            </div>

            {/* Payment Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowProvisionalPaymentModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleProvisionalPayment}
                loading={provisionalPaymentLoading}
                disabled={!selectedProvisionalPaymentMethod}
                className="flex-1 bg-green-600 hover:bg-green-700 border-green-600"
              >
                {provisionalPaymentLoading ? 'Processing...' : `Pay ₹${provisionalFeeAmount?.toLocaleString()}`}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Provisional Degree Certificate Modal */}
        <Modal
          title={null}
          open={showCertificateModal}
          onCancel={() => setShowCertificateModal(false)}
          footer={[
            <Button key="close" onClick={() => setShowCertificateModal(false)}>
              Close
            </Button>,
            <Button
              key="print"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrintCertificate}
              className="bg-indigo-600 hover:bg-indigo-700 border-indigo-600"
            >
              Print / Download Certificate
            </Button>
          ]}
          width={800}
          bodyStyle={{ padding: '20px', maxHeight: '82vh', overflowY: 'auto' }}
        >
          <div id="provisional-certificate-content" className="p-8 bg-white border-8 border-double border-amber-800 rounded-lg text-gray-900 font-serif">
            {/* University Header */}
            <div className="text-center pb-4 border-b-2 border-amber-900">
              <PrintHeader />
              <div className="mt-3">
                <span className="px-4 py-1 bg-amber-100 text-amber-950 border border-amber-400 font-bold uppercase tracking-widest text-xs rounded-full inline-block">
                  Directorate of Research & Higher Studies
                </span>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-6">
              <h2 className="text-2xl font-extrabold uppercase tracking-wide text-amber-950 font-serif mb-1">
                Provisional Degree Certificate
              </h2>
              <p className="text-xs font-bold tracking-widest uppercase text-gray-600">
                Doctor of Philosophy (Ph.D.)
              </p>
            </div>

            {/* Ref & Date */}
            <div className="flex justify-between items-center text-xs text-gray-700 mb-6 px-2">
              <div>
                <span className="font-bold">Ref. No.:</span>{' '}
                <span>RMS/PHD/PROV/{awardExamineeData?.year || new Date().getFullYear()}/{String(awardExamineeData?.sid || '1').padStart(4, '0')}</span>
              </div>
              <div>
                <span className="font-bold">Date:</span>{' '}
                <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Certificate Body */}
            <div className="text-justify text-sm leading-relaxed text-gray-800 space-y-4 px-2">
              <p>
                This is to certify that{' '}
                <span className="font-bold text-base text-gray-950 border-b border-dotted border-gray-600 px-1">
                  {awardExamineeData?.name || 'Candidate'}
                </span>
                , Enrollment / Registration No.{' '}
                <span className="font-bold text-gray-950">
                  {awardExamineeData?.permUserName || `RMS/PHD/${awardExamineeData?.sid || '1'}`}
                </span>
                , having completed all prescribed course work, fulfilled residency requirements, submitted the doctoral dissertation, and successfully defended the research work in the Open Viva-Voce examination in the Department / Subject of{' '}
                <span className="font-bold text-gray-950">
                  {awardExamineeData?.subjectName || 'Research Studies'}
                </span>
                , has been approved by the Academic Council & Executive Committee for the award of the Degree of:
              </p>

              <div className="my-5 py-3 bg-amber-50/70 border-y-2 border-amber-700 text-center">
                <span className="text-xl font-bold tracking-wider text-amber-950 uppercase font-serif">
                  Doctor of Philosophy (Ph.D.)
                </span>
              </div>

              <div className="space-y-1.5 text-xs bg-gray-50 p-4 rounded border border-gray-200">
                <div>
                  <span className="font-semibold text-gray-700">Research Supervisor: </span>
                  <span className="font-bold text-gray-900">{awardExamineeData?.supervisorName || 'Research Supervisor'}</span>
                  {awardExamineeData?.supervisorUniversity && (
                    <span className="text-gray-600"> ({awardExamineeData?.supervisorUniversity})</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Open Viva-Voce Defense: </span>
                  <span className="text-emerald-700 font-bold">Successfully Defended & Approved</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">5-Level Verification: </span>
                  <span className="text-emerald-700 font-bold">Completed (Level 1 to Level 5 Approved)</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Award Status: </span>
                  <span className="font-bold text-gray-900 uppercase">Provisional Degree Conferred</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-600 italic pt-2">
                * Note: This provisional certificate is issued with the approval of the Competent Authority and remains valid until the formal Degree Certificate is conferred at the University Convocation.
              </p>
            </div>

            {/* Authority Signatures */}
            <div className="grid grid-cols-3 gap-4 pt-14 mt-6 border-t border-gray-300 text-center text-xs">
              <div>
                <div className="font-bold text-gray-800">Assistant Director</div>
                <div className="text-[11px] text-gray-500">Directorate of Research</div>
              </div>
              <div>
                <div className="font-bold text-gray-800">Director of Research</div>
                <div className="text-[11px] text-gray-500">Research Committee</div>
              </div>
              <div>
                <div className="font-bold text-gray-800">Registrar / VC Office</div>
                <div className="text-[11px] text-gray-500">University Administration</div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    )
  }


  return (
    <div className="h-full  rounded-2xl">
      <div className="p-1">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-3 p-2">
          <h1 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Ph.D. Thesis Submission
          </h1>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Orange Header */}
          <div className="bg-orange-200 px-4 py-1 border-b">
            <h2 className="font-semibold text-orange-900">Thesis Submission Requirements</h2>
          </div>

          {/* Requirements Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-1 text-left font-semibold text-gray-700 border-r w-20">Sr. No.</th>
                  <th className="px-4 py-1 text-left font-semibold text-gray-700 border-r">Description of Requirement</th>
                  <th className="px-4 py-1 text-center font-semibold text-gray-700 w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {requirementsData.map((item, index) => (
                  <tr key={item.key} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-1 text-center border-r">{item.srNo}</td>
                    <td className="px-4 py-1 border-r">{item.description}</td>
                    <td className="px-4 py-1 text-center">
                      {item.status === 'completed' && (
                        <CheckCircleOutlined style={{ color: '#10b981', fontSize: '18px' }} />
                      )}
                      {item.status === 'pending' && item.srNo <= 6 && (
                        <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />
                      )}
                      {item.status === 'pending' && item.srNo > 6 && (
                        <div className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-sm">
                          <span className="text-xs font-bold">△</span>
                        </div>
                      )}
                      {item.status === 'required' && (
                        <span className="text-red-600 text-sm font-medium">Required</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Blue Info Bar */}
          <div className="bg-blue-100 px-4 py-1 text-center border-t">
            <span className="text-blue-800 font-medium">Need to be Upload in Next Step</span>
          </div>

          {/* Note Section */}
          <div className="px-4 py-1 bg-gray-50 border-t">
            <div className="mb-2">
              <span className="font-semibold text-gray-700">Note: </span>
              <span className="text-gray-600">Thesis and Summary should be in .pdf format and upto 15 MB of each file.</span>
            </div>
          </div>

          {/* Remarks Section */}
          <div className="px-4 py-2 border-t">
            <div className="mb-2">
              <label className="font-semibold text-gray-700">Remarks:</label>
            </div>
            <TextArea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder=""
              className="w-full border border-gray-300 rounded resize-none"
            />
          </div>

          {/* Proceed Button */}
          <div className="px-4 py-4 text-center border-t bg-gray-50">
            {/* <--- temp */}
            {canProceed && !isAllUploaded ? (
            
              <Button
                type="primary"
                size="large"
                onClick={handleProceedToUpload}
                className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 px-8 py-2 font-semibold rounded"
              >
                Proceed to Upload Thesis
              </Button>
            ) : (
              <div className="space-y-2">
                <Alert
                  message={isAllUploaded ? "Documents Already Uploaded" : "Requirements Not Met"}
                  description={
                    isAllUploaded
                      ? "All required documents have been uploaded and are under plagiarism review."
                      : "Please complete the first 6 requirements (Pre. Ph.D. Marksheet, Synopsis, R.D.C. Letter, Progress Report, Research Paper, and Conferences) before proceeding to thesis upload."
                  }
                  type={isAllUploaded ? "info" : "warning"}
                  showIcon
                  className="text-left"
                />
                <Button
                  type="primary"
                  size="large"
                  disabled
                  className="bg-gray-400 border-gray-400 px-8 py-2 font-semibold rounded cursor-not-allowed"
                >
                  Proceed to Upload Thesis
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThesisSubmission;