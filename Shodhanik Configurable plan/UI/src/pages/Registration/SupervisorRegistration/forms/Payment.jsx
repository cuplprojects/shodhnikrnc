import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStepSupStore from '../components/stepStore';
import useStepsSup from '../../../../hooks/useStepsSup';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import API from '@/services/API';

const Payment = () => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const navigate = useNavigate();
  const { saveStep } = useStepsSup();
  const { user, getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  const [supervisorData, setSupervisorData] = useState([]);

  useEffect(() => {
    handleGetReg();
  }, [user, supId])

  const handleGetReg = async () => {
    try {
      const response = await API.get(
        `/SupervisorRegistration/${supId}`
      );
      // Store supervisor data for read-only check
      setSupervisorData(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  console.log(user)
  // Sample data - replace with actual data from props or context
  const paymentData = {
    applicationId: supervisorData?.applicationNumber || 0,
    applicantName: supervisorData?.fullName || "N/A",
    fatherName: supervisorData?.fatherName || "N/A",
    emailId: supervisorData?.email || "N/A",
    mobileNo: supervisorData?.mobileNo || 0,
    applicationFees: supervisorData?.applicationFees || "Exempted"
  };

  const handleFinalSubmit = async () => {
    if (isConfirmed) {
      notification().success("Application submitted successfully!");
      setTimeout(async () => {
        const stepCompleted = await saveStep(7);
        if (stepCompleted) {
          navigate(SUPERVISOR_REGISTRATION_ROUTES.PRINT);
        } else {
          notification().error("Failed to update step progress. Please try again.");
        }
      }, 1500);
    } else {
      notification().warning("Please confirm that you have read the terms and conditions.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white py-4 px-6">
        <h1 className="text-xl font-semibold">Chaudhary Charan Singh University - Meerut</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Payment Header */}
          <div className="flex items-center gap-2 mb-6">
            <FileText className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-blue-600">Payment</h2>
          </div>

          {/* Payment Details */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Application ID</span>
                <span className="text-gray-600">:</span>
                <span className="ml-4 text-gray-800">{paymentData.applicationId}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Applicant's Name</span>
                <span className="text-gray-600">:</span>
                <span className="ml-4 text-gray-800">{paymentData.applicantName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Father's Name</span>
                <span className="text-gray-600">:</span>
                <span className="ml-4 text-gray-800">{paymentData.fatherName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center">
                <span className="font-medium text-gray-700 min-w-[120px]">Email ID</span>
                <span className="text-gray-600 mx-2">:</span>
                <span className="text-gray-800">{paymentData.emailId}</span>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Mobile No.</span>
                <span className="text-gray-600">:</span>
                <span className="ml-4 text-gray-800">{paymentData.mobileNo}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Application Fees</span>
                <span className="text-gray-600">:</span>
                <span className="ml-4 text-green-600 font-semibold text-lg">{paymentData.applicationFees}</span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="mb-6">
            <h3 className="text-red-600 font-semibold mb-3">TERMS AND CONDITIONS FOR ONLINE PAYMENTS</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                Payment(s) through this Service may only be made with a Credit Card, Debit card or Net Banking. This service is provided using a payment
                gateway service provider through a secure website. However, neither the payment gateway service provider nor the CCSU gives any assurance
                that the information so provided online by a user is secured or may be read or intercepted by a third party. Fees once paid will not be refunded
                under any circumstances.
              </p>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-red-600 text-sm">
                I hereby confirm that I have read this document and agree to the conditions listed thereof.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              onClick={handleFinalSubmit}
              disabled={!isConfirmed}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors duration-200 ${isConfirmed
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
                }`}
            >
              Final Submit Application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;