import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import API from '@/services/API';
import dayjs from 'dayjs';

const StatusOfApplication = () => {
  const { getSId } = useScholarRegAuthStore();
  const scholarId = getSId();

  const [statusData, setStatusData] = useState({
    formStatus: 'Successfully Submitted',
    submissionDate: '',
    applicationId: '',
    name: '',
    email: '',
    phoneNumber: '',
    decisionStatus: null,
    statusText: '',
    interviewDate: '',
    interviewResult: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scholarId) {
      fetchScholarStatus();
      fetchApplicationStatus();
    }
  }, [scholarId]);

  const fetchApplicationStatus = async () => {
    try {
      const response = await API.get(`/ScholarApplicationStatus/${scholarId}`);
      if (response.data && response.data.step_5At) {
        setStatusData(prev => ({
          ...prev,
          submissionDate: dayjs(response.data.step_5At).format('DD/MM/YYYY'),
        }));
      }
    } catch (error) {
      console.error('Error fetching application status:', error);
    }
  };

  const fetchScholarStatus = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/Scholars/${scholarId}`);
      
      if (response.data) {
        const data = response.data;
        setStatusData(prev => ({
          ...prev,
          applicationId: data.applicationNo,
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          decisionStatus: data.decisionStatus,
          statusText: getStatusText(data.decisionStatus),
          interviewDate: data.interviewDate || '',
          interviewResult: getInterviewResult(data.decisionStatus),
        }));
      }
    } catch (error) {
      console.error('Error fetching scholar status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (decisionStatus) => {
    switch (decisionStatus) {
      case 1:
        return 'Under Review';
      case 2:
        return 'Approved';
      case 3:
        return 'Rejected';
      case 4:
        return 'Pending Interview';
      case 5:
        return 'Interview Scheduled';
      case 10:
        return 'Fee Submitted';
      case 13:
        return 'Approved';
      default:
        return 'pending';
    }
  };

  const getInterviewResult = (decisionStatus) => {
    switch (decisionStatus) {
      case 2:
        return 'Pass';
      case 3:
        return 'Rejected';
      case 4:
        return 'Pending';
      case 5:
        return 'Scheduled';
      case 6:
        return 'Pass';
      case 13:
        return 'Pass';
      default:
        return 'pending';
    }
  };

  const formatDateOnly = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateVal.trim())) {
      return dateVal.trim();
    }
    const d = dayjs(dateVal);
    if (!d.isValid() || d.year() <= 1900) return '';
    return d.format('DD/MM/YYYY');
  };

  if (loading) {
    return (
      <div className="p-4 md:p-5">
        <div className="bg-white">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b-2 border-[#1e40af]">
            <GraduationCap size={24} className="text-[#1e40af]" />
            <h2 className="text-xl font-bold text-[#1e40af] font-inter">Status of Application</h2>
          </div>
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500">Loading application status...</div>
          </div>
        </div>
      </div>
    );
  }

  const formattedInterviewDate = formatDateOnly(statusData.interviewDate);

  return (
    <div className="p-4 md:p-5">
      <div className="bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8 pb-3 border-b-2 border-[#1e40af]">
          <GraduationCap size={24} className="text-[#1e40af]" />
          <h2 className="text-xl font-bold text-[#1e40af] font-inter">Status of Application</h2>
        </div>

        {/* Status Items */}
        <div className="space-y-8">
          {/* Scholar Information */}
          {statusData.applicationId && (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Application ID</span>
                <span className="text-base text-[#6b7280]">:</span>
                <span className="text-base text-[#6b7280]">{statusData.applicationId}</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Name</span>
                <span className="text-base text-[#6b7280]">:</span>
                <span className="text-base text-[#6b7280]">{statusData.name}</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Email</span>
                <span className="text-base text-[#6b7280]">:</span>
                <span className="text-base text-[#6b7280]">{statusData.email}</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Phone Number</span>
                <span className="text-base text-[#6b7280]">:</span>
                <span className="text-base text-[#6b7280]">{statusData.phoneNumber}</span>
              </div>
            </>
          )}

          {/* Form Status */}
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Form Status</span>
            <span className="text-base text-[#6b7280]">:</span>
            <span className="text-base text-[#6b7280]">
              {statusData.formStatus}{statusData.submissionDate ? ` [Date : ${statusData.submissionDate}]` : ''}
            </span>
          </div>

          {/* Application Status */}
          {statusData.statusText && statusData.decisionStatus !== 2 && statusData.decisionStatus !== 13 && (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Application Status</span>
              <span className="text-base text-[#6b7280]">:</span>
              <span className={`text-base font-medium ${
                statusData.decisionStatus === 2 || statusData.decisionStatus === 13 ? 'text-green-600' : 
                statusData.decisionStatus === 3 ? 'text-red-600' : 
                statusData.decisionStatus === 4 ? 'text-blue-600' : 
                'text-[#6b7280]'
              }`}>
                {statusData.statusText}
              </span>
            </div>
          )}

          {/* Interview Date */}
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Interview Date</span>
            <span className="text-base text-[#6b7280]">:</span>
            <span className={`text-base ${formattedInterviewDate ? 'text-blue-600 font-medium' : 'text-[#6b7280]'}`}>
              {formattedInterviewDate || 'Not Scheduled'}
            </span>
          </div>

          {/* Interview Result */}
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-[#6b7280] min-w-[200px]">Interview Result</span>
            <span className="text-base text-[#6b7280]">:</span>
            <span className={`text-base ${
              statusData.decisionStatus === 2 || statusData.decisionStatus === 13 ? 'text-green-600 font-medium' : 
              statusData.decisionStatus === 3 ? 'text-red-600 font-medium' : 
              'text-[#6b7280]'
            }`}>
              {statusData.interviewResult}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusOfApplication;
