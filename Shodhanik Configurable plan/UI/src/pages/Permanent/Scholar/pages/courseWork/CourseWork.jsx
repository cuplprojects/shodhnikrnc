import { useState, useEffect } from 'react';
import { Modal, Button } from 'antd';
import { EyeOutlined, ExportOutlined } from '@ant-design/icons';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const CourseWork = () => {
  const [existingData, setExistingData] = useState(null);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [formData, setFormData] = useState({
    enrollmentNumber: '',
    rollNumber: '',
    courseWorkFile: null
  });

  const { getSId } = useSelectedScholarAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const sId = getSId();

      if (!sId) {
        notification().error('Scholar ID not found');
        return;
      }

      // Check if existing data exists
      try {
        const response = await API.get(`/CourseWork/BySid/${sId}`);
        if (response.data) {
          setExistingData(response.data);
          setHasExistingData(true);
          return;
        }
      } catch (err) {
        console.log('No existing data found, showing form');
      }

      setHasExistingData(false);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        notification().error('File size must be less than 1 MB');
        e.target.value = '';
        return;
      }
      if (file.type !== 'application/pdf') {
        notification().error('Only PDF files are allowed');
        e.target.value = '';
        return;
      }
      setFormData(prev => ({
        ...prev,
        courseWorkFile: file
      }));
    }
  };

  const handleViewFile = (filePath, fileName) => {
    setSelectedFile({ filePath, fileName });
    setViewModalVisible(true);
  };

  const handleOpenInNewTab = () => {
    if (selectedFile?.filePath) {
      const fileUrl = `${getBaseFileURL()}/${selectedFile.filePath}`;
      window.open(fileUrl, '_blank');
    }
  };

  const handleViewModalCancel = () => {
    setViewModalVisible(false);
    setSelectedFile(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.enrollmentNumber || !formData.rollNumber || !formData.courseWorkFile) {
      notification().error('All fields are required');
      return;
    }

    try {
      setSubmitting(true);
      const sId = getSId();
      const formDataToSend = new FormData();

      formDataToSend.append('sid', sId);
      formDataToSend.append('enrollmentNumber', formData.enrollmentNumber);
      formDataToSend.append('rollNumber', formData.rollNumber);
      formDataToSend.append('MarksheetFile', formData.courseWorkFile);

      const isReupload = hasExistingData && existingData?.courseWork?.cwid;
      
      if (isReupload) {
        formDataToSend.append('CourseWorkResult', 0); // Set to pending status
        formDataToSend.append('CourseWorkStatus', 0); // Set status to pending
        await API.patch(`/CourseWork/${existingData.courseWork.cwid}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notification().success('Course work resubmitted successfully! Status updated to pending.');
      } else {
        await API.post('/CourseWork/temp', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notification().success('Course work uploaded successfully!');
      }

      // Refresh data
      const response = await API.get(`/CourseWork/BySid/${sId}`);
      if (response.data) {
        setExistingData(response.data);
        setHasExistingData(true);
      }
      
      // Reset form data after successful submission
      setFormData({
        enrollmentNumber: '',
        rollNumber: '',
        courseWorkFile: null
      });
      
      // Clear file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      notification().error(err.response?.data?.message || 'Failed to upload course work');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  // If existing data exists, check if reupload is needed
  if (hasExistingData && existingData) {
    const courseWork = existingData.courseWork;
    
    // Debug log to check the actual values
    console.log('CourseWork Result:', courseWork?.courseWorkResult, 'Type:', typeof courseWork?.courseWorkResult);
    
    // Convert to number for comparison to handle both string and number values
    const result = parseInt(courseWork?.courseWorkResult);
    
    const isApproved = result === 1 && courseWork?.approvedAt;
    const isRejected = result === 2;
    const isReuploadRequired = result === 3; // Send back for revision
    const isPending = result === 0 || isNaN(result) || courseWork?.courseWorkResult === null || courseWork?.courseWorkResult === undefined;
    
    // If reupload is required (sent back for revision), show form with existing data pre-filled
    if (isReuploadRequired) {
      if (formData.enrollmentNumber === '' && existingData.enrollmentNumber) {
        setFormData(prev => ({
          ...prev,
          enrollmentNumber: existingData.enrollmentNumber,
          rollNumber: existingData.rollNumber
        }));
      }
      
      return (
        <div className="p-4 bg-gray-50">
          {/* Header */}
          <div className="bg-slate-700 text-white rounded-lg p-4 mb-6">
            <h1 className="text-xl font-semibold">Pre. Ph.D. Course Work</h1>
            <p className="text-slate-200 text-sm mt-1">Re-upload your course work marksheet/certificate</p>
          </div>

          {/* Alert Banner */}
          <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-center font-medium">Your submission requires revision. Please reupload the document.</p>
            {courseWork?.courseWorkRemark && (
              <p className="text-center text-sm mt-2"><strong>Remark:</strong> {courseWork.courseWorkRemark}</p>
            )}
          </div>

          {/* Form Section */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="bg-slate-100 p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Re-upload Pre. Ph.D. Course Work Marksheet/Certificate</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Enrollment Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Enrollment Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.enrollmentNumber}
                    onChange={(e) => handleInputChange('enrollmentNumber', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                    placeholder="Enter enrollment number"
                    required
                  />
                </div>

                {/* Roll Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Roll Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.rollNumber}
                    onChange={(e) => handleInputChange('rollNumber', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                    placeholder="Enter roll number"
                    required
                  />
                </div>
              </div>

              {/* File Upload */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <span className="text-blue-600">Upload .pdf file upto 1 Mb</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  accept=".pdf"
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    'Re-submit for Verification'
                  )}
                </button>
              </div>

              {/* Instructions */}
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="font-medium text-slate-800 mb-2">Important Instructions</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Document is mandatory and must be selected before submission</li>
                  <li>• Only PDF format is accepted</li>
                  <li>• Maximum file size allowed is 1 MB</li>
                  <li>• Once resubmitted, the document will be sent for review again</li>
                </ul>
              </div>
            </form>
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-4 bg-gray-50">
        {/* Header */}
        <div className="bg-slate-700 text-white rounded-lg p-4 mb-6">
          <h1 className="text-xl font-semibold">Pre. Ph.D. Course Work</h1>
          <p className="text-slate-200 text-sm mt-1">Your course work submission details</p>
        </div>

        {/* Existing Data View */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="bg-slate-100 p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Course Work Details</h2>
          </div>

          <div className="p-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-slate-600 font-medium">Enrollment Number</span>
                  <span className="col-span-2 text-slate-900">{existingData.enrollmentNumber || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-slate-600 font-medium">Roll Number</span>
                  <span className="col-span-2 text-slate-900">{existingData.rollNumber || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-slate-600 font-medium">Course Work ID</span>
                  <span className="col-span-2 text-slate-900">{courseWork?.cwid || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-slate-600 font-medium">Document</span>
                  <span className="col-span-2">
                    {courseWork?.courseWorkFilePath ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 text-sm">Document uploaded</span>
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewFile(courseWork.courseWorkFilePath, 'Course Work Document')}
                          size="small"
                          className="text-blue-600 hover:text-blue-800 p-0"
                        >
                          View
                        </Button>
                      </div>
                    ) : (
                      <span className="text-slate-500">No document uploaded</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-slate-600 font-medium">Status</span>
                  <span className="col-span-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      isApproved 
                        ? 'bg-green-100 text-green-800' 
                        : isRejected 
                        ? 'bg-red-100 text-red-800'
                        : isPending
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {isApproved 
                        ? 'Approved' 
                        : isRejected 
                        ? 'Rejected'
                        : isPending
                        ? 'Pending Review'
                        : `Status: ${result || 'Unknown'}`
                      }
                    </span>
                  </span>
                </div>
                {courseWork?.courseWorkRemark && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-600 font-medium">Remark</span>
                    <span className="col-span-2 text-slate-900">{courseWork.courseWorkRemark}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Information */}
            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Uploaded At</label>
                  <p className="text-slate-900 text-sm">{formatDate(courseWork?.uploadDate).split(",",1)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <p className={`text-sm font-medium ${
                    isApproved 
                      ? 'text-green-600' 
                      : isRejected 
                      ? 'text-red-600'
                      : isPending
                      ? 'text-yellow-600'
                      : 'text-gray-600'
                  }`}>
                    {isApproved 
                      ? 'Approved' 
                      : isRejected 
                      ? 'Rejected'
                      : isPending
                      ? 'Pending Review'
                      : 'Unknown'
                    }
                  </p>
                </div>
                {isApproved && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Approved At</label>
                    <p className="text-slate-900 text-sm">{formatDate(courseWork?.approvedAt).split(",",1)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Information */}
            {isRejected ? (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">Rejected</h4>
                <p className="text-sm text-red-700">
                  Your course work submission has been rejected. Please contact the office for further guidance.
                </p>
                {courseWork?.courseWorkRemark && (
                  <p className="text-sm text-red-700 mt-2">
                    <strong>Reason:</strong> {courseWork.courseWorkRemark}
                  </p>
                )}
              </div>
            ) : !isApproved && isPending ? (
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-2">Pending Review</h4>
                <p className="text-sm text-orange-700">
                  Your course work submission has been uploaded and is currently under review.
                  You will be notified once the review process is complete.
                </p>
              </div>
            ) : isApproved ? (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Approved</h4>
                <p className="text-sm text-green-700">
                  Your course work has been approved successfully.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* View Modal */}
        <Modal
          title={
            <div className="flex justify-between items-center">
              <span>View Document - {selectedFile?.fileName}</span>
              <Button
                type="link"
                icon={<ExportOutlined />}
                onClick={handleOpenInNewTab}
                className="text-blue-600 hover:text-blue-800"
              >
                Open in New Tab
              </Button>
            </div>
          }
          open={viewModalVisible}
          onCancel={handleViewModalCancel}
          footer={null}
          width={900}
          style={{ top: 20 }}
        >
          {selectedFile?.filePath && (
            <div className="mt-4">
              <iframe
                src={`${getBaseFileURL()}/${selectedFile.filePath}#toolbar=0`}
                width="100%"
                height="600px"
                style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}
                title={selectedFile.fileName}
              >
                <p>Your browser does not support iframes. Please <a href={`${getBaseFileURL()}/${selectedFile.filePath}`} target="_blank" rel="noopener noreferrer">click here to view the document</a>.</p>
              </iframe>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // Show upload form
  return (
    <div className="p-4 bg-gray-50">
      {/* Header */}
      <div className="bg-slate-700 text-white rounded-lg p-4 mb-6">
        <h1 className="text-xl font-semibold">Pre. Ph.D. Course Work</h1>
        <p className="text-slate-200 text-sm mt-1">Upload your course work marksheet/certificate</p>
      </div>

      {/* Alert Banner */}
      <div className="bg-orange-100 border border-orange-300 text-orange-800 px-4 py-3 rounded-lg mb-6">
        <p className="text-center font-medium">You haven&apos;t uploaded your Course Work Marksheet/Certificate</p>
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="bg-slate-100 p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Upload Pre. Ph.D. Course Work Marksheet/Certificate</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enrollment Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Enrollment Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.enrollmentNumber}
                onChange={(e) => handleInputChange('enrollmentNumber', e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                placeholder="Enter enrollment number"
                required
              />
            </div>

            {/* Roll Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.rollNumber}
                onChange={(e) => handleInputChange('rollNumber', e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                placeholder="Enter roll number"
                required
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="text-blue-600">Upload .pdf file upto 1 Mb</span> <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
              accept=".pdf"
              required
            />
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Uploading...
                </>
              ) : (
                'Upload for Verification'
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">Important Instructions</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Document is mandatory and must be selected before submission</li>
              <li>• Only PDF format is accepted</li>
              <li>• Maximum file size allowed is 1 MB</li>
              <li>• Once submitted, the document will be sent for review</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseWork;
