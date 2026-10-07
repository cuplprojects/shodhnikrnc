import { useState, useEffect } from 'react';
import { 
  FileText, 
  User, 
  Calendar, 
  Download, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Eye
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import { getBaseServerURL } from '@/utils/getBaseApiURL';
import getBaseFileURL from '@/utils/getBaseFileUrl'

const ProgressReportApproval = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, getSupId } = useSupervisorAuthStore();
  const [progressReports, setProgressReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const baseFileURL = getBaseFileURL();
  const [error, setError] = useState(null);
  
  // Get status from URL parameters, default to 0 (pending) if not provided
  const statusParam = searchParams.get('status') || '0';

  const handleStatusChange = (newStatus) => {
    setSearchParams({ status: newStatus });
  };

  // Fetch progress reports from API
  useEffect(() => {
    const fetchProgressReports = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const supervisorId = getSupId();
        if (!supervisorId) {
          setError('Supervisor ID not found');
          return;
        }

        // Fetch progress reports with status from URL parameter
        const response = await API.get(`/ProgressReports/ProgressReport/${supervisorId}?status=${statusParam}`);
        
        if (response.data && Array.isArray(response.data)) {
          // Transform API data to match our component structure
          const transformedReports = response.data.map((report, index) => {
            return {
              id: index + 1,
              prid: report.prid,
              sid: report.sid,
              prTitle: report.prTitle || `Progress Report ${report.prid || index + 1}`,
              lastDate: report.lastDate,
              rmsId: `${report.permUserName}`,
              scholarName: report.name || 'N/A',
              supervisorName: report.fullName || report.supervisorName || 'N/A',
              department: report.departmentName || 'N/A',
              admissionSession: report.year || new Date().getFullYear().toString(),
              mobile: report.phoneNumber || 'N/A',
              email: report.email || 'N/A',
              uploadedDate: report.uploadDate ? new Date(report.uploadDate).toLocaleString() : 'N/A',
              reportLink: report.reportFilePath || '#',
              profilePicture: report.profilePicture || report.path || null,
              status: report.isApprovedbySupervisor === 1 ? 'Approved' : 
                     report.isApprovedbySupervisor === 2 ? 'Rejected' : 'Pending',
              supervisorComments: report.supervisorComments,
              isApprovedbySupervisor: report.isApprovedbySupervisor,
              originalData: report
            };
          });
          
          setProgressReports(transformedReports);
        } else {
          setProgressReports([]);
        }
      } catch (err) {
        console.error('Error fetching progress reports:', err);
        setError('Failed to fetch progress reports. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProgressReports();
  }, [getSupId, user, statusParam]);

  const handleViewReport = (report) => {
    navigate('/supervisor-dashboard/progressreport-approval/view', { 
      state: { reportData: report, statusParam } 
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Progress Report Approval</h1>
          <p className="text-gray-600">
            Review and approve student progress reports
            {statusParam === '0' && ' - Showing Pending'}
            {statusParam === '1' && ' - Showing Approved'}
            {statusParam === '2' && ' - Showing Rejected'}
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => handleStatusChange('0')}
          className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            statusParam === '0'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Pending Reports
        </button>
        <button
          onClick={() => handleStatusChange('1')}
          className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            statusParam === '1'
              ? 'border-green-600 text-green-600 bg-green-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Approved Reports
        </button>
        <button
          onClick={() => handleStatusChange('2')}
          className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            statusParam === '2'
              ? 'border-red-600 text-red-600 bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Rejected Reports
        </button>
      </div>

      {/* Progress Reports Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {progressReports.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {statusParam === '0' ? 'Pending' : statusParam === '1' ? 'Approved' : 'Rejected'} Progress Reports Found
            </h3>
            <p className="text-gray-500">
              {statusParam === '0' 
                ? 'There are no progress reports pending approval.' 
                : statusParam === '1' 
                ? 'No approved progress reports found.'
                : 'No rejected progress reports found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scholar Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {progressReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                     <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
  {(report.profilePicture || report.originalData?.profilePicture || report.originalData?.path) ? (
    <img 
      src={`${baseFileURL}/${report.profilePicture || report.originalData?.profilePicture || report.originalData?.path}`} 
      alt="Scholar Avatar" 
      className="w-full h-full object-cover"
      onError={(e) => {
        console.log('Grid image failed to load:', e.target.src);
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
  ) : null}
  <User size={20} className={`text-blue-600 ${(report.profilePicture || report.originalData?.profilePicture || report.originalData?.path) ? 'hidden' : ''}`} />
</div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{report.scholarName}</div>
                        <div className="text-sm text-gray-500">Shodhanik ID: {report.rmsId}</div>
                        <div className="text-sm text-gray-500">{report.email}</div>
                        <div className="text-sm text-gray-500">{report.mobile}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{report.department}</div>
                    <div className="text-sm text-gray-500">Session: {report.admissionSession}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-blue-700">{report.prTitle}</div>
                    {report.lastDate && (
                      <div className="text-xs text-gray-500">
                        Last Date: {new Date(report.lastDate).toLocaleDateString('en-GB')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <Calendar size={16} />
                      {report.uploadedDate}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      report.status === 'Pending' 
                        ? 'bg-yellow-100 text-yellow-800'
                        : report.status === 'Approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {report.status === 'Pending' ? (
                        <button
                          onClick={() => handleViewReport(report)}
                          className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition-colors font-medium shadow-sm"
                        >
                          Verify & Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewReport(report)}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors font-medium shadow-sm"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

    </div>
  );
};

export default ProgressReportApproval;