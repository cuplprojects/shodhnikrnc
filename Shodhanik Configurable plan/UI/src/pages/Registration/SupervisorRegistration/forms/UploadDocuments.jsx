import { useState, useRef, useEffect } from 'react';
import { ChevronRight, Eye, FileText, Image as ImageIcon, X, Download } from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useNavigate } from 'react-router-dom';
import API from '@/services/API';
import useStepSupStore from '../components/stepStore';
import useStepsSup from '../../../../hooks/useStepsSup';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { SUPERVISOR_REGISTRATION_ROUTES } from '@/config/supervisorRegistrationRoutes';
import { useFileViewer } from '@/services/FileViewerService';

const UploadDocuments = () => {
  const navigate = useNavigate();
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();
  const fetchSteps = useStepSupStore(state => state.fetchSteps);
  const isStepReadOnly = useStepSupStore(state => state.isStepReadOnly);
  const checkScreeningStatus = useStepSupStore(state => state.checkScreeningStatus);
  const { saveStep } = useStepsSup();
  const [supervisorData, setSupervisorData] = useState(null);
  const { FileViewerModal, openFile } = useFileViewer();
  
  // Check screening status and set supervisor data
  useEffect(() => {
    const fetchScreeningStatus = async () => {
      try {
        const screeningResult = await checkScreeningStatus(supId);
        setSupervisorData({
          supId,
          hasRejectedScreening: screeningResult?.hasRejectedScreening || false,
          screeningData: screeningResult?.screeningData || null
        });
      } catch (error) {
        console.error('Error fetching screening status:', error);
        setSupervisorData({ supId, hasRejectedScreening: false });
      }
    };

    if (supId) {
      fetchScreeningStatus();
    }
  }, [supId, checkScreeningStatus]);
  
  // Calculate isReadOnly after supervisorData is available
  const isReadOnly = supervisorData ? isStepReadOnly(5, supervisorData) : false; // Step 5 is Upload Documents
  const [documents, setDocuments] = useState({
    photograph: null,
    signature: null,
    identityProof: null,
    apaarId: null,
    appointmentLetter: null,
  });

  const [previews, setPreviews] = useState({
    photograph: null,
    signature: null,
  });

  const [existingDocuments, setExistingDocuments] = useState(null);
  const [personalInfo, setPersonalInfo] = useState(null);
  const [documentMasters, setDocumentMasters] = useState([]);
  const [isVerified, setIsVerified] = useState(false);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null, type: null });
  const [loading, setLoading] = useState(true);

  // Crop states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropField, setCurrentCropField] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', width: 90, aspect: undefined });
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // Required dimensions
  const requiredDimensions = {
    photograph: { width: 140, height: 170 },
    signature: { width: 180, height: 70 },
  };

  // Fetch existing documents and personal info on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        if (!supId) {
          setLoading(false);
          return;
        }

        // Fetch document masters first
        try {
          const documentMastersResponse = await API.get('/DocumentMaster');
          if (documentMastersResponse.data) {
            setDocumentMasters(documentMastersResponse.data);
          }
        } catch (docError) {
          console.error('Error fetching document masters:', docError);
        }

        // Fetch personal info to get identity proof type
        try {
          const personalResponse = await API.get(`/SupervisorPersonals/RegWithPers?id=${supId}`);
          if (personalResponse.data) {
            setPersonalInfo(personalResponse.data);
          }
        } catch (personalError) {
          console.error('Error fetching personal info:', personalError);
        }

        // Fetch supervisor registration data for read-only check
        try {
          const supervisorResponse = await API.get(`/SupervisorRegistration/${supId}`);
          if (supervisorResponse.data) {
            setSupervisorData(supervisorResponse.data);
          }
        } catch (supervisorError) {
          console.error('Error fetching supervisor data:', supervisorError);
        }

        const response = await API.get(`/SupervisorUploads/${supId}`);

        if (response.data) {
          console.log('=== EXISTING DOCUMENTS RESPONSE ===');
          console.log('Full response:', response.data);
          console.log('Photo path:', response.data.photo);
          console.log('Signature path:', response.data.sign);
          console.log('apaarId path:', response.data.apaarId);
          console.log('App Letter path:', response.data.appLetter);
          console.log('=== END EXISTING DOCUMENTS ===');

          setExistingDocuments(response.data);

          // Set preview images for existing photo and signature
          if (response.data.photo) {
            setPreviews(prev => ({
              ...prev,
              photograph: `${getBaseFileURL()}/${response.data.photo}`
            }));
          }

          if (response.data.sign) {
            setPreviews(prev => ({
              ...prev,
              signature: `${getBaseFileURL()}/${response.data.sign}`
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching existing documents:', error);
        // If no existing documents found (404), that's normal for new registrations
        if (error.response?.status !== 404) {
          console.error('Unexpected error:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supId]);

  const handleFileSelect = (field, file) => {
    if (file) {
      // Validate file type for images
      if (!file.type.startsWith('image/')) {
        notification().warning('Please select a valid image file (JPG/JPEG).');
        return;
      }

      // Validate file size based on field
      const maxSize = field === 'photograph' ? 0.1 : 0.05; // 100KB for photo, 50KB for signature
      if (!validateFileSize(file, maxSize, field)) {
        return;
      }

      console.log(`${field} selected:`, file.name, 'Size:', (file.size / 1024).toFixed(2), 'KB');

      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result);
        setCurrentCropField(field);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadDocuments = async (e) => {
    e.preventDefault();

    if (isReadOnly) {
      return; // Silently prevent submission when read-only
    }

    if (!isVerified) {
      notification().warning("Please verify that photo & signature are visible properly before proceeding.");
      return;
    }

    // Check if existing documents are present
    const hasExistingDocs = existingDocuments && (
      existingDocuments.photo ||
      existingDocuments.sign ||
      existingDocuments.identityProof ||
      existingDocuments.apaarId ||
      existingDocuments.appLetter
    );

    // Check if any new documents are selected
    const hasNewDocs = documents.photograph || documents.signature || documents.identityProof || documents.apaarId || documents.appointmentLetter;

    console.log("=== EXISTING DOCUMENTS DEBUG ===");
    console.log("existingDocuments object:", existingDocuments);
    console.log("hasExistingDocs:", hasExistingDocs);
    console.log("Individual existing docs:", {
      photo: existingDocuments?.photo,
      sign: existingDocuments?.sign,
      identityProof: existingDocuments?.identityProof,
      apaarId: existingDocuments?.apaarId,
      appLetter: existingDocuments?.appLetter
    });
    console.log("hasNewDocs:", hasNewDocs);

    // Check if we have all required documents (either new or existing)
    const hasPhotograph = documents.photograph || existingDocuments?.photo;
    const hasSignature = documents.signature || existingDocuments?.sign;
    const hasapaarId = documents.apaarId || existingDocuments?.apaarId;
    const hasIdentityProof = documents.identityProof || existingDocuments?.identityProof;

    console.log("=== DOCUMENT VALIDATION DEBUG ===");
    console.log("hasPhotograph:", hasPhotograph, "(new:", !!documents.photograph, "existing:", !!existingDocuments?.photo, ")");
    console.log("hasSignature:", hasSignature, "(new:", !!documents.signature, "existing:", !!existingDocuments?.sign, ")");
    console.log("hasapaarId:", hasapaarId, "(new:", !!documents.apaarId, "existing:", !!existingDocuments?.apaarId, ")");
    console.log("hasIdentityProof:", hasIdentityProof, "(new:", !!documents.identityProof, "existing:", !!existingDocuments?.identityProof, "required:", !!personalInfo?.identityProofType, ")");

    // If no documents at all (neither new nor existing), require upload
    if (!hasExistingDocs && !hasNewDocs) {
      notification().warning("Please upload at least the required documents (photograph, signature, and apaarId).");
      return;
    }

    // Check for missing required documents
    const missingDocs = [];
    if (!hasPhotograph) missingDocs.push("photograph");
    if (!hasSignature) missingDocs.push("signature");
    if (!hasapaarId) missingDocs.push("apaarId");

    // Identity proof is required if identity proof type is set in personal info
    if (personalInfo?.identityProofType && !hasIdentityProof) {
      missingDocs.push(getDocumentNameById(personalInfo.identityProofType).toLowerCase());
    }

    if (missingDocs.length > 0) {
      notification().warning(`Please upload all required documents: ${missingDocs.join(", ")}.`);
      return;
    }

    // If existing documents exist but no new documents selected, proceed to next step
    if (hasExistingDocs && !hasNewDocs) {
      console.log("No new documents to upload, proceeding with existing documents");
      setTimeout(async () => {
        const stepSaved = await saveStep(5);
        if (stepSaved) {
          navigate(SUPERVISOR_REGISTRATION_ROUTES.PREVIEW);
        }
      }, 1500);
      return;
    }

    try {
      if (!supId) {
        notification().error("User session expired. Please login again.");
        return;
      }

      console.log("=== PREPARING DOCUMENT UPLOAD ===");
      console.log("New documents to upload:", {
        photograph: !!documents.photograph,
        signature: !!documents.signature,
        identityProof: !!documents.identityProof,
        apaarId: !!documents.apaarId,
        appointmentLetter: !!documents.appointmentLetter
      });
      console.log("Existing documents:", {
        photo: !!existingDocuments?.photo,
        sign: !!existingDocuments?.sign,
        identityProof: !!existingDocuments?.identityProof,
        apaarId: !!existingDocuments?.apaarId,
        appLetter: !!existingDocuments?.appLetter
      });

      // Determine if this is an update (existing documents present) or new upload
      const isUpdate = hasExistingDocs;
      const hasNewFiles = documents.photograph || documents.signature || documents.identityProof || documents.apaarId || documents.appointmentLetter;

      let response;

      if (isUpdate && hasNewFiles) {
        // UPDATE existing documents - use PUT API with only modified files
        console.log("🔄 UPDATING EXISTING DOCUMENTS WITH PUT API");

        const formData = new FormData();
        formData.append("SupId", supId);

        // Only append files that are actually being updated (using correct API field names)
        if (documents.photograph) {
          formData.append("Photo", documents.photograph);
          console.log("📸 Updating photograph");
        } else {
          formData.append("Photo", ""); // Send empty string for unchanged files
        }

        if (documents.signature) {
          formData.append("Signature", documents.signature);
          console.log("✍️ Updating signature");
        } else {
          formData.append("Signature", ""); // Send empty string for unchanged files
        }

        if (documents.apaarId) {
          formData.append("apaarId", documents.apaarId);
          console.log("📜 Updating apaarId");
        } else {
          formData.append("apaarId", ""); // Send empty string for unchanged files
        }

        if (documents.identityProof) {
          formData.append("IdentityProof", documents.identityProof);
          console.log("🆔 Updating identity proof");
        } else {
          formData.append("IdentityProof", ""); // Send empty string for unchanged files
        }

        if (documents.appointmentLetter) {
          formData.append("AppLetter", documents.appointmentLetter);
          console.log("📋 Updating appointment letter");
        } else {
          formData.append("AppLetter", ""); // Send empty string for unchanged files
        }

        console.log("=== PUT REQUEST PAYLOAD (UpdateDocuments API) ===");
        console.log("Endpoint: /SupervisorUploads/UpdateDocuments");
        for (let [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(`${key}: NEW FILE - ${value.name} (${value.size} bytes)`);
          } else {
            console.log(`${key}: ${value === "" ? "UNCHANGED (empty)" : value}`);
          }
        }
        console.log("=== END PUT PAYLOAD ===");

        response = await API.put(
          '/SupervisorUploads/UpdateDocuments',
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        setTimeout(async () => {
          await navigateToNextStep();
        }, 1500);

      } else {
        // CREATE new documents - use POST API
        console.log("📤 CREATING NEW DOCUMENTS WITH POST API");

        const formData = new FormData();
        formData.append("SupId", supId);

        // Append all files for new upload
        if (documents.photograph) {
          formData.append("Photo", documents.photograph);
        }
        if (documents.signature) {
          formData.append("Signature", documents.signature);
        }
        if (documents.identityProof) {
          formData.append("IdentityProof", documents.identityProof);
        }
        if (documents.apaarId) {
          formData.append("apaarId", documents.apaarId);
        }
        if (documents.appointmentLetter) {
          formData.append("AppLetter", documents.appointmentLetter);
        }

        console.log("=== POST REQUEST PAYLOAD ===");
        for (let [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(`${key}: NEW FILE - ${value.name} (${value.size} bytes)`);
          } else {
            console.log(`${key}: ${value}`);
          }
        }

        response = await API.post(
          '/SupervisorUploads/UploadDocuments',
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      console.log("Upload success:", response.data);

      const successMessage = isUpdate
        ? "Documents updated successfully!"
        : "Documents uploaded successfully!";
      notification().success(successMessage);

      setTimeout(async () => {
        await navigateToNextStep();
      }, 1500);
      // Refresh the existing documents after successful upload
      const updatedResponse = await API.get(`/SupervisorUploads/${supId}`);
      if (updatedResponse.data) {
        console.log('=== UPDATED DOCUMENTS AFTER UPLOAD ===');
        console.log('Updated response:', updatedResponse.data);
        console.log('=== END UPDATED DOCUMENTS ===');

        setExistingDocuments(updatedResponse.data);

        // Update preview images
        if (updatedResponse.data.photo) {
          setPreviews(prev => ({
            ...prev,
            photograph: `${getBaseFileURL()}/${updatedResponse.data.photo}`
          }));
        }

        if (updatedResponse.data.sign) {
          setPreviews(prev => ({
            ...prev,
            signature: `${getBaseFileURL()}/${updatedResponse.data.sign}`
          }));
        }
      }

      // Clear the form
      setDocuments({
        photograph: null,
        signature: null,
        identityProof: null,
        apaarId: null,
        appointmentLetter: null,
      });

    } catch (error) {
      console.error("Upload failed:", error);

      // More detailed error handling
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.response.statusText;

        switch (status) {
          case 405:
            notification().error("Method not allowed. Please check the API endpoint configuration.");
            break;
          case 400:
            notification().error(`Bad request: ${message}`);
            break;
          case 401:
            notification().error("Unauthorized. Please login again.");
            break;
          case 413:
            notification().error("File size too large. Please reduce file sizes and try again.");
            break;
          case 415:
            notification().error("Unsupported file type. Please check file formats.");
            break;
          case 500:
            notification().error("Server error. Please try again later.");
            break;
          default:
            notification().error(`Upload failed: ${message}`);
        }
      } else if (error.request) {
        notification().error("Network error. Please check your connection and try again.");
      } else {
        notification().error("Something went wrong while uploading!");
      }

      console.error("Full error details:", error);
    }
  };


  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
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
      unit: 'px',
      width: cropWidth,
      height: cropHeight,
      x: Math.max(0, x),
      y: Math.max(0, y),
    });
  };

  const getCroppedImg = async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    const ctx = canvas.getContext('2d');
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
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `${currentCropField}.jpg`, { type: 'image/jpeg' });
        resolve({ file, preview: canvas.toDataURL('image/jpeg') });
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCropComplete = async () => {
    const result = await getCroppedImg();
    if (result) {
      setDocuments(prev => ({ ...prev, [currentCropField]: result.file }));
      setPreviews(prev => ({ ...prev, [currentCropField]: result.preview }));
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

  const handleViewDocument = (docType) => {
    const file = documents[docType];
    if (!file) {
      notification().warning('Please select a file first before previewing.');
      return;
    }

    const fileURL = URL.createObjectURL(file);
    openFile(fileURL, `${docType}.${file.type === 'application/pdf' ? 'pdf' : 'jpg'}`);
  };

  const closePreviewModal = () => {
    if (previewModal.file) {
      URL.revokeObjectURL(previewModal.file);
    }
    setPreviewModal({ isOpen: false, file: null, type: null });
  };

  const handleDownloadExistingDocument = (documentPath, fileName) => {
    console.log('=== DOWNLOAD EXISTING DOCUMENT ===');
    console.log('Document path:', documentPath);
    console.log('File name:', fileName);

    if (documentPath) {
      const fullURL = `${getBaseFileURL()}/${documentPath}`;
      console.log('Download URL:', fullURL);

      const link = document.createElement('a');
      link.href = fullURL;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.log('No document path provided for download');
    }
    console.log('=== END DOWNLOAD EXISTING DOCUMENT ===');
  };

  const handleViewExistingDocument = (documentPath, fileName) => {
    console.log('=== VIEW EXISTING DOCUMENT ===');
    console.log('Document path:', documentPath);
    console.log('File name:', fileName);

    if (documentPath) {
      const fileURL = `${getBaseFileURL()}/${documentPath}`;
      console.log('Full file URL:', fileURL);

      openFile(fileURL, fileName);
    } else {
      console.log('No document path provided');
    }
    console.log('=== END VIEW EXISTING DOCUMENT ===');
  };

  // Helper function to get document name from ID
  const getDocumentNameById = (documentId) => {
    if (!documentId || !documentMasters.length) return 'Identity Proof'; // Fallback text
    const document = documentMasters.find(doc => doc.documentMasterID === documentId);
    return document ? document.documentName : 'Identity Proof';
  };

  // Helper function to navigate to next step
  const navigateToNextStep = async () => {
    console.log("Navigating to next step...");
    try {
      const steps = await fetchSteps(supId);
      if (steps) {
        navigate(SUPERVISOR_REGISTRATION_ROUTES.PREVIEW);
      } else {
        notification().error("Failed to update step progress. Please try again.");
      }
    } catch (error) {
      console.error("Error updating steps:", error);
      notification().error("Failed to update step progress. Please try again.");
    }
  };


  const validateFileSize = (file, maxSizeMB, fieldName) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    if (file.size > maxSizeBytes) {
      notification().warning(`File size exceeds the maximum allowed size of ${maxSizeMB} MB for ${fieldName}. Please upload a file within the defined size limit.`);
      return false;
    }
    return true;
  };

  const handlePDFFileSelect = (field, file, maxSizeMB, fieldName) => {
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        notification().warning(`Please select a PDF file for ${fieldName}.`);
        return;
      }

      if (validateFileSize(file, maxSizeMB, fieldName)) {
        setDocuments(prev => ({ ...prev, [field]: file }));
        console.log(`${fieldName} selected:`, file.name, 'Size:', (file.size / 1024).toFixed(2), 'KB');
      }
    }
  };



  const inputClass = `w-full px-3 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-transparent font-inter text-sm ${isReadOnly ? 'bg-amber-50 cursor-not-allowed border-amber-300 text-amber-800' : ''
    }`;

  const requiredDims = currentCropField ? requiredDimensions[currentCropField] : { width: 0, height: 0 };

  return (
    <div className="p-4 md:p-5">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af]"></div>
          <span className="ml-2 text-[#6b7280]">Loading existing documents...</span>
        </div>
      )}

      {/* Existing Documents Section */}
      {!loading && existingDocuments && (
        <div className="mb-6 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg">
          <h3 className="text-lg font-bold text-[#0c4a6e] mb-4 font-inter">
            Previously Uploaded Documents
          </h3>


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Existing Photo */}
            {existingDocuments.photo && (
              <div className="bg-white p-3 rounded-lg border border-[#e0e7ff]">
                <h4 className="font-semibold text-[#374151] mb-2 text-sm">Photograph</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewExistingDocument(existingDocuments.photo, 'photograph.jpg')}
                    className="flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadExistingDocument(existingDocuments.photo, 'photograph.jpg')}
                    className="flex items-center gap-1 text-xs text-[#059669] hover:text-[#047857] font-medium transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Existing Signature */}
            {existingDocuments.sign && (
              <div className="bg-white p-3 rounded-lg border border-[#e0e7ff]">
                <h4 className="font-semibold text-[#374151] mb-2 text-sm">Signature</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewExistingDocument(existingDocuments.sign, 'signature.jpg')}
                    className="flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadExistingDocument(existingDocuments.sign, 'signature.jpg')}
                    className="flex items-center gap-1 text-xs text-[#059669] hover:text-[#047857] font-medium transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Existing apaarId*/}
            {existingDocuments.apaarId && (
              <div className="bg-white p-3 rounded-lg border border-[#e0e7ff]">
                <h4 className="font-semibold text-[#374151] mb-2 text-sm">ApaarId</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewExistingDocument(existingDocuments.apaarId, 'apaarId-.pdf')}
                    className="flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadExistingDocument(existingDocuments.apaarId, 'apaarId-.pdf')}
                    className="flex items-center gap-1 text-xs text-[#059669] hover:text-[#047857] font-medium transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Existing Identity Proof */}
            {existingDocuments.identityProof && personalInfo?.identityProofType && (
              <div className="bg-white p-3 rounded-lg border border-[#e0e7ff]">
                <h4 className="font-semibold text-[#374151] mb-2 text-sm">{getDocumentNameById(personalInfo.identityProofType)}</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewExistingDocument(existingDocuments.identityProof, `${getDocumentNameById(personalInfo.identityProofType).toLowerCase().replace(/\s+/g, '-')}.pdf`)}
                    className="flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadExistingDocument(existingDocuments.identityProof, `${getDocumentNameById(personalInfo.identityProofType).toLowerCase().replace(/\s+/g, '-')}.pdf`)}
                    className="flex items-center gap-1 text-xs text-[#059669] hover:text-[#047857] font-medium transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Existing Appointment Letter */}
            {existingDocuments.appLetter && (
              <div className="bg-white p-3 rounded-lg border border-[#e0e7ff]">
                <h4 className="font-semibold text-[#374151] mb-2 text-sm">Appointment Letter</h4>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewExistingDocument(existingDocuments.appLetter, 'appointment-letter.pdf')}
                    className="flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadExistingDocument(existingDocuments.appLetter, 'appointment-letter.pdf')}
                    className="flex items-center gap-1 text-xs text-[#059669] hover:text-[#047857] font-medium transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-[#dbeafe] rounded-md">
            <p className="text-sm text-[#1e40af] font-medium">
              📋 You can upload new documents below to replace the existing ones, or click "Skip to Next" to proceed with current documents.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={uploadDocuments} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#111827] font-inter">
              {existingDocuments ? 'Upload New Documents (Optional)' : 'Upload Documents'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Upload Fields */}
            <div className="space-y-5">
              {/* Photograph Upload */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                  Photograph<span className="text-red-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg"
                  onChange={(e) => handleFileSelect('photograph', e.target.files[0])}
                  className={inputClass}
                  disabled={isReadOnly}
                />
                <div className="mt-1 text-xs text-[#6b7280] space-y-0.5">
                  <p>Allowed File Size: 5 to 100 Kb.</p>
                  <p>Format: JPG/JPEG</p>
                  <p>Image Size: Width - 140px, Height - 170px</p>
                </div>
                {documents.photograph && (
                  <div className="mt-2 text-xs text-green-600 font-medium">
                    ✓ Photo cropped and ready: {documents.photograph.name}
                  </div>
                )}
              </div>

              {/* Signature Upload */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                  Signature<span className="text-red-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg"
                  onChange={(e) => handleFileSelect('signature', e.target.files[0])}
                  className={inputClass}
                  disabled={isReadOnly}
                />
                <div className="mt-1 text-xs text-[#6b7280] space-y-0.5">
                  <p>Allowed File Size: 2 to 50 Kb.</p>
                  <p>Format: JPG/JPEG</p>
                  <p>Image Size: Width - 180px, Height - 70px</p>
                </div>
                {documents.signature && (
                  <div className="mt-2 text-xs text-green-600 font-medium">
                    ✓ Signature cropped and ready: {documents.signature.name}
                  </div>
                )}
              </div>

              {/* Identity Proof Upload */}
              {personalInfo?.identityProofType && (
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                    Upload {getDocumentNameById(personalInfo.identityProofType)}<span className="text-red-600">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.type === 'application/pdf') {
                          handlePDFFileSelect('identityProof', file, 1, getDocumentNameById(personalInfo.identityProofType));
                        } else if (file.type.startsWith('image/')) {
                          // Handle image files for identity proof (no cropping needed, 1MB limit)
                          if (validateFileSize(file, 1, getDocumentNameById(personalInfo.identityProofType))) {
                            setDocuments(prev => ({ ...prev, identityProof: file }));
                            console.log(`Identity proof image selected:`, file.name, 'Size:', (file.size / 1024).toFixed(2), 'KB');
                          }
                        } else {
                          notification().warning('Please select a PDF or image file for identity proof.');
                        }
                      }
                      e.target.value = '';
                    }}
                    className={inputClass}
                    disabled={isReadOnly}
                  />
                  <div className="mt-1 text-xs text-[#6b7280] space-y-0.5">
                    <p>Allowed File Size: 1 Mb.</p>
                    <p>Format: PDF, JPG/JPEG</p>
                  </div>
                  {documents.identityProof && (
                    <div className="mt-2 text-xs text-green-600 font-medium">
                      ✓ File selected: {documents.identityProof.name}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleViewDocument('identityProof')}
                    className="mt-2 flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                  >
                    <Eye size={14} />
                    View {getDocumentNameById(personalInfo.identityProofType)}
                  </button>
                </div>
              )}

              {/* apaarId Upload */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                  Upload ApaarId<span className="text-red-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handlePDFFileSelect('apaarId', file, 1, 'apaarId');
                    }
                    // Reset input value to allow re-selecting the same file
                    e.target.value = '';
                  }}
                  className={inputClass}
                />
                <div className="mt-1 text-xs text-[#6b7280] space-y-0.5">
                  <p>Allowed File Size: 1 Mb.</p>
                  <p>Format: PDF</p>
                </div>
                {documents.apaarId && (
                  <div className="mt-2 text-xs text-green-600 font-medium">
                    ✓ File selected: {documents.apaarId.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleViewDocument('apaarId')}
                  className="mt-2 flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                >
                  <Eye size={14} />
                  View apaarId
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                  Upload Regular Faculty Appointment Letter<span className="text-red-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handlePDFFileSelect('appointmentLetter', file, 1, 'Regular Faculty Appointment Letter');
                    }
                    // Reset input value to allow re-selecting the same file
                    e.target.value = '';
                  }}
                  className={inputClass}
                />
                <div className="mt-1 text-xs text-[#6b7280] space-y-0.5">
                  <p>Allowed File Size: 1 Mb.</p>
                  <p>Format: PDF</p>
                </div>
                {documents.appointmentLetter && (
                  <div className="mt-2 text-xs text-green-600 font-medium">
                    ✓ File selected: {documents.appointmentLetter.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleViewDocument('appointmentLetter')}
                  className="mt-2 flex items-center gap-1 text-xs text-[#1e40af] hover:text-[#1e3a8a] font-medium transition-colors"
                >
                  <Eye size={14} />
                  View Letter
                </button>
              </div>

              {/* Verification Checkbox */}
              <div className="flex items-start gap-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-md">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className={`w-4 h-4 mt-0.5 border-[#d1d5db] rounded focus:ring-1 focus:ring-[#dc2626] ${isReadOnly
                    ? 'text-amber-600 bg-amber-50 border-amber-300 cursor-not-allowed'
                    : 'text-[#dc2626]'
                    }`}
                  disabled={isReadOnly}
                />
                <label className="text-xs text-[#dc2626] font-medium font-inter">
                  I verify that photo & signature are visible properly and meet the required specifications
                </label>
              </div>
            </div>

            {/* Right Column - Previews */}
            <div className="space-y-5">
              {/* Photo Preview */}
              <div>
                <h3 className="text-sm font-semibold text-[#374151] mb-2 font-inter">Photo Preview</h3>
                <div className="border-2 border-dashed border-[#d1d5db] rounded-lg p-4 flex items-center justify-center bg-[#f9fafb]" style={{ height: '200px' }}>
                  {previews.photograph ? (
                    <img
                      src={previews.photograph}
                      alt="Photograph Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-[#9ca3af]">
                      <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Image not available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Signature Preview */}
              <div>
                <h3 className="text-sm font-semibold text-[#374151] mb-2 font-inter">Signature Preview</h3>
                <div className="border-2 border-dashed border-[#d1d5db] rounded-lg p-4 flex items-center justify-center bg-[#f9fafb]" style={{ height: '120px' }}>
                  {previews.signature ? (
                    <img
                      src={previews.signature}
                      alt="Signature Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-[#9ca3af]">
                      <FileText size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Signature not available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-3 border-t border-[#e5e7eb]">
          {existingDocuments && !isReadOnly && (
            <button
              type="button"
              onClick={() => {
                if (!isVerified) {
                  notification().warning("Please verify that photo & signature are visible properly before proceeding.");
                  return;
                }
                console.log("Skipping to next step with existing documents");
                setTimeout(async () => {
                  const stepSaved = await saveStep(5);
                  if (stepSaved) {
                    navigate(SUPERVISOR_REGISTRATION_ROUTES.PREVIEW);
                  }
                }, 1500);
              }}
              disabled={!isVerified}
              className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${
                !isVerified
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed border border-gray-300'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] hover:shadow-lg'
              }`}
            >
              Skip to Next
              <ChevronRight size={18} />
            </button>
          )}

          <button
            type="submit"
            onClick={uploadDocuments}
            disabled={!isVerified || isReadOnly}
            className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 shadow-md ${!isVerified || isReadOnly
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed border border-gray-300'
              : 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-700 hover:to-green-600 active:scale-[0.98] hover:shadow-lg'
              }`}
          >
            {existingDocuments ? 'Update & Next' : 'Save & Next'}
            <ChevronRight size={18} />
          </button>
        </div>
      </form>

      {/* Crop Modal */}
      {cropModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-[#e5e7eb] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#111827] font-inter">
                Crop {currentCropField === 'photograph' ? 'Photograph' : 'Signature'}
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
                  <p className="font-semibold text-[#1e40af] mb-1">Required Dimensions (Fixed)</p>
                  <p className="text-[#374151]">Width: {requiredDims.width}px × Height: {requiredDims.height}px</p>
                  <p className="text-xs text-[#6b7280] mt-1">Drag the crop area to position your image</p>
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
                    style={{ maxHeight: '60vh', maxWidth: '100%' }}
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
      {FileViewerModal}
    </div>
  );
};

export default UploadDocuments;
