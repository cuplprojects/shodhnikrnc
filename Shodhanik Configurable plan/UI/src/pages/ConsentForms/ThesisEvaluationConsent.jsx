import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import consentService from '../../services/consentService.js';
import notification from '../../services/NotificationService';
import { getBaseURL } from '@/utils/getBaseURL';

const ThesisEvaluationConsent = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const notify = notification();
  const baseUrl = getBaseURL();
  const isDevEnv = import.meta.env.VITE_APP_STAGE === 'development' || import.meta.env.VITE_APP_STAGE === 'livetest'
  // Form state
  const [decision, setDecision] = useState(1); // 1 for accept, 2 for reject
  const [wantHardCopy, setWantHardCopy] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [consentData, setConsentData] = useState(null);
  const [error, setError] = useState(null);
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);

  // Validate token and fetch consent details on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Token is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await consentService.validateConsentToken(token);
        
        if (data) {
          setConsentData(data);
          
          // Check if already submitted (examinerStatus !== 0)
          if (data.examinerStatus !== 0) {
            setIsAlreadySubmitted(true);
          }
        }
      } catch (error) {
        console.error('Token validation error:', error);
        if (error.response?.status === 401) {
          setError('Invalid or expired token');
        } else {
          setError('Failed to validate token. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async () => {
    if (!token) {
      notify.error('Token is missing');
      return;
    }

    // Validate remarks for rejection
    if (decision === 2 && !remarks.trim()) {
      notify.warning('Please provide remarks when rejecting the request');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Prepare remarks - add hard copy info if checked
      let finalRemarks = remarks;
      if (wantHardCopy) {
        const hardCopyMessage = 'Hard copy of thesis is required.';
        finalRemarks = remarks.trim() 
          ? `${remarks}\n\n${hardCopyMessage}` 
          : hardCopyMessage;
      }

      // Prepare payload
      const payload = {
        token: token,
        decision: decision,
        remarks: finalRemarks,
        awardBaseUrl:isDevEnv ? `${baseUrl}/#/thesisevaluationreport` : `${baseUrl}/thesisevaluationreport`,
        summaryBaseUrl:isDevEnv ?  `${baseUrl}/#/thesissummary` :  `${baseUrl}/thesissummary`,
      };

      console.log('Submitting consent:', payload);

      const data = await consentService.submitConsent(payload);

      if (data) {
        notify.success(decision === 1 
          ? 'Request accepted successfully! You will receive all documents related to Thesis Evaluation in your Email Inbox.'
          : 'Request rejected successfully!'
        );
        
        // Update local state to show submitted status
        setIsAlreadySubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting consent:', error);
      if (error.response?.status === 401) {
        notify.error('Invalid or expired token. Please check your link.');
      } else {
        notify.error('Failed to submit consent. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="bg-white border border-gray-300 shadow-sm">
            <div className="bg-gray-700 text-white px-6 py-3">
              <h1 className="text-lg font-semibold">Thesis Evaluation Consent</h1>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Validating token...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-white border border-gray-300 shadow-sm">
            <div className="bg-gray-700 text-white px-6 py-3">
              <h1 className="text-lg font-semibold">Thesis Evaluation Consent</h1>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="text-red-600 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        )}

        {/* Already Submitted State */}
        {isAlreadySubmitted && !isLoading && !error && (
          <div className="bg-white border border-gray-300 shadow-sm">
            <div className="bg-gray-700 text-white px-6 py-3">
              <h1 className="text-lg font-semibold">Thesis Evaluation Consent</h1>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="text-green-600 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Submitted</h2>
              <p className="text-gray-600">You have already submitted your response for this consent request.</p>
            </div>
          </div>
        )}

        {/* Main Form - Only show if not loading, no error, and not already submitted */}
        {!isLoading && !error && !isAlreadySubmitted && consentData && (
          <div className="bg-white border border-gray-300 shadow-sm">
            {/* Header */}
            <div className="bg-gray-700 text-white px-6 py-3">
              <h1 className="text-lg font-semibold">Thesis Evaluation Consent</h1>
            </div>

            {/* Examiner Information */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="space-y-2">
                <p className="font-semibold text-gray-900 text-lg">{consentData.examinerName || 'N/A'}</p>
                <p className="text-gray-600">{consentData.designation || 'N/A'}, {consentData.university || 'N/A'}</p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-700">Subject :</span> {consentData.subject || 'N/A'}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-700">Title/Topic :</span> {consentData.thesisTitle || 'N/A'}
                </p>
              </div>
            </div>

            {/* Response Section Header */}
            <div className="bg-blue-600 text-white px-6 py-2 text-center">
              <h2 className="font-semibold">RESPOND YOUR DECISION FOR EVALUATION REQUEST</h2>
            </div>

            {/* Decision Form */}
            <div className="px-6 py-4">
              {/* Select Your Decision */}
              <div className="mb-4">
                <p className="font-medium text-gray-900 mb-3">Select Your Decision</p>
                <div className="flex items-center gap-8">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value={1}
                      checked={decision === 1}
                      onChange={(e) => setDecision(parseInt(e.target.value))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-blue-600">Accept Request</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value={2}
                      checked={decision === 2}
                      onChange={(e) => setDecision(parseInt(e.target.value))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-blue-600">Reject Request</span>
                  </label>
                </div>
              </div>

              {/* Hard Copy Checkbox */}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantHardCopy}
                    onChange={(e) => setWantHardCopy(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-blue-600 font-medium">Check this Checkbox if you want hard copy of thesis</span>
                </label>
              </div>

              {/* Remarks */}
              <div className="mb-4">
                <label className="block font-medium text-gray-900 mb-2">
                  Remarks {decision === 2 && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={decision === 2 ? "Please provide reason for rejection..." : "Enter your remarks here..."}
                  required={decision === 2}
                />
                {decision === 2 && !remarks.trim() && (
                  <p className="text-red-500 text-sm mt-1">Remarks are required when rejecting the request</p>
                )}
              </div>

              {/* Info Message */}
              <div className="mb-4">
                <p className="text-red-600 font-medium">
                  After Accepting this Request, You will received All document related to Thesis Evaluation in your Email Inbox.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (decision === 2 && !remarks.trim())}
                  className={`px-6 py-2 rounded font-medium transition-colors ${
                    isSubmitting || (decision === 2 && !remarks.trim())
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThesisEvaluationConsent;