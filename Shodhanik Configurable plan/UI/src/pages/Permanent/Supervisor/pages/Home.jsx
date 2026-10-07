import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  GraduationCap, 
  BookOpen, 
  Award, 
  FileText, 
  Users,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';

const Home = () => {
  const { user, getSupId } = useSupervisorAuthStore();
  const supervisorId = getSupId();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for approval stats
  const [approvalStats, setApprovalStats] = useState({
    progressReports: {
      pending: 0,
      approved: 0,
      rejected: 0
    },
    conferences: {
      pending: 0,
      approved: 0,
      rejected: 0
    },
    researchPapers: {
      pending: 0,
      approved: 0,
      rejected: 0
    }
  });

  // Fetch progress report counts from API
  useEffect(() => {
    const fetchApprovalCounts = async () => {
      try {
        if (!supervisorId) return;

        // Fetch progress report counts
        const progressResponse = await API.get(`/ProgressReports/ProgressReportCount/${supervisorId}`);
        
        // Fetch research paper counts
        const researchResponse = await API.get(`/ScholarResearch/ResearchReportCount/${supervisorId}`);
        
        setApprovalStats(prev => ({
          ...prev,
          progressReports: {
            pending: progressResponse.data?.notViewed || 0,
            approved: progressResponse.data?.approved || 0,
            rejected: progressResponse.data?.rejected || 0
          },
          researchPapers: {
            pending: researchResponse.data?.notViewed || 0,
            approved: researchResponse.data?.approved || 0,
            rejected: researchResponse.data?.rejected || 0
          }
        }));
      } catch (error) {
        console.error('Error fetching approval counts:', error);
      }
    };

     const fetchConferenceReportCounts = async () => {
      try {
        if (!supervisorId) return;

        const response = await API.get(`ScholarConferences/ConferenceReportCount/${supervisorId}`);
        
        if (response.data) {
          setApprovalStats(prev => ({
            ...prev,
            conferences: {
              pending: response.data.notViewed || 0,
              approved: response.data.approved || 0,
              rejected: response.data.rejected || 0
            }
          }));
        }
      } catch (error) {
        console.error('Error fetching progress report counts:', error);
      }
    };

fetchConferenceReportCounts();
    fetchApprovalCounts();
  }, [getSupId]);

  const handleProgressReportClick = (status = null) => {
    if (status !== null) {
      navigate(`/supervisor-dashboard/progressreport-approval?status=${status}`);
    } else {
      navigate('/supervisor-dashboard/progressreport-approval');
    }
  };

  const handleConferenceClick = (status = null) => {
    if (status !== null) {
      navigate(`/supervisor-dashboard/conference-approval?status=${status}`);
    } else {
      navigate('/supervisor-dashboard/conference-approval');
    }
  };

  const handleResearchPaperClick = (status = null) => {
    if (status !== null) {
      navigate(`/supervisor-dashboard/research-approval?status=${status}`);
    } else {
      navigate('/supervisor-dashboard/research-approval');
    }
  };

  // Get supervisor data from auth store
  const supervisorData = {
    name: user?.username || user?.name || 'Supervisor',
    email: user?.email || 'Not provided',
    mobile: user?.mobile || 'Not provided',
    designation: user?.designation || 'Supervisor',
    department: user?.department || 'Not specified',
    supId: user?.supId || user?.SupId || 'N/A'
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

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Welcome to Shodhanik
        </h1>
        <p className="text-gray-600">
          Manage your academic profile, research activities, and supervision details
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">0</p>
              <p className="text-sm text-gray-600">PhD Students</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">0</p>
              <p className="text-sm text-gray-600">Publications</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <BookOpen size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">0</p>
              <p className="text-sm text-gray-600">Research Projects</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Award size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">0</p>
              <p className="text-sm text-gray-600">Awards</p>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Approvals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Progress Report Approval Card */}
          {/* <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div 
              className="flex items-center gap-4 mb-4 cursor-pointer"
              onClick={() => handleProgressReportClick()}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Progress Report Approval</h3>
                <p className="text-sm text-gray-600">Review and approve progress reports</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-yellow-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProgressReportClick(0);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Clock size={16} className="text-yellow-600" />
                  <span className="text-xl font-bold text-yellow-600">{approvalStats.progressReports?.pending || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Pending</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-green-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProgressReportClick(1);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-xl font-bold text-green-600">{approvalStats.progressReports?.approved || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Approved</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-red-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProgressReportClick(2)
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <XCircle size={16} className="text-red-600" />
                  <span className="text-xl font-bold text-red-600">{approvalStats.progressReports?.rejected || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Rejected</span>
              </div>
            </div>
          </div> */}

          {/* Conferences and Seminars Approval Card */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div 
              className="flex items-center gap-4 mb-4 cursor-pointer"
              onClick={() => handleConferenceClick()}
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users size={24} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Conferences & Seminars Approval</h3>
                <p className="text-sm text-gray-600">Approve conference and seminar requests</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-yellow-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConferenceClick(0);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Clock size={16} className="text-yellow-600" />
                  <span className="text-xl font-bold text-yellow-600">{approvalStats.conferences?.pending || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Pending</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-green-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConferenceClick(1);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-xl font-bold text-green-600">{approvalStats.conferences?.approved || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Approved</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-red-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConferenceClick(2)
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <XCircle size={16} className="text-red-600" />
                  <span className="text-xl font-bold text-red-600">{approvalStats.conferences?.rejected || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Rejected</span>
              </div>
            </div>
          </div>

          {/* Research Paper Approval Card */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div 
              className="flex items-center gap-4 mb-4 cursor-pointer"
              onClick={() => handleResearchPaperClick()}
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Research Paper Approval</h3>
                <p className="text-sm text-gray-600">Review and approve research papers</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-yellow-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResearchPaperClick(0);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Clock size={16} className="text-yellow-600" />
                  <span className="text-xl font-bold text-yellow-600">{approvalStats.researchPapers?.pending || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Pending</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-green-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResearchPaperClick(1);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-xl font-bold text-green-600">{approvalStats.researchPapers?.approved || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Approved</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-red-50 p-2 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResearchPaperClick(2);
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <XCircle size={16} className="text-red-600" />
                  <span className="text-xl font-bold text-red-600">{approvalStats.researchPapers?.rejected || 0}</span>
                </div>
                <span className="text-xs text-gray-600">Rejected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;