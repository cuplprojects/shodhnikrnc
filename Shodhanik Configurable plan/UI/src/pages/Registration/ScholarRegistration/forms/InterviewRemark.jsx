import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Calendar, User, ChevronRight } from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';
import notification from '@/services/NotificationService';
import API from '@/services/API';

const InterviewRemark = () => {
  const { getSId } = useScholarRegAuthStore();
  const { saveStep, getIsReadOnly } = useSteps();
  const navigate = useNavigate();
  const scholarId = getSId();
  const isReadOnly = getIsReadOnly ? getIsReadOnly(12) : false;
  
  // Auto-refresh steps from API on component load
  useStepRefresh();

  const [remarks, setRemarks] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch interview remarks
  useEffect(() => {
    const fetchRemarks = async () => {
      try {
        setLoading(true);
        
        // Mock data - replace with actual API call
        const response = await API.get(`/Scholars/ApplicationStatus/${scholarId}`);
        console.log(response.data);
        
        // Use actual API response data
        setRemarks(response.data);

      } catch (error) {
        console.error('Error fetching interview remarks:', error);
        const notify = notification();
        notify.error('Failed to load interview remarks');
      } finally {
        setLoading(false);
      }
    };

    if (scholarId) {
      fetchRemarks();
    }
  }, [scholarId]);

  // Handle save and next
  const handleSaveAndNext = async () => {
    try {
      // Save step 8 (Interview Remarks) - this calls the API automatically
      const stepSaved = await saveStep(8);
      if (stepSaved) {
        // Navigate to next step
        navigate('/register-scholar/upload-documents-counselling');
      }
    } catch (error) {
      console.error('Error saving interview remarks step:', error);
      const notify = notification();
      notify.error('Failed to save step. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-5 flex justify-center items-center min-h-64">
        <div className="text-lg">Loading interview remarks...</div>
      </div>
    );
  }

  if (!remarks) {
    return (
      <div className="p-4 md:p-5">
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
          <div className="text-center py-8">
            <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Interview Remarks Available</h3>
            <p className="text-sm text-gray-500">
              Interview remarks will be available after your interview is completed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5">
      <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-[#1e40af]">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="text-blue-600" size={20} />
          </div>
          <h2 className="text-xl font-bold text-[#111827] font-inter">
            Interview Remarks
          </h2>
        </div>

        {/* Interview Date */}
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-700">Interview Date & Time</h3>
          </div>
          <p className="text-base text-gray-900">
            {new Date(remarks.interviewDate).toLocaleDateString('en-GB', { 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        {/* Interview Result */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-base font-semibold text-blue-900 mb-3">Interview Result</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            {remarks.interviewResult}
          </p>
        </div>

        {/* Note */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> These remarks are provided by the interview panel. 
            If you have any queries regarding the interview results, please contact the admission office.
          </p>
        </div>

        {/* Save and Next Button */}
        <div className="flex justify-end pt-3 border-t border-[#e5e7eb] mt-6">
          <button
            onClick={handleSaveAndNext}
            disabled={isReadOnly}
            className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 text-white py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:from-green-700 hover:to-green-600 active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReadOnly ? 'Read Only' : 'Save & Next'}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewRemark;