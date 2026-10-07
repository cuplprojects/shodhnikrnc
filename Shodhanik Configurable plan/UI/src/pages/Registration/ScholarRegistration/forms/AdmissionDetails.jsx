import { useEffect, useState } from 'react';
import { Download, CheckCircle, GraduationCap, CreditCard } from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';
import notification from '@/services/NotificationService';
import API from '@/services/API';
import IDCard from '@/components/cms/IDCard';

const AdmissionDetails = () => {
  const { getSId } = useScholarRegAuthStore();
  const { saveStep } = useSteps();
  const scholarId = getSId();

  useEffect(() => {
    if (scholarId) {
      setLoading(true);
      fetchScholarData().finally(() => {
        setLoading(false);
      });
    }
  }, [scholarId])
  
  // Auto-refresh steps from API on component load
  useStepRefresh();

  const [downloading, setDownloading] = useState(false);
  const [scholarData, setScholarData] = useState({});
  const [showIDCard, setShowIDCard] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchScholarData = async () => {
    try {
      const response = await API.get(`/ScholarPersonalDetails/GetScholarBasicDetailBySID?sid=${scholarId}`);
      console.log('Scholar Details:', response);
      
      // Handle the response data properly
      if (response && response.data) {
        setScholarData(response.data);
      } else if (response) {
        // If response is directly the data object
        setScholarData(response);
      }
    } catch (error) {
      console.log('Error fetching scholar details:', error);
    }
  };

  // Admission data using scholar basic details
  const admissionData = {
    applicationId: scholarData?.shodhanikID || '',
    applicantName: scholarData?.name,
    subject: scholarData?.subject || '',
    email: scholarData?.email || '',
    mobile: scholarData?.phoneNumber || '',
    category: scholarData?.category || '',
    admissionDate: new Date().toLocaleDateString('en-GB'),
    academicYear: scholarData?.year || '',
    rollNumber: scholarData?.shodhanikID || '',
  };

  // Handle download admission slip
  const handleDownloadAdmissionSlip = async () => {
    const notify = notification();
    
    try {
      setDownloading(true);
      
      // Complete step 9 (final step)
      const stepSaved = await saveStep(9);
      if (stepSaved) {
        // Simulate download process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // In real implementation, this would download the actual admission slip PDF
        // For now, we'll just show a success message
        notify.success('Admission slip downloaded successfully!');
        
        // You can add actual file download logic here
        // Example: window.open('/api/download-admission-slip/' + scholarId, '_blank');
      }
    } catch (error) {
      console.error('Error downloading admission slip:', error);
      notify.error('Failed to download admission slip');
    } finally {
      setDownloading(false);
    }
  };

  // Handle ID Card print
  const handlePrintIDCard = () => {
    // Add a small delay to ensure styles are applied
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Handle show ID Card
  const handleShowIDCard = () => {
    setShowIDCard(true);
  };

  // Show ID Card if requested
  if (showIDCard) {
    return (
      <div className="p-4 md:p-5">
        <div className="mb-4 no-print">
          <button
            onClick={() => setShowIDCard(false)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Admission Details
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <IDCard 
              scholarData={scholarData} 
              onPrint={handlePrintIDCard}
            />
            
            {/* Debug info - remove in production */}
            {/* {import.meta.env.DEV && (
              <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
                <strong>Debug - Scholar Data:</strong>
                <pre>{JSON.stringify(scholarData, null, 2)}</pre>
              </div>
            )} */}
          </>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-5">
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading admission details...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5">
      <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <GraduationCap className="text-green-600" size={20} />
          </div>
          <h2 className="text-xl font-bold text-[#111827] font-inter">
            Admission Details
          </h2>
        </div>

        {/* Success Message */}
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="text-green-600" size={24} />
            <h3 className="text-lg font-bold text-green-800">
              Congratulations! Your Admission is Confirmed
            </h3>
          </div>
          <p className="text-green-700 mb-4">
            Your application has been successfully processed and your admission to the Ph.D. program has been confirmed.
          </p>
          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-green-800">Application ID:</span>
              <span className="ml-2 text-green-700">{admissionData.applicationId}</span>
            </div>
            <div>
              <span className="font-semibold text-green-800">Roll Number:</span>
              <span className="ml-2 text-green-700">{admissionData.rollNumber}</span>
            </div>
            <div>
              <span className="font-semibold text-green-800">Academic Year:</span>
              <span className="ml-2 text-green-700">{admissionData.academicYear}</span>
            </div>
            <div>
              <span className="font-semibold text-green-800">Admission Date:</span>
              <span className="ml-2 text-green-700">{admissionData.admissionDate}</span>
            </div>
          </div> */}
        </div>

        {/* Admission Details */}
        <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-lg font-semibold text-blue-900 mb-4">Your Admission Details</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">Student Name</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm text-blue-700">{admissionData.applicantName}</span>
            </div>

            <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">Roll Number</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm font-semibold text-blue-700">{admissionData.rollNumber}</span>
            </div>

            {/* <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">Department</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm text-blue-700">{admissionData.department}</span>
            </div> */}

            <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">Subject</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm text-blue-700">{admissionData.subject}</span>
            </div>

            <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">Category</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm text-blue-700">{admissionData.category}</span>
            </div>

            {/* <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">University</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm text-blue-700">{admissionData.university}</span>
            </div> */}

            <div className="grid grid-cols-[200px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-medium text-blue-800">Academic Year</span>
              <span className="text-sm text-blue-700">:</span>
              <span className="text-sm text-blue-700">{admissionData.academicYear}</span>
            </div>
          </div>
        </div>

        {/* Important Instructions */}
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-900 mb-2">Important Instructions:</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Please download and keep your admission slip safe for future reference</li>
            <li>• Report to the department on the specified date with all original documents</li>
            <li>• Contact the department for any queries regarding course commencement</li>
            <li>• Keep your roll number handy for all future communications</li>
          </ul>
        </div>

        {/* Download Button */}
        <div className="text-center space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleDownloadAdmissionSlip}
              disabled={downloading}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 px-8 rounded-lg font-semibold font-inter text-base transition-all duration-200 hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Download Admission Slip
                </>
              )}
            </button>

            <button
              onClick={handleShowIDCard}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-500 text-white py-4 px-8 rounded-lg font-semibold font-inter text-base transition-all duration-200 hover:from-green-700 hover:to-green-600 active:scale-[0.98] shadow-lg hover:shadow-xl"
            >
              <CreditCard size={20} />
              View ID Card
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-[#e5e7eb] text-center">
          <p className="text-sm text-gray-600">
            Thank you for choosing {admissionData.university}. We wish you all the best for your Ph.D. journey!
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdmissionDetails;