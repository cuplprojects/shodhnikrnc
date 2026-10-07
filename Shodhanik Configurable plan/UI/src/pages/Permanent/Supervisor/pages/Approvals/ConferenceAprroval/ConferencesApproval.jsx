import { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  MapPin, 
  ArrowLeft,
  FileText
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const ConferencesApproval = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, getSupId } = useSupervisorAuthStore();
  const baseFileURL = getBaseFileURL();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log(searchParams);

  // if(!searchParams){
  //   navigate('/supervisor-dashboard');
  //   return
  // }
  
  // Get status from URL parameters, default to 0 (pending) if not provided
  const statusParam = searchParams.get('status') || '0';
  
  // Store the current status in sessionStorage for breadcrumb navigation
  useEffect(() => {
    if (statusParam) {
      sessionStorage.setItem('conferenceApprovalStatus', statusParam);
    }
  }, [statusParam]);
  // Fetch conferences from API
  useEffect(() => {
    const fetchConferences = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const supervisorId = getSupId();
        if (!supervisorId) {
          setError('Supervisor ID not found');
          return;
        }

        // Fetch conferences with status from URL parameter
        const response = await API.get(`/ScholarConferences/ConferenceReport/${supervisorId}?status=${statusParam}`);
        
        if (response.data && Array.isArray(response.data)) {
          // Transform API data to match our component structure
          const transformedConferences = response.data.map((conference, index) => {
            return {
              id: conference.id,
              sid: conference.sid,
              rmsId: conference.permUserName || `SH${conference.sid}`,
              scholarName: conference.name || 'N/A',
              supervisorName: conference.supervisorName || 'N/A',
              email: conference.email || 'N/A',
              phoneNumber: conference.phoneNumber || 'N/A',
              department: conference.departmentName || 'N/A',
              admissionSession: conference.year || new Date().getFullYear().toString(),
              sponsoringAgency : conference.sponsoringAgency,
              // Conference details
              conferenceName: conference.nameOfConference || 'N/A',
              conferenceLocation: conference.place || 'N/A',
              conferenceLevel: conference.levelOfConference || 'N/A',
              organizedBy: conference.organizedBy || 'N/A',
              startingDate: conference.startingDate ? new Date(conference.startingDate).toLocaleDateString() : 'N/A',
              endingDate: conference.endingDate ? new Date(conference.endingDate).toLocaleDateString() : 'N/A',
              conferenceDate: conference.startingDate && conference.endingDate 
                ? `${new Date(conference.startingDate).toLocaleDateString()} - ${new Date(conference.endingDate).toLocaleDateString()}`
                : 'N/A',
              
              // Paper details
              paperTitle: conference.titleOfPaper || 'N/A',
              authorNames: conference.authorNames ,
              
              // Files and status
              presentationCertificate: conference.presentationCertificate || null,
              profilePicture: conference.profilePicture || conference.path || null, // Add profile picture field
              
              // Status and approval
              conferenceStatus: conference.conferenceStatus || 0, // 0: pending, 1: approved, 2: rejected
              status: conference.conferenceStatus === 0 ? 'Pending' : 
                     conference.conferenceStatus === 1 ? 'Approved' : 'Rejected',
              remarks: conference.remarks || '',
              
              // Dates
              submittedDate: new Date().toLocaleDateString(), // API doesn't provide submission date
              
              // Store original conference data for updates
              originalData: conference
            };
          });
          
          setConferences(transformedConferences);
        } else {
          setConferences([]);
        }
      } catch (err) {
        console.error('Error fetching conferences:', err);
        setError('Failed to fetch conferences. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchConferences();
  }, [getSupId, user, statusParam]);

  const handleViewConference = (conference) => {
    // Get current status from URL params to preserve it
    const currentStatus = searchParams.get('status') || '0';
    navigate('/supervisor-dashboard/conference-approval/view', { 
      state: { 
        conferenceData: conference,
        statusParam: currentStatus
      } 
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
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Conference Approval</h1>
          <p className="text-gray-600">
            Review and approve student conference requests
            {statusParam === '0' && ' - Showing Pending'}
            {statusParam === '1' && ' - Showing Approved'}
            {statusParam === '2' && ' - Showing Rejected'}
          </p>
        </div>
      </div>

      {/* Conferences Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {conferences.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {statusParam === '0' ? 'Pending' : statusParam === '1' ? 'Approved' : 'Rejected'} Conferences Found
            </h3>
            <p className="text-gray-500">
              {statusParam === '0' 
                ? 'There are no conference requests pending approval.' 
                : statusParam === '1' 
                ? 'No approved conference requests found.'
                : 'No rejected conference requests found.'}
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
                  Conference Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title Of Seminar
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
              {conferences.map((conference) => (
                <tr key={conference.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden">
                        {(conference.profilePicture || conference.originalData?.profilePicture || conference.originalData?.path) ? (
                          <img 
                            src={`${baseFileURL}/${conference.profilePicture || conference.originalData?.profilePicture || conference.originalData?.path}`} 
                            alt="Scholar Avatar" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.log('Grid image failed to load:', e.target.src);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <User size={20} className={`text-purple-600 ${(conference.profilePicture || conference.originalData?.profilePicture || conference.originalData?.path) ? 'hidden' : ''}`} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{conference.scholarName}</div>
                        <div className="text-sm text-gray-500">Shodhanik ID: {conference.rmsId}</div>
                        <div className="text-sm text-gray-500">{conference.email}</div>
                        <div className="text-sm text-gray-500">{conference.phoneNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{conference.department}</div>
                    <div className="text-sm text-gray-500">Session: {conference.admissionSession}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{conference.conferenceName}</div>
                    <div className="text-sm text-gray-600 mt-1">Level: {conference.conferenceLevel}</div>
                    <div className="text-sm text-gray-600">Organized by: {conference.organizedBy}</div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <MapPin size={14} />
                      {conference.conferenceLocation}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <Calendar size={14} />
                      {conference.conferenceDate}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{conference.paperTitle}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Authors: {Array.isArray(conference.authorNames) 
                        ? conference.authorNames.join(', ') 
                        : conference.authorNames || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      conference.status === 'Pending' 
                        ? 'bg-yellow-100 text-yellow-800'
                        : conference.status === 'Approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {conference.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {statusParam === '0' && conference.status === 'Pending' && (
                        <button
                          onClick={() => handleViewConference(conference)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Verify
                        </button>
                      )}
                      {statusParam !== '0' && (
                        <button
                          onClick={() => handleViewConference(conference)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
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

export default ConferencesApproval;