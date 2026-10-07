import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import API from '@/services/API';
const Payment = () => {

  const { getSId } = useScholarRegAuthStore();
  const { saveStep, isReadOnly } = useSteps();
  const navigate = useNavigate();
  const scholarId = getSId();

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [regTypeName, setRegTypeName] = useState('N/A');

  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        // Fetch preview details (includes personal details, academic qualifications, uploads)
        const previewResponse = await API.get(`/Scholars/PreviewAllDetails/${scholarId}`);
        
        // Fetch scholar details (includes fName, phoneNumber, applicationNo, etc.)
        const scholarResponse = await API.get(`/Scholars/${scholarId}`);

        if (previewResponse.data && scholarResponse.data) {
          // Merge the data - scholar details override preview details
          const mergedData = {
            ...previewResponse.data,
            scholar: {
              ...previewResponse.data.scholar,
              ...scholarResponse.data // This will add fName, phoneNumber, applicationNo, etc.
            }
          };
          
          setPreviewData(mergedData);
          
          // Fetch registration type name if regType is available
          if (scholarResponse.data?.regType) {
            try {
              const regTypeResponse = await API.get(`/RegTypes/${scholarResponse.data.regType}`);
              if (regTypeResponse.data?.regTypeName) {
                setRegTypeName(regTypeResponse.data.regTypeName);
              }
            } catch (regTypeError) {
              console.error('Error fetching registration type:', regTypeError);
              setRegTypeName('Unknown');
            }
          }
        } else {
          throw new Error('No data received from API');
        }

      } catch (err) {
        console.error('Error fetching preview data:', err);
      }
    };

    if (scholarId) {
      fetchPreviewData();
    }
  }, [scholarId]);

  // Mock data - replace with actual application data
  const paymentData = {
    applicationId: previewData?.scholar?.applicationNo || 'N/A',
    applicantName: previewData?.scholar?.name  || 'N/A',
    subject: previewData?.scholar?.subjectName || 'N/A',
    email: previewData?.scholar?.email || 'N/A',
    mobile: previewData?.scholar?.phoneNumber || 'N/A',
    registrationType: regTypeName,
    category: previewData?.personalDetails?.category || 'N/A',
    gender: previewData?.personalDetails?.gender || 'N/A',
    applicationFees: '25000',
    rmsOrderId: previewData?.scholar?.applicationNo || 'N/A', // Generated order ID
  };

  const handleSubmitPayment = () => {
    if (acceptTerms) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmAndPay = async () => {
    try {
      // Save step 5 (Payment) and navigate to print page
      const stepSaved = await saveStep(5);
      if (stepSaved) {
        // Navigate to print page
        navigate('/register-scholar/print');
      }
    } catch (error) {
      console.error('Error saving payment step:', error);
      // You might want to show an error notification here
    }
  };

  // If confirmation screen should be shown
  if (showConfirmation) {
    return (
      <div className="p-4 md:p-5">
        {/* {isReadOnly && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Read-only:</strong> Step 5 completed. Payment details cannot be modified.
            </p>
          </div>
        )} */}
        <div className="bg-white">
          {/* Confirmation Header */}
          <div className="mb-6 pb-3 border-b-2 border-[#1e40af]">
            <h2 className="text-2xl font-bold text-[#1e40af] font-inter">Fee Payment Confirmation</h2>
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
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Fee Amount :</span>
              <span className="text-2xl font-bold text-[#6b7280]">{paymentData.applicationFees}</span>
            </div>
          </div>

          {/* Confirm & Pay Button */}
          <div className="flex justify-end">
            <button
              onClick={handleConfirmAndPay}
              disabled={isReadOnly}
              className="bg-[#1e40af] text-white py-3 px-10 rounded-md font-semibold font-inter text-base transition-all duration-200 hover:bg-[#1e3a8a] active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReadOnly ? 'Read Only' : 'Confirm & Pay'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5">
      {/* {isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Read-only:</strong> Step 5 completed. Payment details cannot be modified.
          </p>
        </div>
      )} */}
      <div className="bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-[#1e40af]">
          <CreditCard size={24} className="text-[#1e40af]" />
          <h2 className="text-xl font-bold text-[#1e40af] font-inter">Payment</h2>
        </div>

        {/* Payment Details */}
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Application ID</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.applicationId}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Applicant's Name</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.applicantName}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Subject</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.subject}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Email ID</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.email}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Mobile No.</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.mobile}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Registration Type</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.registrationType}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Category</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.category}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Gender</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-sm text-[#6b7280]">{paymentData.gender}</span>
          </div>

          <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
            <span className="text-sm font-medium text-[#92400e]">Application Fees</span>
            <span className="text-sm text-[#6b7280]">:</span>
            <span className="text-2xl font-bold text-green-600">₹{paymentData.applicationFees}</span>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-red-600 mb-2">TERMS AND CONDITIONS FOR ONLINE PAYMENTS</h3>
          <p className="text-xs text-red-600 mb-4 leading-relaxed">
            Payment(s) through this Service may only be made with a Credit Card, Debit card or Net Banking. The service is provided using a payment gateway service provider through a secure website. However, neither the payment gateway service provider nor the CCSU gives any assurance, that the information so provided online by a user is secured or may be read or intercepted by a third party. Fees once paid will not be refunded under any circumstances.
          </p>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={acceptTerms || isReadOnly}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-[#1e40af] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#1e40af]"
              disabled={isReadOnly}
              required
            />
            <label className="text-sm text-[#6b7280] font-inter">
              I hereby confirm that I have read this document and agree to the conditions listed thereof.
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmitPayment}
            disabled={isReadOnly || !acceptTerms}
            className="bg-[#1e40af] text-white py-2.5 px-8 rounded-md font-semibold font-inter text-sm transition-all duration-200 hover:bg-[#1e3a8a] active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReadOnly ? 'Read Only' : 'Submit for Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payment;