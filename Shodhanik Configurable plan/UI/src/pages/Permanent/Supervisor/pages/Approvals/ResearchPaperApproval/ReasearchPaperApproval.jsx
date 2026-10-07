import { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  FileText, 
  ArrowLeft,
  BookOpen
} from 'lucide-react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '@/services/API';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import { getBaseServerURL } from '@/utils/getBaseApiURL';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const ReasearchPaperApproval = () => {
  const navigate = useNavigate();
  const { user, getSupId } = useSupervisorAuthStore();
  const [researchPapers, setResearchPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
   const baseFileURL = getBaseFileURL();

  // Get status from URL parameters, default to 0 (pending) if not provided
  const statusParam = searchParams.get('status') || '0';

  // Fetch research papers from API
  useEffect(() => {
    const fetchResearchPapers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const supervisorId = getSupId();
        if (!supervisorId) {
          setError('Supervisor ID not found');
          return;
        }

        // Fetch research papers with status from URL parameter
        const response = await API.get(`/ScholarResearch/ResearchReport/${supervisorId}?status=${statusParam}`);
        
        if (response.data && Array.isArray(response.data)) {
          // Transform API data to match our component structure
          const transformedPapers = response.data.map((paper, index) => {
            // Extract filename from uploadPaper for display
            const fileName = paper.uploadPaper ? 
              paper.uploadPaper.split('/').pop().replace(/^paper_\d+_\d+_/, '') : 
              'Research Paper';
            
            return {
              id: index + 1, // Using index as ID since API doesn't provide unique ID
              prid: paper.prid || index + 1, // Add prid for API calls if available
              sid: paper.sid,
              rmsId: `${paper.permUserName}`, // Assuming RMS ID format
              scholarName: paper.name || 'N/A', // Fixed: was using wrong field name
              supervisorName: paper.supervisorName || 'N/A',
              department: paper.departmentName || 'N/A',
              admissionSession: paper.year || new Date().getFullYear().toString(),
              mobile: paper.phoneNumber || 'N/A',
              email: paper.email || 'N/A',
              uploadedDate: paper.createdAt || 'N/A',
              paperLink: paper.uploadPaper || '#',
              paperTitle: paper.titleOfPaper || fileName,
              journalName: paper.nameOfJournal || 'N/A',
              journalType: paper.listedIn || 'N/A',
              impactFactor: paper.impactFactor || 'N/A',
              citations: paper.citations || 'N/A',
              webUrl: paper.webUrl || '#',
              issNo: paper.issNo || 'N/A',
              authorName: paper.authorNames || paper.authorName || [],
              profilePicture: paper.profilePicture || paper.path || null, // Add profile picture field
              status: paper.status === 0 ? 'Pending' : 
                     paper.status === 1 ? 'Approved' : 'Rejected',
              remarks: paper.remarks,
              pageNo: paper.page || 'N/A',
              volumeNo: paper.volume || 'N/A',
              ugcNo: paper.ugcListNo || 'N/A',
              // Store original paper data for updates
              originalData: paper
            };
          });
          
          setResearchPapers(transformedPapers);
        } else {
          setResearchPapers([]);
        }
      } catch (err) {
        console.error('Error fetching research papers:', err);
        setError('Failed to fetch research papers. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchResearchPapers();
  }, [getSupId, user, statusParam]);

  const handleViewPaper = (paper) => {
    navigate('/supervisor-dashboard/research-approval/view', { 
      state: { paperData: paper } 
    });
  };

  const handleViewPDF = (paper) => {
    if (paper?.paperLink && paper.paperLink !== '#') {
      const serverURL = getBaseServerURL();
      const fullURL = `${serverURL}/${paper.paperLink}`;
      console.log('Opening PDF URL:', fullURL); // Debug log
      window.open(fullURL, '_blank');
    } else {
      notify.warning('Paper file not available');
    }
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
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
      
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Research Paper Approval</h1>
          <p className="text-gray-600">
            Review and approve research paper submissions
            {statusParam === '0' && ' - Showing Pending'}
            {statusParam === '1' && ' - Showing Approved'}
            {statusParam === '2' && ' - Showing Rejected'}
          </p>
        </div>
      </div>

      {/* Research Papers Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {researchPapers.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {statusParam === '0' ? 'Pending' : statusParam === '1' ? 'Approved' : 'Rejected'} Research Papers Found
            </h3>
            <p className="text-gray-500">
              {statusParam === '0' 
                ? 'There are no research papers pending approval.' 
                : statusParam === '1' 
                ? 'No approved research papers found.'
                : 'No rejected research papers found.'}
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
                  Paper Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Journal Information
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted Date
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
              {researchPapers.map((paper) => (
                <tr key={paper.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
                        {(paper.profilePicture || paper.originalData?.profilePicture || paper.originalData?.path) ? (
                          <img 
                            src={`${baseFileURL}/${paper.profilePicture || paper.originalData?.profilePicture || paper.originalData?.path}`} 
                            alt="Scholar Avatar" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.log('Grid image failed to load:', e.target.src);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <User size={20} className={`text-green-600 ${(paper.profilePicture || paper.originalData?.profilePicture || paper.originalData?.path) ? 'hidden' : ''}`} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{paper.scholarName}</div>
                        <div className="text-sm text-gray-500">Shodhanik ID: {paper.rmsId}</div>
                        <div className="text-sm text-gray-500">{paper.departmentName}</div>
                        <div className="text-sm text-gray-500">{paper.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 mb-1">{paper.paperTitle}</div>
                    <div className="text-sm text-gray-500">Listed In:{paper.listedIn}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{paper.journalName}</div>
                    <div className="text-sm text-gray-500">Citations:{paper.citations}</div>
                    <div className="text-sm text-gray-500">Impact Factor: {paper.impactFactor}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <Calendar size={16} />
                      {paper.uploadedDate}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      paper.status === 'Pending' 
                        ? 'bg-yellow-100 text-yellow-800'
                        : paper.status === 'Forwarded to DoR'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {paper.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {paper.status === 'Pending' && (
                        <button
                          onClick={() => handleViewPaper(paper)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Verify
                        </button>
                      )}
                      {statusParam !== '0' && (
                        <button
                          onClick={() => handleViewPaper(paper)}
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

export default ReasearchPaperApproval;