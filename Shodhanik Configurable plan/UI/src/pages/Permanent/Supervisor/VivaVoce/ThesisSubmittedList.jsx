import { useState, useEffect } from 'react';
import { 
  User, 
  Eye,
  FileText,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';

const ThesisSubmittedList = () => {
  const navigate = useNavigate();
  const { user } = useSupervisorAuthStore();
  const [thesisSubmissions, setThesisSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch thesis submissions from API
  useEffect(() => {
    const fetchThesisSubmissions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch thesis submissions from the new API endpoint
        const response = await API.get('/Viva/ThesisSubmitted');
        
        if (response.data && Array.isArray(response.data)) {
          // Filter submissions by status = 0 (for Supervisor)
          const filteredSubmissions = response.data.filter(submission => submission.status === 0);
          
          // Transform API data to match our component structure
          const transformedSubmissions = filteredSubmissions.map((submission, index) => {
            return {
              id: submission.sid || index + 1,
              sid: submission.sid,
              shodhanikId: submission.permUserName,
              candidateName: submission.name,
              department: submission.subjectName, // Using subjectName as department
              subject: submission.subjectName,
              thesisTitle: submission.thesis_Title,
              submissionDate: submission.uploadDate ? 
                new Date(submission.uploadDate).toLocaleDateString() : 
                new Date().toLocaleDateString(),
              profilePicture: null, // Not provided in API response
              email: submission.email,
              mobile: submission.phoneNumber,
              admissionSession: submission.year,
              subject_ID: submission.subject_ID,
              // Store original submission data
              originalData: submission
            };
          });
          
          setThesisSubmissions(transformedSubmissions);
        } else {
          setThesisSubmissions([]);
        }
      } catch (err) {
        console.error('Error fetching thesis submissions:', err);
        setError('Failed to fetch thesis submissions. Please try again later.');
        setThesisSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchThesisSubmissions();
  }, [user]);

  const handleViewExaminer = (submission) => {
    // Navigate to examiner page with submission data in state
    navigate('/supervisor-dashboard/examinerlist', {
      state: { 
        submissionData: submission 
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
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <GraduationCap size={24} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Thesis Submitted List</h1>
          <p className="text-gray-600">
            View candidates who have submitted their thesis and are pending initial review
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{thesisSubmissions.length}</p>
              <p className="text-sm text-gray-600">Pending Submissions</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Eye size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{thesisSubmissions.length}</p>
              <p className="text-sm text-gray-600">Awaiting Review</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <User size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {new Set(thesisSubmissions.map(s => s.department)).size}
              </p>
              <p className="text-sm text-gray-600">Departments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Thesis Submissions Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {thesisSubmissions.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Thesis Submissions Found
            </h3>
            <p className="text-gray-500">
              There are no thesis submissions available for review at this time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shodhanik ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thesis Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {thesisSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{submission.candidateName}</div>
                          <div className="text-sm text-gray-500">{submission.email}</div>
                          <div className="text-sm text-gray-500">{submission.mobile}</div>
                          <div className="text-sm text-gray-500">Session: {submission.admissionSession}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-blue-600">{submission.shodhanikId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{submission.department}</div>
                      <div className="text-sm text-gray-500">{submission.subject}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={submission.thesisTitle}>
                        {submission.thesisTitle}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{submission.submissionDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewExaminer(submission)}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ThesisSubmittedList;