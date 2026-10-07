import { useEffect, useState } from 'react';
import { ArrowLeft, Upload, User, GraduationCap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const ThesisEvaluationReport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const notify = notification();
  
  // Token validation state
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Data state
  const [data, setData] = useState(null);
  
  // Form state
  const [recommendation, setRecommendation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [evaluationFile, setEvaluationFile] = useState(null);
  const [isDeclarationChecked, setIsDeclarationChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);


  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        notify.error('File size should not exceed 10MB');
        return;
      }
      if (file.type !== 'application/pdf') {
        notify.error('Please upload only PDF files');
        return;
      }
      setEvaluationFile(file);
      notify.success(`File "${file.name}" selected successfully`);
    }
  };

  useEffect(() => {
    const validateTokenAndFetchData = async () => {
      if (!token) {
        setIsValidating(false);
        setIsValid(false);
        setErrorMessage('No token provided. Please use the link from your email.');
        return;
      }

      try {
        setIsValidating(true);

        // Validate token and get examiner data
        const response = await API.post('/Confidential/award-details', { token });

        if (response.status === 200 && response.data) {
          setIsValid(true);
          setData(response.data);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValid(false);
        if (error.response?.status === 400) {
          const message = error.response?.data;
          setErrorMessage(message || 'Invalid or expired link.');
        } else {
          setErrorMessage('Failed to validate link. Please try again later.');
        }
      } finally {
        setIsValidating(false);
      }
    };

    validateTokenAndFetchData();
  }, [token]);

  const handleSubmit = async () => {
    if (!recommendation) {
      notify.error('Please select your recommendation');
      return;
    }

    if (recommendation === 'rejection' && !remarks.trim()) {
      notify.error('Remarks are required for rejection');
      return;
    }

    if (!evaluationFile) {
      notify.error('Please upload the signed evaluation report');
      return;
    }

    if (!isDeclarationChecked) {
      notify.error('Please check the declaration before submitting');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare FormData for file upload
      const formData = new FormData();
      formData.append('Token', token);
      
      // Map recommendation to decision integer
      let decision;
      switch (recommendation) {
        case 'award':
          decision = 1;
          break;
        case 'revision':
          decision = 2;
          break;
        case 'rejection':
          decision = 3;
          break;
        default:
          decision = 0;
      }
      
      formData.append('Decision', decision);
      formData.append('Remarks', remarks);
      formData.append('UploadReport', evaluationFile);

      // Submit to award-report API
      const response = await API.post('/Confidential/award-report', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200) {
        notify.success('Thesis evaluation submitted successfully!');
        
        // Update local state to show submitted status
        setData(prev => ({ ...prev, status: 1 }));
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      notify.error('Failed to submit evaluation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = !recommendation || !evaluationFile || !isDeclarationChecked ||
    (recommendation === 'rejection' && !remarks.trim()) || submitting;

  // Token validation loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Validating your access...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isValid) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-gray-300 shadow-sm p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact the university administration.
          </p>
        </div>
      </div>
    );
  }

  // Already submitted state (when data.status !== 0)
  if (isValid && data && data.status !== 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-gray-300 shadow-sm p-8 max-w-md text-center">
          <div className="text-green-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Already Submitted</h2>
          <p className="text-gray-600 mb-4">You have already submitted your evaluation report for this thesis.</p>
          <div className="text-sm text-gray-500 space-y-1">
            <p><span className="font-medium">Examiner:</span> {data.examinerName}</p>
            <p><span className="font-medium">Subject:</span> {data.subject}</p>
            <p><span className="font-medium">Thesis:</span> {data.thesisTitle}</p>
          </div>
        </div>
      </div>
    );
  }

  // Only show the form if data exists and status is 0 (not submitted)
  if (!data || data.status !== 0) {
    return null; // This will be handled by the conditions above
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={20} />
          Back
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* University Header */}
        <div className="bg-white border border-gray-300 mb-6">
          {/* Title Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-600 text-white px-6 py-4">
            <div className="flex items-center gap-3">
              <GraduationCap size={24} />
              <h1 className="text-xl font-bold">Thesis Evaluation Report</h1>
            </div>
          </div>

          {/* Examiner Information */}
          <div className="p-6 border-b border-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-gray-600" />
                  <span className="font-semibold text-gray-800">{data?.examinerName}</span>
                </div>
                <div className="text-gray-600">
                  <p><span className="font-medium">Designation:</span> {data?.designation}</p>
                  <p><span className="font-medium">University:</span> {data?.university}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-gray-600">
                  <p><span className="font-medium">Subject:</span> {data?.subject}</p>
                  <p><span className="font-medium">Thesis Title:</span> {data?.thesisTitle}</p>
                </div>
                
              </div>
            </div>
          </div>

          {/* Evaluation Section */}
          <div className="p-6">
            {/* Upload Section */}
            <div className="mb-6">
              <div className="bg-blue-600 text-white px-4 py-3 mb-4 flex items-center gap-2">
                <Upload size={20} />
                <span className="font-semibold">UPLOAD EVALUATION REPORT</span>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="evaluationFile"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                  <Upload size={32} className="text-gray-400" />
                  <div>
                    <p className="text-gray-600 mb-1">
                      Upload Report (.pdf upto 10 MB. Please Upload Signed Copy of Report)
                    </p>
                    {evaluationFile ? (
                      <p className="text-green-600 font-medium">
                        Selected: {evaluationFile.name}
                      </p>
                    ) : (
                      <p className="text-red-500 text-sm">No file chosen</p>
                    )}
                  </div>
                  <label
                    htmlFor="evaluationFile"
                    className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded border cursor-pointer transition-colors"
                  >
                    Choose File
                  </label>
                </div>
              </div>
            </div>

            {/* Recommendation Section */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-4">Select Your Recommendation</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="recommendation"
                    value="award"
                    checked={recommendation === 'award'}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700">Award Ph.D. Degree</span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="recommendation"
                    value="revision"
                    checked={recommendation === 'revision'}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700">Revision of Thesis</span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="recommendation"
                    value="rejection"
                    checked={recommendation === 'rejection'}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700">Rejection of Thesis</span>
                </label>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks
                {recommendation === 'rejection' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter your remarks here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Declaration */}
            <div className="mb-6">
              <label className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <input
                  type="checkbox"
                  checked={isDeclarationChecked}
                  onChange={(e) => setIsDeclarationChecked(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  <strong>Declaration:</strong> I hereby declare that I have thoroughly evaluated the thesis
                  and my recommendation is based on the academic merit and quality of the research work.
                  I understand that this evaluation will be used for the final decision regarding the
                  award of Ph.D. degree.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="text-right">
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className={`px-8 py-3 rounded font-medium transition-colors flex items-center gap-2 ml-auto ${isSubmitDisabled
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {submitting ? (
                  <>
                    <Spin size="small" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Upload Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThesisEvaluationReport;