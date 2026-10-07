import { useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '@/services/API';
import { getBaseServerURL } from '@/utils/getBaseApiURL';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import PrintHeader from '@/components/cms/PrintHeader'
import notification from '@/services/NotificationService';


const ProgressReportView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reportData = location.state?.reportData;
  const baseFileURL = getBaseFileURL();
          const notify = notification();
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isForwardedByHOD, setIsForwardedByHOD] = useState(false);
  const [isReadAndVerified, setIsReadAndVerified] = useState(false);

  // Check if report is already processed (status 1 or 2)
  const isAlreadyProcessed = reportData?.originalData?.isApprovedbySupervisor === 1 || reportData?.originalData?.isApprovedbySupervisor === 2;
  const currentStatus = reportData?.originalData?.isApprovedbySupervisor === 1 ? 'Forwarded to DOR' : 
                       reportData?.originalData?.isApprovedbySupervisor === 2 ? 'Rejected' : 'Pending';
  const currentRemarks = reportData?.originalData?.supervisorComments || reportData?.supervisorComments || '';
{console.log(reportData)}
  const handleViewPDF = () => {
    if (reportData?.reportLink && reportData.reportLink !== '#') {
      const serverURL = getBaseServerURL();
      const fullURL = `${serverURL}/${reportData.reportLink}`;
      console.log('Opening PDF URL:', fullURL); // Debug log
      window.open(fullURL, '_blank');
    } else {
     notify.warning('Report file not available');
    }
  };

  const handleSubmit = async () => {
    if (status === '--Select--' || !status) {
       notify.warning('Please select a status');
      return;
    }

    if (status === 'Reject back to Office' && !remarks.trim()) {
       notify.warning('Remarks are required for rejection');
      return;
    }

    if (!isForwardedByHOD || !isReadAndVerified) {
      notify.warning('Please check both verification boxes before submitting');
      return;
    }

    try {
      // Prepare the update data based on the API specification
      const formData = new FormData();

      formData.append(
        'isApprovedbySupervisor',
        status === 'Forward to DoR' ? '1' : '2'
      );
      formData.append('SupervisorComments', remarks || '');
      formData.append('SupervisorApprovalDate', new Date().toISOString());
      if(status === 'Forward to DoR')
      {
        formData.append('isApprovedbyDOR', 0)
      }

      console.log('Sending PATCH request to:', `/ProgressReports/${reportData.prid}`);
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
      }

      // Make API call to update the progress report status using PATCH
      const response = await API.patch(`/ProgressReports/${reportData.prid}`, formData);

      console.log('API Response:', response);

      if (response.status === 200 || response.status === 204) {
        notify.success(`Progress report ${status === 'Forward to DoR' ? 'approved and forwarded to DoR' : 'rejected'} successfully!`);
        // Navigate back to approval page
        navigate('/supervisor-dashboard/progressreport-approval' + (location.state?.statusParam !== undefined ? `?status=${location.state.statusParam}` : ''));
      }
    } catch (error) {
      console.error('Error updating progress report status:', error);
      console.error('Error details:', error.response?.data);
      notify.error(`Failed to update progress report status: ${error.response?.data?.message || error.message}`);
    }
  };

  // Check if submit button should be disabled
  const isSubmitDisabled = !status || !isForwardedByHOD || !isReadAndVerified ||
    (status === 'Reject back to Office' && !remarks.trim());

  if (!reportData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">No report data found</p>
          <button
            onClick={() => navigate('/supervisor-dashboard/progressreport-approval')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Progress Report Approval
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className=" bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => navigate('/supervisor-dashboard/progressreport-approval' + (location.state?.statusParam !== undefined ? `?status=${location.state.statusParam}` : ''))}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={20} />
          Back to Progress Report Approval
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* University Header */}
        <div className="bg-white border border-gray-300 mb-6 p-3">
          <div className="flex justify-center p-2">
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
                    {reportData.admissionSession}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Shodhanik ID :
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {reportData.rmsId}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Department/Subject :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    {reportData.department}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Supervisor Name :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="3">
                    <span className="text-blue-600 underline">{reportData?.originalData?.supervisorName}</span>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Scholar Name :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {reportData.scholarName}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 text-center" rowSpan="3">
                    <div className="w-24 h-32 bg-gray-100 border border-gray-300 mx-auto flex items-center justify-center overflow-hidden">
                      {(reportData?.profilePicture || reportData?.originalData?.profilePicture || reportData?.originalData?.path) ? (
                        <img
                          src={`${baseFileURL}/${reportData?.profilePicture || reportData?.originalData?.profilePicture || reportData?.originalData?.path}`}
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
                        style={{ display: (reportData?.profilePicture || reportData?.originalData?.profilePicture || reportData?.originalData?.path) ? 'none' : 'block' }}
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
                    {reportData.mobile}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium">
                    Email :
                  </td>
                  <td className="border border-gray-400 px-4 py-3" colSpan="2">
                    {reportData.email}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Progress Report Section */}
          <div className="p-4 border-t border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-3 bg-gray-100 px-3 py-2 flex items-center justify-between">
              <span>Progress Report Uploaded for Review</span>
              <span className="text-blue-700 font-bold">{reportData.prTitle || 'Progress Report'}</span>
            </h3>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Report Title
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4 font-semibold text-blue-700">
                    {reportData.prTitle || 'Progress Report'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Report Link
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    <button
                      onClick={handleViewPDF}
                      className="text-blue-600 underline hover:text-blue-800 font-medium"
                    >
                      View Progress Report
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Uploaded Date
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    {reportData.uploadedDate}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 bg-gray-50 font-medium w-1/4">
                    Current RAC Status
                  </td>
                  <td className="border border-gray-400 px-4 py-3 w-1/4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      reportData.status === 'Approved'
                        ? 'bg-green-100 text-green-800'
                        : reportData.status === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {reportData.status}
                    </span>
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
                    currentStatus === 'Forwarded to DOR' 
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

          {/* Update Status Section - Only show for pending reports */}
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
                  <option value="Forward to DoR">Forward to DoR</option>
                  <option value="Reject back to Office">Reject back to Office</option>
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
                  The progress report is forwarded by HoD/Dean/Principal.
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
                  I've read and verify this report.
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

export default ProgressReportView;