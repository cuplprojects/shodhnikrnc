import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '@/services/API';
import { getBaseServerURL } from '@/utils/getBaseApiURL';
import getBaseFileURL from '@/utils/getBaseFileUrl'
import notification from '@/services/NotificationService';
import PrintHeader from '@/components/cms/PrintHeader'

const ResearchPaperView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paperData = location.state?.paperData;
    const notify = notification();

  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isForwardedByHOD, setIsForwardedByHOD] = useState(false);
  const [isReadAndVerified, setIsReadAndVerified] = useState(false);
   const baseFileURL = getBaseFileURL();
console.log(paperData)

  // Check if paper is already processed (status 1 or 2)
  const isAlreadyProcessed = paperData?.originalData?.status === 1 || paperData?.originalData?.status === 2;
  const currentStatus = paperData?.originalData?.status === 1 ? 'Approved' : 
                       paperData?.originalData?.status === 2 ? 'Rejected' : 'Pending';
  const currentRemarks = paperData?.originalData?.remarks || paperData?.remarks || '';

  const handleViewPDF = () => {
    if (paperData?.paperLink && paperData.paperLink !== '#') {
      const serverURL = getBaseServerURL();
      const fullURL = `${serverURL}/${paperData.paperLink}`;
      console.log('Opening PDF URL:', fullURL); // Debug log
      window.open(fullURL, '_blank');
    } else {
     notify.warning('Paper file not available');
    }
  };

  const handleSubmit = async () => {
    if (status === '--Select--' || !status) {
     notify.warning('Please select a status');
      return;
    }
    
    if (status === 'Reject back to scholar' && !remarks.trim()) {
      notify.warning('Remarks are required for rejection');
      return;
    }

    if (!isForwardedByHOD || !isReadAndVerified) {
     notify.warning('Please check both verification boxes before submitting');
      return;
    }

    try {
      // Prepare the update data using multipart FormData
      const updateData = {
        researchStatus: status === 'Ok' ? 1 : 2,
        remarks: remarks || ''
      };

      // Make API call to update the research paper status using PATCH
 const response = await API.patch(`/ScholarResearch/UpdateResearchStatus/${ paperData?.originalData?.id}`, updateData);

      console.log('API Response:', response);

      if (response.status === 200 || response.status === 204) {
       notify.success(`Research paper ${status === 'Ok' ? 'approved' : 'rejected'} successfully!`);
        // Navigate back to approval page
        navigate('/supervisor/research-approval');
      }
    } catch (error) {
      console.error('Error updating research paper status:', error);
      console.error('Error details:', error.response?.data);
     notify.error(`Failed to update research paper status: ${error.response?.data?.message || error.message}`);
    }
  };

  // Check if submit button should be disabled
  const isSubmitDisabled = !status || !isForwardedByHOD || !isReadAndVerified ||
    (status === 'Reject' && !remarks.trim());

  if (!paperData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">No research paper data found</p>
          <button
            onClick={() => navigate('/supervisor/research-approval')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Research Paper Approval
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => navigate('/supervisor-dashboard/research-approval')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={20} />
          Back to Research Paper Approval
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* University Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className='flex justify-center p-2'> 
             <PrintHeader/>
          </div>
         

          {/* Student Information Table */}
          <div className="p-0">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Admission Session :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.admissionSession}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Shodhanik ID : 
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.rmsId}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Department/Subject :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {paperData.department}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Supervisor Name :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    <span className="text-blue-600 underline">{paperData.supervisorName}</span>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Scholar Name :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {paperData.scholarName}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 text-center" rowSpan="3">
                    <div className="w-24 h-32 bg-gray-100 border border-gray-300 mx-auto flex items-center justify-center overflow-hidden">
                      {(paperData?.profilePicture || paperData?.originalData?.profilePicture || paperData?.originalData?.path) ? (
                        <img
                          src={`${baseFileURL}/${paperData?.profilePicture || paperData?.originalData?.profilePicture || paperData?.originalData?.path}`}
                          alt="Scholar Photo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Image failed to load:', e.target.src);
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div
                        className="text-xs text-gray-500 text-center p-2"
                        style={{ display: (paperData?.profilePicture || paperData?.originalData?.profilePicture || paperData?.originalData?.path) ? 'none' : 'block' }}
                      >
                        NOT AVAILABLE
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Mobile :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {paperData.mobile}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Email :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {paperData.email}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Research Paper Details Section */}
          <div className="p-4 border-t border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-3 bg-gray-100 px-3 py-2">
              Research Paper Details
            </h3>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Title :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {paperData.paperTitle || paperData.titleOfPaper || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Authors :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                                      {paperData.authorName}

                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Category :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.category || 'SCOPUS'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Journal :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.journalName || paperData.nameOfJournal || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    ISSN No. :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.issNo || 'N/A'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Year :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.year || new Date().getFullYear()}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Volume No. :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.volumeNo || 'N/A'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Page :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.pageNo || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Citations :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.citations || 'N/A'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Impact :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.impactFactor || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    UGC No. :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.journalType}
                  </td>
                   <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Web Url :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {paperData.webUrl && paperData.webUrl !== '#' ? (
                      <a 
                        href={paperData.webUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        Web Link
                      </a>
                    ) : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Paper File :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {paperData?.paperLink && paperData.paperLink !== '#' ? (
                      <button
                        onClick={handleViewPDF}
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        View Attachment
                      </button>
                    ) : (
                      <span className="text-gray-500">Not Available</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Current Status Section - Only show if already processed */}
          {isAlreadyProcessed && (
            <div className="p-4 border-t border-gray-300">
              <h3 className="font-semibold text-gray-800 mb-3 bg-gray-100 px-3 py-2">
                Current Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    currentStatus === 'Approved' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {currentStatus}
                  </span>
                </div>
                {currentRemarks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{currentRemarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Update Status Section - Only show for pending papers */}
          {!isAlreadyProcessed && (
          <div className="p-4 border-t border-gray-300">
            <h3 className="font-semibold text-white bg-orange-400 px-3 py-2 mb-4">
              Update Your Status
            </h3>
            
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">--Select--</option>
                  <option value="Ok">Ok,Approved</option>
                  <option value="Reject">Reject back to scholar</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks (if any)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter Remark"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="forwardedByHOD"
                  checked={isForwardedByHOD}
                  onChange={(e) => setIsForwardedByHOD(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="forwardedByHOD" className="text-sm text-red-600">
                  I've read and verify that this Paper is as per the provisions made in Point 11.17 of the Ph.D. Ordinance 2020 (Click to View)
                </label>
              </div>
              
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="readAndVerified"
                  checked={isReadAndVerified}
                  onChange={(e) => setIsReadAndVerified(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="readAndVerified" className="text-sm text-red-600">
                  I hereby declare that this paper is realated to Scholar's Ph.D. Work.
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="text-right">
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className={`px-8 py-2 rounded transition-colors ${isSubmitDisabled
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                Submit
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchPaperView;