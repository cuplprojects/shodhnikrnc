import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import API from '@/services/API';
import workflowService from '@/services/workflowService';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';

const STATUS_CONFIG = {
  1: { text: 'Approved', color: 'text-green-600', Icon: CheckCircle },
  2: { text: 'Rejected', color: 'text-red-600', Icon: AlertTriangle },
  0: { text: 'Under Review', color: 'text-yellow-600', Icon: Clock },
  default: { text: 'Pending', color: 'text-gray-600', Icon: Clock },
};

const getStatusMeta = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.default;

const formatDate = (dateString) => {
  if (!dateString) return 'Not available';
  try {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

const StatusOfApplication = () => {
  const [screeningData, setScreeningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();

  useEffect(() => {
    fetchScreeningData();
  }, []);

  const fetchScreeningData = async () => {
    try {
      setLoading(true);
      const [screeningRes, workflowRes] = await Promise.allSettled([
        API.get(`/SupervisorScreening/Screening?supId=${supId}`),
        workflowService.getEntityHistory('Supervisor', supId)
      ]);

      const data = screeningRes.status === 'fulfilled' ? screeningRes.value?.data : {};
      const wf = workflowRes.status === 'fulfilled' ? workflowRes.value?.data : null;
      const screening = { ...(data?.screening || {}) };

      // Overlay workflow logs if present
      if (wf?.logs) {
        wf.logs.forEach((log) => {
          const step = log.stepOrder;
          if (step >= 1 && step <= 6) {
            screening[`screening${step}Status`] = log.action === 'Approve' ? 1 : 2;
            screening[`screening${step}Time`] = log.actionTimestamp;
            screening[`user${step}`] = `Admin #${log.actionByUserID}`;
            screening[`screening${step}Remark1`] = log.comments || '';
          }
        });
      }

      const eligibility =
        wf?.instance?.status === 'Approved' ? 'Eligible' :
        wf?.instance?.status === 'Rejected' ? 'Not Eligible' :
        data?.eligibility || 'Pending';

      setScreeningData({ ...data, screening, eligibility });
      setError(null);
    } catch (err) {
      console.error('Error fetching screening data:', err);
      setError('Failed to load application status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 flex justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading application status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-red-600">
            <AlertTriangle className="text-red-600" size={24} />
            <h2 className="text-xl font-semibold text-red-600">Error Loading Status</h2>
          </div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const isEligible = screeningData?.eligibility === 'Eligible';
  const isNotEligible = screeningData?.eligibility === 'Not Eligible';
  const eligibilityColor = isEligible ? 'text-green-600' : isNotEligible ? 'text-red-600' : 'text-yellow-600';

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-blue-600">
          <FileText className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-blue-600">Status of Application</h2>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Form Status */}
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-700 min-w-40">Form Status :</span>
            <span className="text-gray-800">Successfully Submitted</span>
          </div>

          {/* Screening Details */}
          {screeningData?.screening && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-800 border-b pb-2">Screening Details</h3>

              {[1, 2, 3, 4, 5, 6].map((level) => {
                const status = screeningData.screening[`screening${level}Status`];
                if (status === null || status === undefined) return null;

                const { text, color, Icon } = getStatusMeta(status);
                const time = screeningData.screening[`screening${level}Time`];
                const reviewer = screeningData.screening[`user${level}`];
                const remarks = screeningData.screening[`screening${level}Remark1`];

                return (
                  <div key={level} className={`space-y-2 ${level > 1 ? 'border-t pt-4' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700 min-w-40">Screening Level {level} :</span>
                      <div className="flex items-center gap-2">
                        <Icon className={color} size={20} />
                        <span className={`font-medium ${color}`}>{text}</span>
                      </div>
                    </div>

                    {time && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-600 min-w-40">Screen Date :</span>
                        <span className="text-gray-700">{formatDate(time)}</span>
                      </div>
                    )}

                    {reviewer && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-600 min-w-40">Screened By :</span>
                        <span className="text-gray-700">{reviewer}</span>
                      </div>
                    )}

                    {remarks && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-600 min-w-40">Remarks :</span>
                        <span className="text-gray-700">{remarks}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Final Eligibility Status */}
          {screeningData?.eligibility && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 min-w-40">Final Eligibility Status :</span>
                <div className="flex items-center gap-2">
                  {isEligible ? (
                    <CheckCircle className="text-green-600" size={20} />
                  ) : isNotEligible ? (
                    <AlertTriangle className="text-red-600" size={20} />
                  ) : (
                    <Clock className="text-yellow-600" size={20} />
                  )}
                  <span className={`font-bold text-lg ${eligibilityColor}`}>
                    {screeningData.eligibility}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Processing message when no data */}
          {!screeningData && (
            <div className="bg-yellow-50 rounded-lg p-4 flex items-center gap-2">
              <Clock className="text-yellow-600" size={20} />
              <span className="text-yellow-800 font-medium">
                Your application is being processed. Please check back later for updates.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusOfApplication;