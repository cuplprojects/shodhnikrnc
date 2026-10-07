import { useState, useRef, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Eye,
  FileText,
  Image as ImageIcon,
  X,
  Upload,
  CheckCircle,
} from "lucide-react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import useScholarRegAuthStore from "@/store/scholarRegAuthStore";
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useFileViewer } from '@/services/FileViewerService';

const UploadDocuments = () => {

    const { getSId } = useScholarRegAuthStore();
    const { saveStep, isReadOnly } = useSteps();
    const navigate = useNavigate();
    const scholarId = getSId();
    const fileViewer = useFileViewer();
    
    // Auto-refresh steps from API on component load
    useStepRefresh();

  const [documents, setDocuments] = useState({});
  const [previews, setPreviews] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [identityProofDocument, setIdentityProofDocument] = useState(null);
  const [scholarCountry, setScholarCountry] = useState(null);
  const [documentMasters, setDocumentMasters] = useState([]);
  const [existingUploads, setExistingUploads] = useState([]);
  const [fileUrls, setFileUrls] = useState({});

  // Crop states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropField, setCurrentCropField] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ unit: "%", width: 90, aspect: undefined });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const imgRef = useRef(null);

  // Required dimensions for image documents
  const requiredDimensions = {
    Photograph: { width: 140, height: 170 },
    Signature: { width: 180, height: 70 },
  };

  // Fetch required documents on component mount
  useEffect(() => {
    const fetchRequiredDocuments = async () => {
      try {
        setIsLoading(true);

        // Fetch required documents for this scholar
        const requiredDocsResponse = await API.get(`/DocumentMaster/GetRequiredDocumentsforID/${scholarId}`);
        if (requiredDocsResponse.data) {
          setDocumentMasters(requiredDocsResponse.data);
          const docNames = requiredDocsResponse.data.map(doc => doc.documentName);
          setRequiredDocuments(docNames);

          // Initialize upload status
          const initialStatus = {};
          docNames.forEach(doc => {
            initialStatus[doc] = { uploaded: false, uploading: false };
          });

          // Fetch existing uploads to update status
          const existingUploadsResponse = await API.get(`/ScholarUpload/GetBySID?sid=${scholarId}`);
          if (existingUploadsResponse.data) {
            setExistingUploads(existingUploadsResponse.data);
            
            const baseURL = getBaseFileURL();
            const urls = {};
            
            existingUploadsResponse.data.forEach(upload => {
              const docMaster = requiredDocsResponse.data.find(dm => dm.documentMasterID === upload.documentMasterID);
              if (docMaster) {
                const docName = docMaster.documentName;
                initialStatus[docName] = { uploaded: true, uploading: false };
                urls[docName] = `${baseURL}/${upload.path}`;
              }
            });
            
            setFileUrls(urls);
          }
          setUploadStatus(initialStatus);
        }
      } catch (error) {
        console.error('Error fetching required documents:', error);
        notification().error('Error loading document requirements');
      } finally {
        setIsLoading(false);
      }
    };

    if (scholarId) {
      fetchRequiredDocuments();
    }
  }, [scholarId]);

  const handleFileSelect = (documentName, file) => {
    if (file) {
      const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB in bytes
      const notify = notification();

      // Validate file size (1 MB max)
      if (file.size > MAX_FILE_SIZE) {
        notify.error(`${documentName} file size exceeds 1 MB. Please select a smaller file.`);
        // Clear the input field
        const fileInput = document.getElementById(`file-${documentName}`);
        if (fileInput) fileInput.value = '';
        return;
      }

      // Documents that are PDF only
      const pdfOnlyDocuments = ['Postgraduation Or Equivalent', 'Aadhar', 'APAAR ID'];
      const isPdfOnly = pdfOnlyDocuments.includes(documentName);

      // Validate image format for Signature and Photograph
      if ((documentName === 'Signature' || documentName === 'Photograph') && !file.type.startsWith('image/')) {
        notify.error(`${documentName} must be an image file (JPG, JPEG, or PNG)`);
        // Clear the input field
        const fileInput = document.getElementById(`file-${documentName}`);
        if (fileInput) fileInput.value = '';
        return;
      }

      // Validate PDF-only documents
      if (isPdfOnly && file.type !== 'application/pdf') {
        notify.error(`${documentName} must be a PDF file`);
        // Clear the input field
        const fileInput = document.getElementById(`file-${documentName}`);
        if (fileInput) fileInput.value = '';
        return;
      }

      // Check if document needs cropping (images)
      if (requiredDimensions[documentName]) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result);
          setCurrentCropField(documentName);
          setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
      } else {
        // Direct upload for PDFs and other documents
        setDocuments(prev => ({ ...prev, [documentName]: file }));
      }
    }
  };

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setImageDimensions({ width, height });
    imgRef.current = e.currentTarget;

    // Set fixed crop dimensions based on required size
    const required = requiredDimensions[currentCropField];
    const scaleX = e.currentTarget.naturalWidth / width;
    const scaleY = e.currentTarget.naturalHeight / height;

    // Calculate crop in pixels on the displayed image
    const cropWidth = required.width / scaleX;
    const cropHeight = required.height / scaleY;

    // Center the crop
    const x = (width - cropWidth) / 2;
    const y = (height - cropHeight) / 2;

    setCrop({
      unit: "px",
      width: cropWidth,
      height: cropHeight,
      x: Math.max(0, x),
      y: Math.max(0, y),
    });
  };

  const getCroppedImg = async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], `${currentCropField}.jpg`, {
            type: "image/jpeg",
          });
          resolve({ file, preview: canvas.toDataURL("image/jpeg") });
        },
        "image/jpeg",
        0.95
      );
    });
  };

  const handleCropComplete = async () => {
    const result = await getCroppedImg();
    if (result) {
      setDocuments((prev) => ({ ...prev, [currentCropField]: result.file }));
      setPreviews((prev) => ({ ...prev, [currentCropField]: result.preview }));
      setCropModalOpen(false);
      setImageSrc(null);
      setCompletedCrop(null);
    }
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    setImageSrc(null);
    setCompletedCrop(null);
    setCurrentCropField(null);
  };

  // Upload individual document
  const uploadDocument = async (documentName) => {
    const file = documents[documentName];
    if (!file) return;

    const notify = notification();
    const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB in bytes

    // Validate file size before upload
    if (file.size > MAX_FILE_SIZE) {
      notify.error(`${documentName} file size exceeds 1 MB. Please select a smaller file.`);
      // Clear the document from state
      setDocuments(prev => {
        const updated = { ...prev };
        delete updated[documentName];
        return updated;
      });
      // Clear the input field
      const fileInput = document.getElementById(`file-${documentName}`);
      if (fileInput) fileInput.value = '';
      return;
    }
    
    // Find document master ID
    const documentMaster = documentMasters.find(doc => doc.documentName === documentName);
    if (!documentMaster) {
      notify.error(`Document type ${documentName} not found`);
      return;
    }

    try {
      // Set uploading status
      setUploadStatus(prev => ({
        ...prev,
        [documentName]: { uploaded: false, uploading: true }
      }));

      // Prepare form data
      const formData = new FormData();
      formData.append('SID', scholarId);
      formData.append('DocumentMasterID', documentMaster.documentMasterID);
      formData.append('File', file);

      // Upload document
      const response = await API.post('/ScholarUpload/Upsert', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        // Set uploaded status
        setUploadStatus(prev => ({
          ...prev,
          [documentName]: { uploaded: true, uploading: false }
        }));
        
        // If response contains the file path, update file URLs
        if (response.data && response.data.path) {
          const baseURL = getBaseFileURL();
          setFileUrls(prev => ({
            ...prev,
            [documentName]: `${baseURL}/${response.data.path}`
          }));
        }
        
        notify.success(`${documentName} uploaded successfully!`);
      }
    } catch (error) {
      console.error(`Error uploading ${documentName}:`, error);
      notify.error(`Failed to upload ${documentName}`);
      
      // Reset status
      setUploadStatus(prev => ({
        ...prev,
        [documentName]: { uploaded: false, uploading: false }
      }));
    }
  };

  // Check if all required documents are uploaded
  const areAllRequiredDocumentsUploaded = () => {
    if (!requiredDocuments || requiredDocuments.length === 0) return false;
    
    return requiredDocuments.every(doc => {
      // Postgraduation is usually optional in these flows
      if (doc === 'Postgraduation Or Equivalent') return true;
      return uploadStatus[doc]?.uploaded === true;
    });
  };

  // Check if form is ready for submission
  const isFormReady = areAllRequiredDocumentsUploaded() && isVerified;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const notify = notification();
    
    // Validate all required documents are uploaded
    if (!areAllRequiredDocumentsUploaded()) {
      notify.error('Please upload all required documents before proceeding.');
      return;
    }
    
    if (!isVerified) {
      notify.error('Please verify that all documents are visible properly.');
      return;
    }
    
    // Complete step and navigate
    const stepSaved = await saveStep(3);
    if (stepSaved) {
      // Navigate to next step (Preview)
      navigate('/register-scholar/preview');
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm";

  const requiredDims = currentCropField
    ? requiredDimensions[currentCropField]
    : { width: 0, height: 0 };

  // Get document requirements
  const getDocumentRequirements = (documentName) => {
    const isImage = requiredDimensions[documentName];
    const docMaster = documentMasters.find(dm => dm.documentName === documentName);
    
    // All documents have 1 MB max file size
    const maxFileSize = '1 MB';

    // Documents that are PDF only
    const pdfOnlyDocuments = ['Postgraduation Or Equivalent', 'Aadhar', 'APAAR ID'];
    const isPdfOnly = pdfOnlyDocuments.includes(documentName);

    if (isImage) {
      const dims = requiredDimensions[documentName];
      return {
        fileSize: maxFileSize,
        format: 'JPG/JPEG/PNG',
        dimensions: `${dims.width}px × ${dims.height}px`,
        accept: 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png'
      };
    } else if (isPdfOnly) {
      return {
        fileSize: maxFileSize,
        format: 'PDF',
        dimensions: null,
        accept: '.pdf'
      };
    } else {
      return {
        fileSize: maxFileSize,
        format: 'PDF/JPG/PNG',
        dimensions: null,
        accept: '.pdf'
      };
    }
  };

  // Check if a document is actually required based on scholar's data
  const isDocumentRequired = (documentName) => {
    if (documentName === 'Postgraduation Or Equivalent') return false;
    return requiredDocuments.includes(documentName);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-4 md:p-5 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af] mx-auto mb-2"></div>
          <p className="text-gray-600 font-inter">Loading document requirements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#111827] font-inter">
              Upload Documents
            </h2>
            <div className="flex gap-2">
              <a
                href="https://mjprudor.ac.in/rms/imageinstruction.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium border border-[#1e40af] px-3 py-1 rounded-md transition-colors"
              >
                Photo Guidelines
              </a>
              <a
                href="http://photo.applytoday.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium border border-[#1e40af] px-3 py-1 rounded-md transition-colors"
              >
                Online Tool
              </a>
            </div>
          </div>

          {/* Dynamic Document Upload Sections */}
          <div className="space-y-6">
            {requiredDocuments.map((documentName) => {
              const requirements = getDocumentRequirements(documentName);
              const isOptional = documentName === 'Postgraduation Or Equivalent';
              const isRequired = isDocumentRequired(documentName);
              const status = uploadStatus[documentName] || { uploaded: false, uploading: false };
              const hasFile = documents[documentName];
              const hasPreview = previews[documentName];

              return (
                <div key={documentName} className="border border-[#e5e7eb] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-[#111827] font-inter">
                      {documentName}
                      {isRequired && <span className="text-red-600 ml-1">*</span>}
                    </h3>
                    {status.uploaded && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={16} />
                        <span className="text-xs font-medium">Uploaded</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Upload Section */}
                    <div>
                      <input
                        type="file"
                        accept={requirements.accept}
                        onChange={(e) => handleFileSelect(documentName, e.target.files[0])}
                        className={inputClass}
                        disabled={isReadOnly || status.uploading}
                        id={`file-${documentName}`}
                      />
                      
                      <div className="mt-2 text-xs text-[#6b7280] space-y-0.5">
                        <p>File Size: {requirements.fileSize}</p>
                        <p>Format: {requirements.format}</p>
                        {requirements.dimensions && (
                          <p>Dimensions: {requirements.dimensions}</p>
                        )}
                      </div>

                      {/* Upload Button */}
                      {hasFile && !status.uploaded && (
                        <button
                          type="button"
                          onClick={() => uploadDocument(documentName)}
                          disabled={status.uploading || isReadOnly}
                          className="mt-3 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status.uploading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload size={16} />
                              Upload {documentName}
                            </>
                          )}
                        </button>
                      )}

                      {/* Re-upload Button for already uploaded documents */}
                      {status.uploaded && hasFile && (
                        <button
                          type="button"
                          onClick={() => uploadDocument(documentName)}
                          disabled={status.uploading || isReadOnly}
                          className="mt-3 flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status.uploading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Re-uploading...
                            </>
                          ) : (
                            <>
                              <Upload size={16} />
                              Re-upload {documentName}
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Preview Section */}
                    <div>
                      {/* Show existing uploaded file first */}
                      {fileUrls[documentName] && status.uploaded ? (
                        <div>
                          <h4 className="text-sm font-medium text-[#374151] mb-2">Uploaded File</h4>
                          <div className="border-2 border-solid border-green-200 rounded-lg p-4 flex items-center justify-center bg-green-50 h-32">
                            {requiredDimensions[documentName] ? (
                              <img
                                src={fileUrls[documentName]}
                                alt={`${documentName} Uploaded`}
                                className="max-h-full max-w-full object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'block';
                                }}
                              />
                            ) : (
                              <div className="text-center text-green-700">
                                <FileText size={32} className="mx-auto mb-2" />
                                <p className="text-xs">File Uploaded</p>
                                <button 
                                  type="button"
                                  onClick={() => fileViewer.openFile(fileUrls[documentName], documentName)}
                                  className="text-blue-600 hover:text-blue-800 transition-colors mt-1 cursor-pointer"
                                  title="View File"
                                >
                                  <Eye size={16} />
                                </button>
                              </div>
                            )}
                            <div style={{ display: 'none' }} className="text-center text-green-700">
                              <FileText size={32} className="mx-auto mb-2" />
                              <p className="text-xs">Image Load Error</p>
                              <button 
                                type="button"
                                onClick={() => fileViewer.openFile(fileUrls[documentName], documentName)}
                                className="text-blue-600 hover:text-blue-800 transition-colors mt-1 cursor-pointer"
                                title="View File"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : hasPreview ? (
                        <div>
                          <h4 className="text-sm font-medium text-[#374151] mb-2">Preview</h4>
                          <div className="border-2 border-dashed border-[#d1d5db] rounded-lg p-4 flex items-center justify-center bg-[#f9fafb] h-32">
                            <img
                              src={hasPreview}
                              alt={`${documentName} Preview`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        </div>
                      ) : hasFile && !requiredDimensions[documentName] ? (
                        <div>
                          <h4 className="text-sm font-medium text-[#374151] mb-2">File Selected</h4>
                          <div className="border-2 border-dashed border-[#d1d5db] rounded-lg p-4 flex items-center justify-center bg-[#f9fafb] h-32">
                            <div className="text-center text-[#6b7280]">
                              <FileText size={32} className="mx-auto mb-2" />
                              <p className="text-xs">{hasFile.name}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-sm font-medium text-[#374151] mb-2">Preview</h4>
                          <div className="border-2 border-dashed border-[#d1d5db] rounded-lg p-4 flex items-center justify-center bg-[#f9fafb] h-32">
                            <div className="text-center text-[#9ca3af]">
                              {requiredDimensions[documentName] ? (
                                <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                              ) : (
                                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                              )}
                              <p className="text-xs">No file selected</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upload Progress Summary */}
          {/* <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">Upload Progress</h4>
            <div className="space-y-2">
              {['Photograph', 'Signature', 'DL', 'Passport', 'Postgraduation Or Equivalent'].map((docName) => {
                const isOptional = docName === 'Postgraduation Or Equivalent';
                const isRequired = isDocumentRequired(docName);
                // Remove isConditional logic
                const status = uploadStatus[docName] || { uploaded: false };
                
                let statusText = '';
                let statusColor = '';
                
                if (status.uploaded) {
                  statusText = 'Uploaded';
                  statusColor = 'text-green-600';
                } else if (isOptional) {
                  statusText = 'Optional - Not uploaded';
                  statusColor = 'text-gray-500';
                } else if (isRequired) {
                  statusText = 'Required';
                  statusColor = 'text-orange-600';
                } else {
                  // Not required for this user
                  if (docName === 'Passport') {
                    statusText = 'Not required - Country is not "Other"';
                    statusColor = 'text-gray-500';
                  } else if (docName === 'DL') {
                    statusText = 'Not required - Not your identity proof';
                    statusColor = 'text-gray-500';
                  } else {
                    statusText = 'Not required';
                    statusColor = 'text-gray-500';
                  }
                }
                
                return (
                  <div key={docName} className="flex items-center justify-between text-xs">
                    <span className={`${isRequired ? 'text-blue-900' : 'text-gray-600'}`}>
                      {docName}
                    </span>
                    <div className="flex items-center gap-1">
                      {status.uploaded ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} />
                          <span>Uploaded</span>
                        </div>
                      ) : (
                        <span className={statusColor}>
                          {statusText}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div> */}

          {/* Verification Checkbox */}
          <div className="mt-4 flex items-start gap-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-md">
            <input
              type="checkbox"
              checked={isVerified || isReadOnly}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-[#dc2626] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#dc2626]"
              disabled={isReadOnly || !areAllRequiredDocumentsUploaded()}
              required
            />
            <label className="text-xs text-[#dc2626] font-medium font-inter">
              All documents are visible properly and uploaded successfully
              {!areAllRequiredDocumentsUploaded() && (
                <span className="block text-gray-500 mt-1">
                  (Upload all required documents first)
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
          <div className="flex flex-col items-end gap-2">
            {/* Validation Status */}
            {!isFormReady && !isReadOnly && (
              <div className="text-xs text-gray-500">
                {!areAllRequiredDocumentsUploaded() && (
                  <p>• Upload all required documents</p>
                )}
                {!isVerified && (
                  <p>• Verify documents are visible properly</p>
                )}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isReadOnly || !isFormReady}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 text-white py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:from-green-700 hover:to-green-600 active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReadOnly ? 'Read Only' : 'Save & Next'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </form>

      {/* Crop Modal */}
      {cropModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-[#e5e7eb] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#111827] font-inter">
                Crop{" "}
                {currentCropField === "photograph" ? "Photograph" : "Signature"}
              </h3>
              <button
                onClick={handleCropCancel}
                className="text-[#6b7280] hover:text-[#111827] transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4">
              {/* Dimension Info */}
              <div className="mb-4">
                <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-md p-3 text-center">
                  <p className="font-semibold text-[#1e40af] mb-1">
                    Required Dimensions (Fixed)
                  </p>
                  <p className="text-[#374151]">
                    Width: {requiredDims.width}px × Height:{" "}
                    {requiredDims.height}px
                  </p>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Drag the crop area to position your image
                  </p>
                </div>
              </div>

              {/* Crop Area */}
              <div className="flex justify-center mb-4">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  locked={false}
                  keepSelection={true}
                  minWidth={crop.width}
                  minHeight={crop.height}
                  maxWidth={crop.width}
                  maxHeight={crop.height}
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Crop preview"
                    onLoad={onImageLoad}
                    style={{ maxHeight: "60vh", maxWidth: "100%" }}
                  />
                </ReactCrop>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCropCancel}
                  className="px-4 py-2 border border-[#d1d5db] text-[#374151] rounded-md hover:bg-[#f9fafb] transition-colors font-inter text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCropComplete}
                  className="px-4 py-2 bg-[#1e40af] text-white rounded-md hover:bg-[#1e3a8a] transition-colors font-inter text-sm"
                >
                  Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {fileViewer.FileViewerModal}
    </div>
  );
};

export default UploadDocuments;
