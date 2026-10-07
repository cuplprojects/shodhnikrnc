import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Edit2, Plus, Save, Upload, FileText, CheckCircle, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Checkbox, Button, message } from 'antd';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import { useFileViewer } from '@/services/FileViewerService';

const EducationalDetails = () => {
  const { getSId } = useScholarRegAuthStore();
  const { saveStep, isReadOnly } = useSteps();
  const scholarId = getSId();
  useStepRefresh();
  const navigate = useNavigate();
  const { FileViewerModal, openFile } = useFileViewer();

  // Constants
  const EDUCATION_LEVELS = [
    { id: 1, level: 'High School(10th)', nameOfExamination: 'High School(10th)', documentMasterID: 12 },
    { id: 2, level: 'Intermediate(12th)', nameOfExamination: 'Intermediate(12th)', documentMasterID: 14 },
    { id: 3, level: 'Graduation', nameOfExamination: 'Graduation', documentMasterID: 3 },
    { id: 4, level: 'Post Graduation', nameOfExamination: 'Post Graduation', documentMasterID: 4 },
  ];

  const INITIAL_EDUCATION_DATA = EDUCATION_LEVELS.map(level => ({
    ...level,
    board: '', year: '', stream: '', subject: '', marksObtained: '', maxMarks: '',
    cgpaPercentage: '', division: '', isAppearing: false, documentFile: null,
    documentUploaded: false, uploadedFileName: '', uploadedDocumentPath: '', scholarUploadId: null,
    markingType: 'Percentage' // 'Percentage' or 'CGPA'
  }));

  const DIVISION_OPTIONS = ['First', 'Second', 'Third'];
  const CURRENT_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);
  const ALLOWED_MIME_TYPES = ['application/pdf'];
  const ALLOWED_EXTENSIONS = ['.pdf'];

  // State
  const [educationData, setEducationData] = useState(INITIAL_EDUCATION_DATA);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documentMasters, setDocumentMasters] = useState([]);
  const [uploadingDocuments, setUploadingDocuments] = useState({});
  const [lastValidationError, setLastValidationError] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [recentUploads, setRecentUploads] = useState({});

  // Utility Functions
  const getDocumentMasterID = (level) => {
    const levelData = EDUCATION_LEVELS.find(l => l.level === level);
    return levelData?.documentMasterID;
  };

  const getValidationInstructions = () => {
    return {
      maxFileSize: 1,
      allowedFormats: 'PDF',
      instructions: [
        'Upload marksheet/certificate PDF for each educational qualification',
        'Accepted format: PDF only (Max size: 1MB)',
        'Documents should be clear and readable',
        'For Post Graduation appearing candidates, upload provisional certificate PDF if available',
        'Click "View Document" to preview uploaded PDFs'
      ]
    };
  };

  const getValidationMessageForLevel = (level) => {
    return 'Max file size: 1MB';
  };

  const fetchUserCategory = async () => {
    try {
      const response = await API.get(`/ScholarPersonalDetails/GetPersonalDetailBySID?sid=${scholarId}`);
      return response.data?.category || null;
    } catch (error) {
      console.log('Could not fetch user category:', error);
      return null;
    }
  };

  const calculatePercentage = (obtained, max) => {
    const obtainedMarks = parseFloat(obtained) || 0;
    const maxMarks = parseFloat(max) || 0;
    if (obtainedMarks > 0 && maxMarks > 0) {
      const percentage = (obtainedMarks / maxMarks) * 100;
      // Cap percentage at 100%
      return Math.min(percentage, 100).toFixed(2);
    }
    return '';
  };

  const validateYearSequence = (currentLevel, selectedYear, allData) => {
    const notify = notification();
    const years = {
      'High School(10th)': parseInt(allData.find(p => p.level === 'High School(10th)')?.year) || 0,
      'Intermediate(12th)': parseInt(allData.find(p => p.level === 'Intermediate(12th)')?.year) || 0,
      'Graduation': parseInt(allData.find(p => p.level === 'Graduation')?.year) || 0,
      'Post Graduation': parseInt(allData.find(p => p.level === 'Post Graduation')?.year) || 0
    };

    const validations = {
      'High School(10th)': () => {
        if (years['Intermediate(12th)'] && selectedYear >= years['Intermediate(12th)']) {
          return `High School year (${selectedYear}) must be less than Intermediate year (${years['Intermediate(12th)']})`;
        }
        if (years['Intermediate(12th)'] && (years['Intermediate(12th)'] - selectedYear) < 2) {
          return `Minimum 2 years gap required between High School (${selectedYear}) and Intermediate (${years['Intermediate(12th)']})`;
        }
        return null;
      },
      'Intermediate(12th)': () => {
        if (years['High School(10th)'] && selectedYear <= years['High School(10th)']) {
          return `Intermediate year (${selectedYear}) must be greater than High School year (${years['High School(10th)']})`;
        }
        if (years['High School(10th)'] && (selectedYear - years['High School(10th)']) < 2) {
          return `Minimum 2 years gap required between High School (${years['High School(10th)']}) and Intermediate (${selectedYear})`;
        }
        if (years['Graduation'] && selectedYear >= years['Graduation']) {
          return `Intermediate year (${selectedYear}) must be less than Graduation year (${years['Graduation']})`;
        }
        if (years['Graduation'] && (years['Graduation'] - selectedYear) < 3) {
          return `Minimum 3 years gap required between Intermediate (${selectedYear}) and Graduation (${years['Graduation']})`;
        }
        return null;
      },
      'Graduation': () => {
        if (years['Intermediate(12th)'] && selectedYear <= years['Intermediate(12th)']) {
          return `Graduation year (${selectedYear}) must be greater than Intermediate year (${years['Intermediate(12th)']})`;
        }
        if (years['Intermediate(12th)'] && (selectedYear - years['Intermediate(12th)']) < 3) {
          return `Minimum 3 years gap required between Intermediate (${years['Intermediate(12th)']}) and Graduation (${selectedYear})`;
        }
        if (years['Post Graduation'] && selectedYear > years['Post Graduation']) {
          return `Graduation year (${selectedYear}) cannot be greater than Post Graduation year (${years['Post Graduation']})`;
        }
        return null;
      },
      'Post Graduation': () => {
        if (years['Graduation'] && selectedYear < years['Graduation']) {
          return `Post Graduation year (${selectedYear}) cannot be less than Graduation year (${years['Graduation']})`;
        }
        if (years['Graduation'] && (selectedYear - years['Graduation']) < 2) {
          return `Minimum 2 years gap required between Graduation (${years['Graduation']}) and Post Graduation (${selectedYear})`;
        }
        return null;
      }
    };

    const errorMessage = validations[currentLevel]?.();
    if (errorMessage) {
      if (lastValidationError !== errorMessage) {
        notify.error(errorMessage);
        setLastValidationError(errorMessage);
      }
      return false;
    }

    if (lastValidationError) setLastValidationError('');
    return true;
  };

  const validatePostGradPercentage = async (percentage, level) => {
    if (level === 'Post Graduation' && percentage > 0) {
      const notify = notification();
      try {
        const userCategory = await fetchUserCategory();
        if (userCategory) {
          const requiredPercentage = userCategory === 'General' ? 55 : 50;
          if (percentage < requiredPercentage) {
            notify.warning(`Warning: ${percentage}% is below required ${requiredPercentage}% for ${userCategory} category. Consider marking as "Appearing" if still completing Post Graduation, otherwise you may not be eligible for next step.`);
          }
        }
      } catch (error) {
        console.log('Error validating percentage:', error);
      }
    }
  };

  // Data Loading Functions
  const loadExistingUploads = async () => {
    try {
      const timestamp = new Date().getTime();
      const uploadsResponse = await API.get(`/ScholarUpload/GetBySID?sid=${scholarId}&t=${timestamp}`);

      if (uploadsResponse.data && Array.isArray(uploadsResponse.data)) {
        setEducationData(prev => prev.map(item => {
          const documentMasterID = getDocumentMasterID(item.level);
          const matchingUpload = uploadsResponse.data.find(upload => upload.documentMasterID === documentMasterID);

          if (matchingUpload) {
            let fileName = 'Uploaded PDF';
            if (matchingUpload.path) {
              const pathParts = matchingUpload.path.split(/[/\\]/);
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && lastPart.includes('.')) fileName = lastPart;
            }

            const recentUpload = recentUploads[item.id];
            const finalFileName = (recentUpload && (Date.now() - recentUpload.timestamp) < 60000)
              ? recentUpload.fileName
              : (item.uploadedFileName && item.uploadedFileName !== 'Uploaded PDF' && item.uploadedFileName !== '')
                ? item.uploadedFileName
                : fileName;

            return {
              ...item,
              documentUploaded: true,
              uploadedDocumentPath: matchingUpload.path,
              uploadedFileName: finalFileName,
              scholarUploadId: matchingUpload.scholarUploadID
            };
          }

          return {
            ...item,
            documentUploaded: false,
            uploadedDocumentPath: '',
            uploadedFileName: '',
            scholarUploadId: null
          };
        }));
      }
    } catch (uploadError) {
      console.log('No existing uploads found:', uploadError);
    }
  };

  // Event Handlers
  const handleEdit = (id) => setEditingId(id);
  const handleSave = () => setEditingId(null);

  const handleChange = (id, field, value) => {
    setEducationData(prev => prev.map(item => {
      if (item.id !== id) return item;

      // Handle isAppearing toggle for Post Graduation
      if (field === 'isAppearing' && value === true && item.level === 'Post Graduation') {
        return { ...item, [field]: value, marksObtained: '', maxMarks: '', cgpaPercentage: '', division: '', year: '' };
      }

      // Handle markingType change
      if (field === 'markingType') {
        // When switching to Percentage, recalculate from marks
        if (value === 'Percentage') {
          const calculatedPercentage = calculatePercentage(item.marksObtained, item.maxMarks);
          return { ...item, [field]: value, cgpaPercentage: calculatedPercentage };
        }
        // When switching to CGPA, clear the cgpaPercentage for manual entry
        return { ...item, [field]: value, cgpaPercentage: '' };
      }

      // Year validation
      if (field === 'year') {
        const selectedYear = parseInt(value);
        if (!validateYearSequence(item.level, selectedYear, prev)) {
          return item;
        }
      }

      // Prevent negative values for numeric fields
      if (['marksObtained', 'maxMarks', 'cgpaPercentage'].includes(field)) {
        const numValue = parseFloat(value);
        if (numValue < 0) {
          return item; // Don't update if negative
        }
      }

      // CGPA validation - max 10
      if (field === 'cgpaPercentage' && (item.markingType || 'Percentage') === 'CGPA') {
        const cgpaValue = parseFloat(value);
        if (cgpaValue > 10) {
          return item; // Don't update if CGPA > 10
        }
      }

      // Marks validation and percentage calculation (only for Percentage marking type)
      if (field === 'marksObtained') {
        const markingType = item.markingType || 'Percentage';
        if (markingType === 'Percentage') {
          const calculatedPercentage = calculatePercentage(value, item.maxMarks);
          if (calculatedPercentage) {
            validatePostGradPercentage(parseFloat(calculatedPercentage), item.level);
          }
          if (lastValidationError) setLastValidationError('');
          return { ...item, [field]: value, cgpaPercentage: calculatedPercentage };
        }
        // For CGPA type, just update marks without auto-calculation
        if (lastValidationError) setLastValidationError('');
        return { ...item, [field]: value };
      }

      if (field === 'maxMarks') {
        const markingType = item.markingType || 'Percentage';
        if (markingType === 'Percentage') {
          const calculatedPercentage = calculatePercentage(item.marksObtained, value);
          if (lastValidationError) setLastValidationError('');
          return { ...item, [field]: value, cgpaPercentage: calculatedPercentage };
        }
        // For CGPA type, just update marks without auto-calculation
        if (lastValidationError) setLastValidationError('');
        return { ...item, [field]: value };
      }

      // CGPA/Percentage validation for Post Graduation - only validate if manually entered
      if (field === 'cgpaPercentage' && item.level === 'Post Graduation') {
        const percentage = parseFloat(value) || 0;
        // Validate percentage doesn't exceed 100%
        if (percentage > 100) {
          const notify = notification();
          notify.error('Percentage cannot exceed 100%');
          return item;
        }
        if (percentage > 0 && (item.markingType || 'Percentage') === 'Percentage') {
          validatePostGradPercentage(percentage, item.level);
        }
      }

      // Validate percentage doesn't exceed 100% for all levels
      if (field === 'cgpaPercentage' && (item.markingType || 'Percentage') === 'Percentage') {
        const percentage = parseFloat(value) || 0;
        if (percentage > 100) {
          const notify = notification();
          notify.error('Percentage cannot exceed 100%');
          return item;
        }
      }

      if (['marksObtained', 'maxMarks', 'year'].includes(field) && lastValidationError) {
        setLastValidationError('');
      }

      return { ...item, [field]: value };
    }));
  };

  // Document Upload Functions
  const validateFile = (file, level) => {
    const notify = notification();
    const documentMasterID = getDocumentMasterID(level);
    const documentMaster = documentMasters.find(doc => doc.documentMasterID === documentMasterID);

    // Validate file type
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isValidMimeType && !isValidExtension) {
      notify.error('Please upload only PDF files');
      return false;
    }

    // Validate file size - 1MB limit
    const maxSizeBytes = 1 * 1024 * 1024; // 1MB limit
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    if (file.size > maxSizeBytes) {
      notify.error(
        `File size exceeds the limit. Your file is ${fileSizeMB}MB but maximum allowed size is 1MB. Please compress the PDF and try again.`
      );
      return false;
    }

    return true;
  };

  const handleDocumentUpload = async (file, educationId) => {
    const notify = notification();
    const educationItem = educationData.find(item => item.id === educationId);

    if (!educationItem) {
      notify.error('Education level not found');
      return false;
    }

    if (!validateFile(file, educationItem.level)) {
      return false;
    }

    try {
      setUploadingDocuments(prev => ({ ...prev, [educationId]: true }));

      const formData = new FormData();
      formData.append('SID', scholarId);
      formData.append('DocumentMasterID', getDocumentMasterID(educationItem.level));
      formData.append('File', file);
      formData.append('OriginalFileName', file.name);

      const response = await API.post('/ScholarUpload/Upsert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data) {
        const newFilePath = response.data.entity?.path || response.data.existing?.path;
        const newUploadId = response.data.entity?.scholarUploadID || response.data.existing?.scholarUploadID;

        // Track recent upload
        setRecentUploads(prev => ({
          ...prev,
          [educationId]: {
            fileName: file.name,
            filePath: newFilePath,
            uploadId: newUploadId,
            timestamp: Date.now()
          }
        }));

        // Update education data
        setEducationData(prev => prev.map(item => {
          if (item.id === educationId) {
            return {
              ...item,
              documentFile: file,
              documentUploaded: true,
              uploadedDocumentPath: newFilePath,
              uploadedFileName: file.name,
              scholarUploadId: newUploadId
            };
          }
          return item;
        }));

        // Force re-render and cleanup
        setTimeout(() => {
          setUploadKey(prev => prev + 1);
          setForceUpdate(prev => prev + 1);

          setRecentUploads(prev => {
            const now = Date.now();
            const cleaned = {};
            Object.keys(prev).forEach(key => {
              if (now - prev[key].timestamp < 60000) {
                cleaned[key] = prev[key];
              }
            });
            return cleaned;
          });
        }, 100);

        setTimeout(() => loadExistingUploads(), 5000);

        notify.success(`PDF uploaded successfully for ${educationItem.level}`);
        return true;
      }
    } catch (error) {
      console.error('Document upload error:', error);
      notify.error(error.response?.data?.message || 'Failed to upload PDF');
      return false;
    } finally {
      setUploadingDocuments(prev => ({ ...prev, [educationId]: false }));
    }
  };

  // Document Upload Component
  const DocumentUpload = ({ educationId, educationLevel, isUploaded, isUploading, uploadedFileName, uploadedFilePath, isAppearing }) => {
    const fileInputRef = useRef(null);

    const handleFileSelect = async (event) => {
      const file = event.target.files[0];
      if (file) {
        setEducationData(prev => prev.map(item => {
          if (item.id === educationId) {
            return { ...item, uploadedFileName: file.name };
          }
          return item;
        }));

        await handleDocumentUpload(file, educationId);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    const handleViewDocument = () => {
      if (uploadedFilePath) {
        try {
          const timestamp = new Date().getTime();
          const fileUrl = `${getBaseFileURL()}/${uploadedFilePath}?t=${timestamp}`;
          openFile(fileUrl, `${educationLevel} - ${uploadedFileName || 'Document'}`);
        } catch (error) {
          console.error('Error preparing document view:', error);
          notification().error('Unable to view document. Please try again.');
        }
      }
    };

    if (isAppearing) {
      return (
        <div className="w-full text-center">
          <span className="text-xs text-gray-500 italic">Not required for appearing candidates</span>
        </div>
      );
    }

    return (
      <div className="w-full" key={`doc-upload-${educationId}-${uploadKey}-${forceUpdate}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          key={`file-input-${educationId}-${uploadKey}-${forceUpdate}`}
        />

        <div className="flex flex-col items-center mb-2">
          <Button
            size="small"
            icon={isUploading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div> : <Upload size={12} />}
            className={`text-xs h-7 px-3 ${isUploaded ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}
            disabled={isReadOnly || isUploading}
            onClick={() => fileInputRef.current?.click()}
            title={getValidationMessageForLevel(educationLevel)}
          >
            {isUploading ? 'Uploading...' : isUploaded ? 'Re-upload' : 'Upload'}
          </Button>
        </div>

        {isUploaded ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-xs text-green-700 font-medium">Uploaded</span>
            </div>
            <Button
              size="small"
              type="link"
              icon={<Eye size={12} />}
              className="text-xs p-1 h-auto text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
              onClick={handleViewDocument}
              title="View uploaded PDF"
            >
              View
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-xs text-gray-500">No PDF uploaded</div>
          </div>
        )}
      </div>
    );
  };

  // Validation Functions
  const validateEducationData = async () => {
    const notify = notification();

    // Validate first 3 qualifications (required)
    for (let i = 0; i < 3; i++) {
      const item = educationData[i];

      // Both CGPA and Percentage require marks obtained and max marks
      if (!item.board || !item.year || !item.marksObtained || !item.maxMarks || !item.cgpaPercentage || !item.division) {
        notify.error(`Please fill all fields for ${item.level}`);
        return false;
      }

      if (parseFloat(item.marksObtained) > parseFloat(item.maxMarks)) {
        notify.error(`Marks Obtained cannot be greater than Max Marks for ${item.level}`);
        return false;
      }

      // Validate CGPA is within range if CGPA type
      if (item.markingType === 'CGPA') {
        const cgpa = parseFloat(item.cgpaPercentage);
        if (cgpa <= 0 || cgpa > 10) {
          notify.error(`CGPA for ${item.level} must be between 0 and 10`);
          return false;
        }
      }

      if (!item.documentUploaded) {
        notify.error(`Please upload PDF for ${item.level}`);
        return false;
      }
    }

    // Year sequence validation
    const years = educationData.map(item => parseInt(item.year) || 0);
    const validationChecks = [
      { condition: years[0] && years[1] && years[0] >= years[1], message: `High School year (${years[0]}) must be less than Intermediate year (${years[1]})` },
      { condition: years[0] && years[1] && (years[1] - years[0]) < 2, message: `Minimum 2 years gap required between High School (${years[0]}) and Intermediate (${years[1]})` },
      { condition: years[1] && years[2] && years[1] >= years[2], message: `Intermediate year (${years[1]}) must be less than Graduation year (${years[2]})` },
      { condition: years[1] && years[2] && (years[2] - years[1]) < 3, message: `Minimum 3 years gap required between Intermediate (${years[1]}) and Graduation (${years[2]})` }
    ];

    for (const check of validationChecks) {
      if (check.condition) {
        notify.error(check.message);
        return false;
      }
    }

    // Post Graduation validation
    const postGrad = educationData[3];
    const hasPostGradData = postGrad.board || postGrad.year || postGrad.stream || postGrad.subject ||
      postGrad.marksObtained || postGrad.maxMarks || postGrad.cgpaPercentage || postGrad.division;

    if (!postGrad.isAppearing) {
      if (hasPostGradData) {
        // Priority: Validate percentage/CGPA first
        if (postGrad.cgpaPercentage && postGrad.markingType === 'Percentage') {
          const userCategory = await fetchUserCategory();
          if (userCategory) {
            const percentage = parseFloat(postGrad.cgpaPercentage);
            const requiredPercentage = userCategory === 'General' ? 55 : 50;

            if (percentage < requiredPercentage) {
              notify.error(`Post Graduation percentage validation failed: You have ${percentage}% but ${userCategory} category requires minimum ${requiredPercentage}%. Either achieve the required percentage or mark as "Appearing/Appeared in final Year/Semester" if you are still completing your Post Graduation. You are not eligible for the next step with current percentage.`);
              return false;
            }
          }
        }

        // Check all required fields - marks are required for both CGPA and Percentage
        if (!postGrad.board || !postGrad.year || !postGrad.stream || !postGrad.subject ||
          !postGrad.marksObtained || !postGrad.maxMarks || !postGrad.cgpaPercentage || !postGrad.division) {
          notify.error('Please fill all fields for Post Graduation or mark as appearing');
          return false;
        }

        // Validate marks obtained is not greater than max marks
        if (parseFloat(postGrad.marksObtained) > parseFloat(postGrad.maxMarks)) {
          notify.error('Marks Obtained cannot be greater than Max Marks for Post Graduation');
          return false;
        }

        // Validate CGPA is within range if CGPA type
        if (postGrad.markingType === 'CGPA') {
          const cgpa = parseFloat(postGrad.cgpaPercentage);
          if (cgpa <= 0 || cgpa > 10) {
            notify.error('Post Graduation CGPA must be between 0 and 10');
            return false;
          }
        }

        // Year validation for Post Graduation
        if (years[2] && years[3] && years[3] < years[2]) {
          notify.error(`Post Graduation year (${years[3]}) cannot be less than Graduation year (${years[2]})`);
          return false;
        }

        // Post Graduation document upload is optional - just show warning
        if (!postGrad.documentUploaded) {
          notify.warning('Post Graduation PDF upload is optional but recommended');
        }
      } else {
        notify.error('Please fill Post Graduation details or mark as appearing');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!(await validateEducationData())) return;

    setIsSubmitting(true);
    const notify = notification();

    try {
      const dataToSubmit = educationData.map(item => {
        const isPostGradAppearing = item.isAppearing && item.level === 'Post Graduation';

        return {
          aqid: item.aqid || 0,
          nameOfExamination: item.nameOfExamination,
          boardUniversityName: isPostGradAppearing ? (item.board || "Appearing") : item.board,
          stream: isPostGradAppearing ? (item.stream || "Appearing") : item.stream,
          subject: isPostGradAppearing ? (item.subject || "Appearing") : item.subject,
          marksObitained: isPostGradAppearing ? 0 : parseInt(item.marksObtained) || 0,
          maxMarks: isPostGradAppearing ? 0 : parseInt(item.maxMarks) || 0,
          markingRule: isPostGradAppearing ? "Appearing" : item.markingType,
          percentageOrCGPA: isPostGradAppearing ? 0 : parseFloat(item.cgpaPercentage) || 0,
          division: isPostGradAppearing ? "Appearing" : item.division,
          passingYear: isPostGradAppearing ? 0 : parseInt(item.year) || 0,
          sid: scholarId,
          isAppearing: isPostGradAppearing
        };
      });

      for (const qualification of dataToSubmit) {
        if (qualification.aqid && qualification.aqid > 0) {
          await API.put(`/ScholarAcademicQualifications/${qualification.aqid}`, qualification);
        } else {
          await API.post('/ScholarAcademicQualifications', qualification);
        }
      }

      notify.success('Educational details saved successfully!');

      setTimeout(async () => {
        const stepSaved = await saveStep(2);
        if (stepSaved) {
          navigate('/register-scholar/upload-documents');
        }
      }, 1500);

    } catch (error) {
      console.error('Error submitting educational data:', error);
      if (error.response?.data?.message) {
        notify.error(error.response.data.message);
      } else if (error.response?.status === 400) {
        notify.error('Please check your input data and try again.');
      } else {
        notify.error('Error saving educational details. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effects
  useEffect(() => {
    const fetchAcademicData = async () => {
      try {
        setIsLoading(true);

        // Fetch document masters
        try {
          const allDocsResponse = await API.get('/DocumentMaster');
          if (allDocsResponse.data && Array.isArray(allDocsResponse.data)) {
            setDocumentMasters(allDocsResponse.data);
          }
        } catch (error) {
          console.log('Could not fetch document masters (not critical):', error);
        }

        // Fetch existing academic qualifications
        const response = await API.get(`/ScholarAcademicQualifications/GetAcademicBySID?sid=${scholarId}`);

        if (response.data && Array.isArray(response.data)) {
          const mappedData = educationData.map(item => {
            const apiItem = response.data.find(api => api.nameOfExamination === item.nameOfExamination);
            if (apiItem) {
              return {
                ...item,
                board: apiItem.boardUniversityName || '',
                year: apiItem.passingYear || '',
                stream: apiItem.stream || '',
                subject: apiItem.subject || '',
                marksObtained: apiItem.marksObitained || '',
                maxMarks: apiItem.maxMarks || '',
                cgpaPercentage: apiItem.percentageOrCGPA || '',
                division: apiItem.division || '',
                isAppearing: apiItem.isAppearing || false,
                markingType: apiItem.markingRule === 'CGPA' ? 'CGPA' : 'Percentage',
                aqid: apiItem.aqid
              };
            }
            return item;
          });
          setEducationData(mappedData);
        }

        await loadExistingUploads();

      } catch (error) {
        console.log('No existing academic data found, starting fresh');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAcademicData();
  }, []);

  useEffect(() => {
    if (scholarId) {
      loadExistingUploads();
    }
  }, [scholarId]);

  // Helper Functions
  const hasData = (item) => {
    return item.board || item.year || item.stream || item.subject || item.marksObtained ||
      item.maxMarks || item.cgpaPercentage || item.division || item.isAppearing;
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="p-4 md:p-5 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af] mx-auto mb-2"></div>
          <p className="text-gray-600 font-inter">Loading educational details...</p>
        </div>
      </div>
    );
  }

  // Table Columns Configuration
  const columns = [
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Qualification<br />Board/University</div>,
      dataIndex: 'level',
      key: 'qualification',
      width: 200,
      render: (text, record) => (
        <div>
          <div className="font-medium text-[#1e40af] text-xs mb-1">{text}</div>
          {editingId === record.id ? (
            <Input
              value={record.board}
              onChange={(e) => handleChange(record.id, 'board', e.target.value)}
              placeholder="Board/University"
              size="small"
              className="text-xs"
              readOnly={isReadOnly}
            />
          ) : (
            <div className="text-[#6b7280] text-xs">{record.board || '/'}</div>
          )}
        </div>
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Year</div>,
      dataIndex: 'year',
      key: 'year',
      width: 100,
      render: (text, record) => (
        editingId === record.id ? (
          <Select
            value={record.year}
            onChange={(value) => handleChange(record.id, 'year', value)}
            placeholder="Select Year"
            size="small"
            className="w-full text-xs"
            disabled={isReadOnly || (record.isAppearing && record.level === 'Post Graduation')}
          >
            {YEARS.map(year => (
              <Select.Option key={year} value={year}>{year}</Select.Option>
            ))}
          </Select>
        ) : (
          <div className="text-[#374151] text-xs">
            {(record.isAppearing && record.level === 'Post Graduation') ? '-' : (record.year || '/')}
          </div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Stream</div>,
      dataIndex: 'stream',
      key: 'stream',
      width: 120,
      render: (text, record) => (
        editingId === record.id ? (
          <Input
            value={record.stream}
            onChange={(e) => handleChange(record.id, 'stream', e.target.value)}
            placeholder="Stream"
            size="small"
            className="text-xs"
            readOnly={isReadOnly}
          />
        ) : (
          <div className="text-[#374151] text-xs">{record.stream || '/'}</div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Subject</div>,
      dataIndex: 'subject',
      key: 'subject',
      width: 120,
      render: (text, record) => (
        editingId === record.id ? (
          <Input
            value={record.subject}
            onChange={(e) => handleChange(record.id, 'subject', e.target.value)}
            placeholder="Subject"
            size="small"
            className="text-xs"
            readOnly={isReadOnly}
          />
        ) : (
          <div className="text-[#374151] text-xs">{record.subject || '/'}</div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Marks<br />Obtained</div>,
      dataIndex: 'marksObtained',
      key: 'marksObtained',
      width: 100,
      render: (text, record) => (
        editingId === record.id ? (
          <Input
            type="number"
            min="0"
            value={record.marksObtained}
            onChange={(e) => handleChange(record.id, 'marksObtained', e.target.value)}
            placeholder="Marks"
            size="small"
            className="text-xs"
            disabled={isReadOnly || (record.isAppearing && record.level === 'Post Graduation')}
          />
        ) : (
          <div className="text-[#374151] text-xs">
            {(record.isAppearing && record.level === 'Post Graduation') ? '-' : (record.marksObtained || '/')}
          </div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Max<br />Marks</div>,
      dataIndex: 'maxMarks',
      key: 'maxMarks',
      width: 100,
      render: (text, record) => (
        editingId === record.id ? (
          <Input
            type="number"
            min="0"
            value={record.maxMarks}
            onChange={(e) => handleChange(record.id, 'maxMarks', e.target.value)}
            placeholder="Max Marks"
            size="small"
            className="text-xs"
            disabled={isReadOnly || (record.isAppearing && record.level === 'Post Graduation')}
          />
        ) : (
          <div className="text-[#374151] text-xs">
            {(record.isAppearing && record.level === 'Post Graduation') ? '-' : (record.maxMarks || '/')}
          </div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Marking<br />Type</div>,
      dataIndex: 'markingType',
      key: 'markingType',
      width: 110,
      render: (text, record) => (
        editingId === record.id ? (
          <Select
            value={record.markingType || 'Percentage'}
            onChange={(value) => handleChange(record.id, 'markingType', value)}
            size="small"
            className="w-full text-xs"
            disabled={isReadOnly || (record.isAppearing && record.level === 'Post Graduation')}
          >
            <Select.Option value="Percentage">Percentage</Select.Option>
            <Select.Option value="CGPA">CGPA</Select.Option>
          </Select>
        ) : (
          <div className="text-[#374151] text-xs">
            {(record.isAppearing && record.level === 'Post Graduation') ? '-' : (record.markingType || 'Percentage')}
          </div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">CGPA/<br />Percentage</div>,
      dataIndex: 'cgpaPercentage',
      key: 'cgpaPercentage',
      width: 120,
      render: (text, record) => {
        const markingType = record.markingType || 'Percentage';
        return editingId === record.id ? (
          <div>
            <Input
              type="number"
              min="0"
              max={markingType === 'CGPA' ? 10 : 100}
              step="0.01"
              value={record.cgpaPercentage}
              onChange={(e) => {
                const value = e.target.value;
                // For percentage, prevent values over 100
                if (markingType === 'Percentage') {
                  const numValue = parseFloat(value) || 0;
                  if (numValue > 100) {
                    notification().error('Percentage cannot exceed 100%');
                    return;
                  }
                }
                handleChange(record.id, 'cgpaPercentage', value);
              }}
              placeholder={markingType === 'CGPA' ? 'CGPA (max 10)' : 'Percentage'}
              size="small"
              className="text-xs"
              disabled={isReadOnly || (record.isAppearing && record.level === 'Post Graduation')}
              readOnly={markingType === 'Percentage'}
            />
            <div className="text-[9px] text-gray-500 mt-1">
              {markingType === 'CGPA' ?
                'Enter CGPA (max 10)' :
                'Auto-calculated from marks'
              }
            </div>
          </div>
        ) : (
          <div className="text-[#374151] text-xs">
            {(record.isAppearing && record.level === 'Post Graduation') ? 'Appearing' : (record.cgpaPercentage ? `${record.cgpaPercentage}${markingType === 'CGPA' ? ' (CGPA)' : '%'}` : '/')}
          </div>
        );
      },
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs">Division</div>,
      dataIndex: 'division',
      key: 'division',
      width: 150,
      render: (text, record) => (
        editingId === record.id ? (
          <div>
            <Select
              value={record.division}
              onChange={(value) => handleChange(record.id, 'division', value)}
              placeholder="Select Division"
              size="small"
              className="w-full text-xs"
              disabled={isReadOnly || (record.isAppearing && record.level === 'Post Graduation')}
            >
              {DIVISION_OPTIONS.map(division => (
                <Select.Option key={division} value={division}>{division}</Select.Option>
              ))}
            </Select>
            {record.level === 'Post Graduation' && (
              <div className="flex items-center gap-1 mt-1">
                <Checkbox
                  checked={record.isAppearing}
                  onChange={(e) => handleChange(record.id, 'isAppearing', e.target.checked)}
                  className="text-xs"
                  disabled={isReadOnly}
                />
                <span className="text-[10px] text-[#6b7280] font-inter">
                  Appearing/Appeared in final Year/Semester
                </span>
              </div>
            )}
            {record.level === 'Post Graduation' && record.isAppearing && (
              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-[10px] text-orange-700">
                <strong>Note:</strong> Final marksheet must be produced at the time of interview.
              </div>
            )}
          </div>
        ) : (
          <div className="text-[#374151] text-xs">
            {(record.isAppearing && record.level === 'Post Graduation') ? '-' : (record.division || '/')}
          </div>
        )
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs text-center">PDF<br />Upload</div>,
      key: 'document',
      width: 160,
      align: 'center',
      render: (text, record) => (
        <div className="py-2">
          <DocumentUpload
            educationId={record.id}
            educationLevel={record.level}
            isUploaded={record.documentUploaded}
            isUploading={uploadingDocuments[record.id]}
            uploadedFileName={record.uploadedFileName}
            uploadedFilePath={record.uploadedDocumentPath}
            isAppearing={record.isAppearing}
          />
        </div>
      ),
    },
    {
      title: <div className="text-[#1e40af] font-semibold text-xs text-center">Action</div>,
      key: 'action',
      width: 80,
      align: 'center',
      fixed: "right",
      render: (text, record) => (
        <div className="flex items-center justify-center gap-2">
          {isReadOnly ? (
            <span className="text-xs text-gray-400">Read Only</span>
          ) : editingId === record.id ? (
            <Button
              type="text"
              icon={<Save size={14} />}
              onClick={handleSave}
              className="text-green-600 hover:text-green-700 p-1"
              size="small"
            />
          ) : hasData(record) ? (
            <Button
              type="text"
              icon={<Edit2 size={14} />}
              onClick={() => handleEdit(record.id)}
              className="text-[#1e40af] hover:text-[#1e3a8a] p-1"
              size="small"
              title="Edit"
            />
          ) : (
            <Button
              type="primary"
              icon={<Plus size={12} />}
              onClick={() => handleEdit(record.id)}
              className="bg-[#1e40af] hover:bg-[#1e3a8a] text-xs h-6"
              size="small"
              title="Add"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-[#111827] font-inter">Educational Details</h2>
          </div>

          <Table
            dataSource={educationData}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1550 }}
            size="small"
            className="border border-[#e5e7eb] rounded-lg [&_.ant-table-tbody>tr>td]:py-3"
            rowClassName={(record, index) => index % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}
            columns={columns}
          />

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <FileText size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-800 mb-1">PDF Upload Requirements</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  {getValidationInstructions().instructions.map((instruction, index) => (
                    <li key={index}>• {instruction}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-[#e5e7eb]">
          <button
            type="submit"
            disabled={isSubmitting || isReadOnly}
            className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 text-white py-2 px-6 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:from-green-700 hover:to-green-600 active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : isReadOnly ? 'Read Only' : 'Save & Next'}
            <ChevronRight size={18} />
          </button>
        </div>
      </form>

      {/* File Viewer Modal */}
      {FileViewerModal}
    </div>
  );
};

export default EducationalDetails;