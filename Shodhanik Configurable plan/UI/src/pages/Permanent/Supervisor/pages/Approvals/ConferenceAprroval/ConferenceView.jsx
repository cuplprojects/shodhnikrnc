import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '@/services/API';
import { getBaseServerURL } from '@/utils/getBaseApiURL';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';


const ConferenceView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const conferenceData = location.state?.conferenceData;
  const paramData = location.state?.statusParam;
  const baseFileURL = getBaseFileURL();
          const notify = notification();
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isForwardedByHOD, setIsForwardedByHOD] = useState(false);
  const [isReadAndVerified, setIsReadAndVerified] = useState(false);

  // Check if conference is already processed (status 1 or 2)
  const isAlreadyProcessed = conferenceData?.originalData?.conferenceStatus === 1 || conferenceData?.originalData?.conferenceStatus === 2;
  const currentStatus = conferenceData?.originalData?.conferenceStatus === 1 ? 'Approved' : 
                       conferenceData?.originalData?.conferenceStatus === 2 ? 'Rejected' : 'Pending';
  const currentRemarks = conferenceData?.originalData?.remarks || conferenceData?.remarks || '';
  // Store the status parameter in sessionStorage for breadcrumb navigation
  useEffect(() => {
    if (paramData) {
      sessionStorage.setItem('conferenceApprovalStatus', paramData);
    }
  }, [paramData]);

  const handleViewPDF = (filePath, fileName) => {
    if (filePath && filePath !== '#') {
      const serverURL = getBaseServerURL();
      const fullURL = `${serverURL}/${filePath}`;
      console.log('Opening PDF URL:', fullURL); // Debug log
      window.open(fullURL, '_blank');
    } else {
      notify.warning('Document file not available');
    }
  };

  const handleSubmit = async () => {
    if (status === '--Select--' || !status) {
      notify.warning('Please select a status');
      return;
    }

    if (status === 'Reject back to Scholar' && !remarks.trim()) {
      notify.warning('Remarks are required for rejection');
      return;
    }

    if (!isForwardedByHOD || !isReadAndVerified) {
      notify.warning('Please check both verification boxes before submitting');
      return;
    }

    try {
      // Prepare the update data as JSON
      const updateData = {
        conferenceStatus: status === 'approved and forwarded to Scholar' ? 1 : 2,
        remarks: remarks || ''
      };

      console.log('Sending PATCH request to:', `/ScholarConferences/UpdateStatus/${conferenceData.id}`);
      console.log('Update data:', updateData);

      // Make API call to update the conference status using PATCH
      const response = await API.patch(`/ScholarConferences/UpdateStatus/${conferenceData?.originalData?.id}`, updateData);

      console.log('API Response:', response);

      if (response.status === 200 || response.status === 204) {
       notify.success(`Conference ${status === 'approved and forwarded to Scholar' ? 'approved and forwarded to Scholar' : 'rejected back to Scholar'} successfully!`);
        // Navigate back to approval page with preserved status parameter
        navigate(`/supervisor-dashboard/conference-approval?status=${paramData || '0'}`);
      }
    } catch (error) {
      console.error('Error updating conference status:', error);
      console.error('Error details:', error.response?.data);
      notify.error(`Failed to update conference status: ${error.response?.data?.message || error.message}`);
    }
  };

  // Check if submit button should be disabled
  const isSubmitDisabled = !status || !isForwardedByHOD || !isReadAndVerified ||
    (status === 'Reject back to Scholar' && !remarks.trim());

  if (!conferenceData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">No conference data found</p>
          <button
            onClick={() => navigate(`/supervisor-dashboard/conference-approval?status=${paramData || '0'}`)}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Conference Approval
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/supervisor-dashboard/conference-approval?status=${paramData || '0'}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Conference Approval
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <h1 className="text-xl font-semibold text-gray-800">Conference Details</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* University Header */}
        <div className="bg-white border border-gray-300 mb-6">
          <div className="flex items-center justify-between p-6 border-b border-gray-300">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
                <img
                  src="/api/placeholder/80/80"
                  alt="University Logo"
                  className="w-16 h-16 rounded-full"
                />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-gray-800">
                  DIRECTORATE OF RESEARCH
                </h1>
                <p className="text-sm text-gray-600">
                  CHAUDHARY CHARAN SINGH UNIVERSITY, MEERUT
                </p>
                <p className="text-lg font-semibold text-gray-800 mt-2">
                  Conference & Seminar Request
                </p>
              </div>
            </div>
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
                    {conferenceData.admissionSession}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Shodhanik ID :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.rmsId}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Department/Subject :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {conferenceData.department}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Supervisor Name :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    <span className="text-blue-600 underline">{conferenceData.supervisorName}</span>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Scholar Name :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {conferenceData.scholarName}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 text-center" rowSpan="3">
                    <div className="w-24 h-32 bg-gray-100 border border-gray-300 mx-auto flex items-center justify-center overflow-hidden">
                      {(conferenceData?.profilePicture || conferenceData?.originalData?.profilePicture || conferenceData?.originalData?.path) ? (
                        <img
                          src={`${baseFileURL}/${conferenceData?.profilePicture || conferenceData?.originalData?.profilePicture || conferenceData?.originalData?.path}`}
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
                        style={{ display: (conferenceData?.profilePicture || conferenceData?.originalData?.profilePicture || conferenceData?.originalData?.path) ? 'none' : 'block' }}
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
                    {conferenceData.phoneNumber}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Email :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {conferenceData.email}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Conference Details Section */}
          <div className="p-4 border-t border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-3 bg-gray-100 px-3 py-2">
              Conference & Seminar Details
            </h3>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Title Of Seminar/Conferences
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {conferenceData.paperTitle}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Name Of Seminar/Conference
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {conferenceData.conferenceName}
                  </td>
                </tr>

                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Authors
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {Array.isArray(conferenceData.authorNames)
                      ? conferenceData.authorNames.join(', ')
                      : conferenceData.authorNames || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Organized By
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.organizedBy}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Sponsoring Agency
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.sponsoringAgency}
                  </td>

                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Conference Location
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.conferenceLocation}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Conference Level
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.conferenceLevel}
                  </td>

                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                     Date
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.startingDate} - {conferenceData.endingDate}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Presentation Certificate
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {conferenceData.presentationCertificate ? (
                      <button
                        onClick={() => handleViewPDF(conferenceData.presentationCertificate, 'Presentation Certificate')}
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        View Certificate
                      </button>
                    ) : (
                      <span className="text-gray-500">Not uploaded</span>
                    )}
                  </td>

                </tr>

              </tbody>
            </table>
          </div>

          {/* Documents Section */}

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

          {/* Update Status Section - Only show for pending conferences */}
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
                  <option value="approved and forwarded to Scholar">Ok,Approved</option>
                  <option value="Reject back to Scholar">Rejected, back to Scholar</option>
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
                <label htmlFor="forwardedByHOD" className="text-sm text-blue-600">
                  The conference request is forwarded by HoD/Dean/Principal.
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
                <label htmlFor="readAndVerified" className="text-sm text-blue-600">
                  I've read and verify this conference request.
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

export default ConferenceView;