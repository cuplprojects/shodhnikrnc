import { useState, useEffect } from 'react';
import { Button, Upload, Modal, Spin } from 'antd';
import { UploadOutlined, EyeOutlined, DeleteOutlined, FileOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import getBaseFileURL from '@/utils/getBaseFileUrl';


const ThesisUploads = () => {
  const [files, setFiles] = useState({
    No_Dues_Cretificate_File: null,
    Pre_PhD_Notice_File: null,
    Pre_PhD_Certificate_File: null,
    Time_Extension_Letter_File: null,
    Thesis_File: null,
    Thesis_Summary_File: null,
    Photograph1: null,
    Photograph2: null
  });

  const [existingFiles, setExistingFiles] = useState({
    No_Dues_Cretificate_File: null,
    Pre_PhD_Notice_File: null,
    Pre_PhD_Certificate_File: null,
    Time_Extension_Letter_File: null,
    Thesis_File: null,
    Thesis_Summary_File: null,
  });

  const [thesisData, setThesisData] = useState(null);
  const [thesisTitle, setThesisTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const { getSId } = useSelectedScholarAuthStore();
  const navigate = useNavigate();
  const notify = notification();
  const baseFileURL = getBaseFileURL();

  // Check if user can access this page (same logic as canProceed in ThesisSubmission)
  useEffect(() => {
    const checkAccess = async () => {
      try {
        setLoading(true);
        const sId = getSId();

        if (!sId) {
          navigate('/scholar/thesis-submission');
          return;
        }

        // Fetch existing thesis data
        try {
          const thesisResponse = await API.get(`/Thesis/${sId}`);
          console.log('Existing thesis data:', thesisResponse.data);
          
          if (thesisResponse.data) {
            const data = thesisResponse.data;
            setThesisData(data);
            
            // Set thesis title
            if (data.thesis_Title) {
              setThesisTitle(data.thesis_Title);
            }
            
            // Map existing files
            const existingFilesMap = {
              No_Dues_Cretificate_File: data.no_Dues_Cretificate_File,
              Pre_PhD_Notice_File: data.pre_PhD_Notice_File,
              Pre_PhD_Certificate_File: data.pre_PhD_Certificate_File,
              Time_Extension_Letter_File: data.time_Extension_Letter_File,
              Thesis_File: data.thesis_File,
              Thesis_Summary_File: data.thesis_Summary_File,
            };
            
            setExistingFiles(existingFilesMap);
            console.log('Mapped existing files:', existingFilesMap);
          }
        } catch (thesisError) {
          console.log('No existing thesis data found or error:', thesisError);
          // Not an error - user might be uploading for the first time
        }

        // Fetch thesis component report from API (same as ThesisSubmission)
        const response = await API.get(`/Thesis/Thesis-component-report/${sId}`);
        const data = response.data;

        console.log('=== ThesisUploads Access Check ===');
        console.log('API Response data:', data);

        // Check if first 6 requirements are completed (same logic as canProceed)
        const firstSixCompleted = data.prePhDMarksheet &&
          data.synopsis &&
          data.rdcLetter &&
          data.progressReport &&
          data.researchPaper &&
          data.conferences;

        console.log('firstSixCompleted:', firstSixCompleted);

        if (!firstSixCompleted) {
          console.log('Redirecting - first 6 requirements not completed');
          // Redirect back to thesis submission if requirements not met
          //<--- temp
          // navigate('/scholar/thesis-submission');
          // return;
        }

        // Check upload status - but don't block access if not uploaded yet
        try {
          const uploadResponse = await API.get(`/Thesis/check-all-upload/${sId}`);
          console.log('Upload status response:', uploadResponse.data);
          
          // Only redirect if documents are actually uploaded AND we can confirm it
          // This prevents false positives from blocking access
          if (uploadResponse.data.isAllUploaded === true) {
            console.log('All documents confirmed uploaded, redirecting to thesis submission');
            // navigate('/scholar/thesis-submission');
            // return;
          }
        } catch (uploadError) {
          console.log('Upload status check failed, allowing access:', uploadError);
          // If upload status check fails, allow access (better to err on the side of access)
        }

        console.log('Access granted to uploads page');
        setCanAccess(true);

        // Fetch thesis title from SynopsisRDC if not already set
        if (!thesisTitle) {
          try {
            const synopsisResponse = await API.get(`/SynopsisRDC/${sId}`);
            if (synopsisResponse.data && synopsisResponse.data.synopsis1Title) {
              setThesisTitle(synopsisResponse.data.synopsis1Title);
            }
          } catch (synopsisError) {
            console.log('Error fetching synopsis title:', synopsisError);
          }
        }

      } catch (err) {
        console.error('Error checking access:', err);
        navigate('/scholar/thesis-submission');
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [getSId, navigate]);

  const uploadRequirements = [
    {
      id: 'Photograph1',
      label: 'Photograph1',
      required: true,
      maxSize: 2,
      description: '(.jpg, .jpeg, .png upto 2 MB)',
      acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png']
    },
    {
      id: 'Photograph2',
      label: 'Photograph2',
      required: true,
      maxSize: 2,
      description: '(.jpg, .jpeg, .png upto 2 MB)',
      acceptedTypes: ['image/jpeg', 'image/jpg', 'image/png']
    },
    {
      id: 'No_Dues_Cretificate_File',
      label: 'No Dues Certificate from Related Department / Research Centre',
      required: true,
      maxSize: 10,
      description: '(.pdf upto 10 MB)',
      acceptedTypes: ['application/pdf']
    },
    {
      id: 'Pre_PhD_Notice_File',
      label: 'Pre. Ph.D. Presentation Notice',
      required: true,
      maxSize: 10,
      description: '(.pdf upto 10 MB)',
      acceptedTypes: ['application/pdf']
    },
    {
      id: 'Pre_PhD_Certificate_File',
      label: 'Pre. Ph.D. Presentation Certificate issued by HoD/Principal',
      required: true,
      maxSize: 10,
      description: '(.pdf upto 10 MB)',
      acceptedTypes: ['application/pdf']
    },
    {
      id: 'Time_Extension_Letter_File',
      label: 'Time Extension Letter (If Applicable)',
      required: false,
      maxSize: 10,
      description: '(.pdf upto 10 MB)',
      acceptedTypes: ['application/pdf']
    },
    {
      id: 'Thesis_File',
      label: 'Thesis',
      required: true,
      maxSize: 25,
      description: '(.pdf upto 25 MB)',
      acceptedTypes: ['application/pdf']
    },
    {
      id: 'Thesis_Summary_File',
      label: 'Thesis Summary',
      required: true,
      maxSize: 25,
      description: '(.pdf upto 25 MB)',
      acceptedTypes: ['application/pdf']
    }
  ];

  const handleFileChange = (fieldId, file) => {
    if (file) {
      const requirement = uploadRequirements.find(req => req.id === fieldId);
      
      // Validate file type
      if (!requirement.acceptedTypes.includes(file.type)) {
        if (requirement.acceptedTypes.includes('application/pdf')) {
          notify.error('Please upload only PDF files');
        } else {
          notify.error('Please upload only JPG, JPEG, or PNG files');
        }
        return false;
      }

      // Validate file size
      const maxSizeInBytes = requirement.maxSize * 1024 * 1024; // Convert MB to bytes

      if (file.size > maxSizeInBytes) {
        notify.error(`File size should not exceed ${requirement.maxSize} MB`);
        return false;
      }

      setFiles(prev => ({
        ...prev,
        [fieldId]: file
      }));
    }
    return false; // Prevent automatic upload
  };

  const handleRemoveFile = (fieldId) => {
    setFiles(prev => ({
      ...prev,
      [fieldId]: null
    }));
  };

  const handlePreview = (file, title) => {
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setPreviewFile(fileUrl);
      setPreviewTitle(title);
      setPreviewVisible(true);
    }
  };

  const handleViewExistingFile = (filePath, title) => {
    if (filePath) {
      const fileUrl = `${baseFileURL}/${filePath}`;
      console.log(fileUrl)
      setPreviewFile(fileUrl);
      setPreviewTitle(title);
      setPreviewVisible(true);
    } else {
      notify.info('File not available');
    }
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    // Only revoke object URLs (for newly uploaded files)
    if (previewFile && previewFile.startsWith('blob:')) {
      URL.revokeObjectURL(previewFile);
    }
    setPreviewFile(null);
    setPreviewTitle('');
  };

  const validateRequiredFiles = () => {
    // Check thesis title
    if (!thesisTitle.trim()) {
      return false;
    }

    // For re-uploads (when existing files exist), allow submission with just one new file
    if (thesisData && thesisData.thesisID) {
      // At least one file should be uploaded for re-upload
      const hasAtLeastOneNewFile = Object.values(files).some(file => file !== null);
      return hasAtLeastOneNewFile;
    }

    // For initial upload, require all files
    const requiredFields = uploadRequirements.filter(req => req.required).map(req => req.id);
    const missingFiles = requiredFields.filter(fieldId => !files[fieldId] && !existingFiles[fieldId]);

    if (missingFiles.length > 0) {
      return false;
    }
    return true;
  };

  const validateForSubmission = () => {
    // Check thesis title
    if (!thesisTitle.trim()) {
      notify.error('Please enter the thesis title');
      return false;
    }

    // For re-uploads (when existing files exist), allow submission with just one new file
    if (thesisData && thesisData.thesisID) {
      // At least one file should be uploaded for re-upload
      const hasAtLeastOneNewFile = Object.values(files).some(file => file !== null);
      if (!hasAtLeastOneNewFile) {
        notify.error('Please upload at least one file to re-upload');
        return false;
      }
    } else {
      // For initial upload, require all files
      const requiredFields = uploadRequirements.filter(req => req.required).map(req => req.id);
      const missingFiles = requiredFields.filter(fieldId => !files[fieldId] && !existingFiles[fieldId]);

      if (missingFiles.length > 0) {
        const missingLabels = missingFiles.map(fieldId =>
          uploadRequirements.find(req => req.id === fieldId)?.label
        );
        notify.error(`Please upload the following required files: ${missingLabels.join(', ')}`);
        return false;
      }
    }

    if (!confirmationChecked) {
      notify.error('Please confirm that you understand the re-upload policy');
      return false;
    }

    return true;
  };

  const handleFinalSubmit = async () => {
    if (!validateForSubmission()) {
      return;
    }

    const sId = getSId();
    if (!sId) {
      notify.error('Scholar ID not found');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('sid', sId);
      formData.append('Thesis_Title', thesisTitle.trim());
      formData.append('PlagCheck', 3)
      // Append all NEW files to FormData (only files that were changed)
      Object.entries(files).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });

      // Determine if this is an update or new upload
      const isUpdate = thesisData && thesisData.thesisID;

      let response;
      if (isUpdate) {
        // Update existing thesis with PATCH using the new endpoint
        response = await API.patch(`/Thesis/upload/${sId}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notify.success('Thesis documents updated successfully!');
      } else {
        // Create new thesis with POST
        response = await API.post('/Thesis/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notify.success('Thesis documents uploaded successfully!');
      }

      // Reset form
      setThesisTitle('');
      setConfirmationChecked(false);
      setFiles({
        No_Dues_Cretificate_File: null,
        Pre_PhD_Notice_File: null,
        Pre_PhD_Certificate_File: null,
        Time_Extension_Letter_File: null,
        Thesis_File: null,
        Thesis_Summary_File: null,
        Photograph1: null,
        Photograph2: null
      });

      // Redirect back to thesis submission page after successful upload
      setTimeout(() => {
        navigate('/scholar/thesis-submission');
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      notify.error(error.response?.data?.message || 'Failed to upload thesis documents. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Show loading while checking access
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
        <span className="ml-2 text-gray-600">Checking access permissions...</span>
      </div>
    );
  }

  // If access check failed, this component will redirect automatically
  //<--- temp
  // if (!canAccess) {
  //   return null;
  // }

  return (
    <div className="h-full rounded-2xl">
      <div className="p-1">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-3 p-2">
          <h1 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Ph.D. Thesis Submission - Document Upload
          </h1>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Orange Header */}
          <div className="bg-orange-200 px-4 py-2 border-b">
            <h2 className="font-semibold text-orange-900">Uploads for Thesis Submission</h2>
          </div>

          {/* Upload Forms */}
          <div className="p-4 space-y-4">
            {/* Thesis Title Field */}
            <div className="border-b pb-4 mb-4">
              <div className="mb-2">
                <label className="block font-medium text-gray-700">
                  <span className="text-red-500">* </span>
                  Thesis Title
                </label>
              </div>
              <input
                type="text"
                value={thesisTitle}
                onChange={(e) => setThesisTitle(e.target.value)}
                placeholder="Enter your thesis title"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                disabled
              />
            </div>

            {uploadRequirements.map((requirement) => {
              const hasExistingFile = existingFiles[requirement.id];
              const hasNewFile = files[requirement.id];
              const showFile = hasNewFile || hasExistingFile;

              return (
                <div key={requirement.id} className="border-b pb-4 last:border-b-0">
                  <div>
                    <div className="mb-2">
                      <label className="block font-medium text-gray-700">
                        {requirement.required && <span className="text-red-500">* </span>}
                        {requirement.label} {requirement.description}
                      </label>
                    </div>

                    {/* Show existing file info if available */}
                    {hasExistingFile && !hasNewFile && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileOutlined className="text-blue-600" />
                          <span className="text-sm text-blue-800">
                            Existing file uploaded
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewExistingFile(hasExistingFile, requirement.label)}
                            className="text-blue-600"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Upload
                        beforeUpload={(file) => handleFileChange(requirement.id, file)}
                        fileList={[]}
                        maxCount={1}
                        accept={requirement.acceptedTypes.includes('application/pdf') ? '.pdf' : '.jpg,.jpeg,.png'}
                        className="flex-1"
                        showUploadList={false}
                      >
                        <Button
                          icon={<UploadOutlined />}
                          className="w-full h-10 border-2 border-dashed border-gray-300 hover:border-blue-400"
                          disabled={!!hasNewFile}
                        >
                          {hasNewFile 
                            ? hasNewFile.name 
                            : hasExistingFile 
                              ? 'Re-upload File' 
                              : 'Choose File'}
                        </Button>
                      </Upload>

                      {hasNewFile && (
                        <>
                          <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={() => handlePreview(hasNewFile, requirement.label)}
                            className="bg-blue-600 hover:bg-blue-700"
                            title="Preview New File"
                          >
                            Preview
                          </Button>
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveFile(requirement.id)}
                            className="bg-red-500 hover:bg-red-600 border-red-500 hover:border-red-600 text-white"
                            title="Remove New File"
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warning Message */}
          <div className="px-4 py-2 bg-red-50 border-t">
            <div className="flex items-start">
              <input
                type="checkbox"
                className="mt-1 mr-2"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                disabled={!validateRequiredFiles()}
              />
              <span className="text-red-600 text-sm">
                After submission you can Re-Upload only after Rejection.
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="px-4 py-4 text-right border-t bg-gray-50">
            <Button
              type="primary"
              size="large"
              onClick={handleFinalSubmit}
              loading={uploading}
              disabled={!confirmationChecked || !validateRequiredFiles()}
              className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 px-8 py-2 font-semibold rounded disabled:bg-gray-400 disabled:border-gray-400"
            >
              Final Submit
            </Button>
          </div>

        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        title={previewTitle}
        open={previewVisible}
        onCancel={handleClosePreview}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button key="close" onClick={handleClosePreview}>
            Close
          </Button>
        ]}
      >
        <div style={{ height: '70vh', width: '100%' }}>
          {previewFile && (
            <>
              {(previewTitle.includes('Photograph') || previewTitle.includes('photograph')) ? (
                <div className="flex justify-center items-center h-full">
                  <img
                    src={previewFile}
                    alt={previewTitle}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              ) : (
                <iframe
                  src={previewFile}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: '4px'
                  }}
                  title="PDF Preview"
                />
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ThesisUploads;