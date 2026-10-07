import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Select, Upload, message, Modal } from 'antd';
import { UploadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { CheckCircle, ChevronRight } from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import useStepRefresh from '@/hooks/useStepRefresh';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const { Option } = Select;

const UploadDocumentCounselling = () => {
  const { getSId } = useScholarRegAuthStore();
  const { saveStep, getIsReadOnly } = useSteps();
  const isReadOnly = getIsReadOnly ? getIsReadOnly(9) : false;
  const navigate = useNavigate();
  const scholarId = getSId();
  
  // Auto-refresh steps from API on component load
  useStepRefresh();

  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [isVerified, setIsVerified] = useState(false);

  // Fetch available documents and existing uploads
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch available documents for counselling stage - both edu and NOC types
        const [eduResponse, nocResponse] = await Promise.all([
          API.get('/DocumentMaster/GetDocuments?docType=edu&stage=counselling'),
          API.get('/DocumentMaster/GetDocuments?docType=NOC&stage=counselling')
        ]);
        
        // Combine both document types
        const allDocuments = [
          ...(eduResponse.data || []),
          ...(nocResponse.data || [])
        ];
        setAvailableDocuments(allDocuments);
        
        // Filter required documents (status: true) - exclude NOC documents as they are optional
        const required = allDocuments.filter(doc => 
          doc.status === true && doc.docType !== 'NOC'
        );
        setRequiredDocuments(required);

        // Fetch existing uploads for this scholar
        const uploadsResponse = await API.get(`/ScholarUpload/GetBySID?sid=${scholarId}`);
        if (uploadsResponse.data) {
          // Filter uploads to only show counselling stage documents
          const counsellingUploads = uploadsResponse.data.filter(upload => {
            return allDocuments.some(doc => 
              doc.documentMasterID === upload.documentMasterID && doc.stage === 'counselling'
            );
          });
          setUploadedDocuments(counsellingUploads);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        const notify = notification();
        notify.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    if (scholarId) {
      fetchData();
    }
  }, [scholarId]);

  // Get available documents for dropdown (exclude already uploaded ones)
  const getAvailableDocumentsForDropdown = () => {
    const uploadedDocIds = uploadedDocuments.map(upload => upload.documentMasterID);
    return availableDocuments.filter(doc => !uploadedDocIds.includes(doc.documentMasterID));
  };

  // Get selected document details
  const getSelectedDocument = () => {
    return availableDocuments.find(doc => doc.documentMasterID === selectedDocumentId);
  };

  // Handle file selection
  const handleFileChange = (info) => {
    const file = info.file;
    if (file.status !== 'uploading') {
      setSelectedFile(file.originFileObj || file);
    }
  };

  // Validate file size
  const validateFileSize = (file) => {
    const selectedDoc = getSelectedDocument();
    if (!selectedDoc) return false;

    const maxSizeMB = selectedDoc.validationRules.maxFileSizeMB;
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > maxSizeMB) {
      notify.error(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }
    return true;
  };

  // Handle document upload
  const handleUpload = async () => {
    if (!selectedDocumentId || !selectedFile) {
      notify.error('Please select a document type and file');
      return;
    }

    if (!validateFileSize(selectedFile)) {
      return;
    }

    const notify = notification();
    
    try {
      setUploading(true);

      // Prepare form data
      const formData = new FormData();
      formData.append('SID', scholarId);
      formData.append('DocumentMasterID', selectedDocumentId);
      formData.append('File', selectedFile);

      // Upload document
      const response = await API.post('/ScholarUpload/Upsert', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        notify.success('Document uploaded successfully!');
        
        // Refresh uploaded documents
        const uploadsResponse = await API.get(`/ScholarUpload/GetBySID?sid=${scholarId}`);
        if (uploadsResponse.data) {
          const counsellingUploads = uploadsResponse.data.filter(upload => {
            return availableDocuments.some(doc => 
              doc.documentMasterID === upload.documentMasterID && doc.stage === 'counselling'
            );
          });
          setUploadedDocuments(counsellingUploads);
        }

        // Reset form
        setSelectedDocumentId(null);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      notify.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Handle document edit
  const handleEdit = (upload) => {
    setEditingDocument(upload);
    setEditFile(null);
    setEditModalVisible(true);
  };

  // Handle edit file change
  const handleEditFileChange = (info) => {
    const file = info.file;
    if (file.status !== 'uploading') {
      setEditFile(file.originFileObj || file);
    }
  };

  // Handle edit upload
  const handleEditUpload = async () => {
    if (!editFile || !editingDocument) {
      notify.error('Please select a file');
      return;
    }

    // Get document details for validation
    const document = availableDocuments.find(doc => doc.documentMasterID === editingDocument.documentMasterID);
    if (document) {
      const maxSizeMB = document.validationRules.maxFileSizeMB;
      const fileSizeMB = editFile.size / (1024 * 1024);
      
      if (fileSizeMB > maxSizeMB) {
        notify.error(`File size must be less than ${maxSizeMB}MB`);
        return;
      }
    }

    const notify = notification();
    
    try {
      setUploading(true);

      // Prepare form data
      const formData = new FormData();
      formData.append('SID', scholarId);
      formData.append('DocumentMasterID', editingDocument.documentMasterID);
      formData.append('File', editFile);

      // Upload document (same API will update existing)
      const response = await API.post('/ScholarUpload/Upsert', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        notify.success('Document updated successfully!');
        
        // Refresh uploaded documents
        const uploadsResponse = await API.get(`/ScholarUpload/GetBySID?sid=${scholarId}`);
        if (uploadsResponse.data) {
          const counsellingUploads = uploadsResponse.data.filter(upload => {
            return availableDocuments.some(doc => 
              doc.documentMasterID === upload.documentMasterID && doc.stage === 'counselling'
            );
          });
          setUploadedDocuments(counsellingUploads);
        }

        // Close modal
        setEditModalVisible(false);
        setEditingDocument(null);
        setEditFile(null);
      }
    } catch (error) {
      console.error('Error updating document:', error);
      notify.error('Failed to update document');
    } finally {
      setUploading(false);
    }
  };

  // Handle document view
  const handleView = (upload) => {
    setViewingDocument(upload);
    setViewModalVisible(true);
  };

  // Table columns
  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Document Name',
      key: 'documentName',
      render: (_, record) => {
        const document = availableDocuments.find(doc => doc.documentMasterID === record.documentMasterID);
        return document?.documentName || 'Unknown Document';
      },
    },
    // {
    //   title: 'Status',
    //   key: 'status',
    //   width: 100,
    //   render: () => (
    //     <span className="text-green-600 font-medium">Verified</span>
    //   ),
    // },
    {
      title: 'View',
      key: 'view',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
          className="text-blue-600"
        >
          View
        </Button>
      ),
    },
    {
      title: 'Edit',
      key: 'edit',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
          className="text-orange-600"
        >
          Edit
        </Button>
      ),
    },
  ];

  const selectedDoc = getSelectedDocument();
  const availableForDropdown = getAvailableDocumentsForDropdown();

  // Check if all required documents are uploaded
  const areAllRequiredDocumentsUploaded = () => {
    if (requiredDocuments.length === 0) return true; // If no required documents, return true
    
    const uploadedDocIds = uploadedDocuments.map(upload => upload.documentMasterID);
    const allRequiredUploaded = requiredDocuments.every(doc => 
      uploadedDocIds.includes(doc.documentMasterID)
    );
    
    return allRequiredUploaded;
  };

  // Check if form is ready for submission
  const isFormReady = areAllRequiredDocumentsUploaded() && isVerified;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const notify = notification();
    
    // Validate all required documents are uploaded
    if (!areAllRequiredDocumentsUploaded()) {
      notify.error('Please upload all required documents before proceeding.');
      return;
    }
    
    if (!isVerified) {
      notify.error('Please verify that all documents are uploaded correctly.');
      return;
    }
    
    // Complete step and navigate
    const stepSaved = await saveStep(9);
    if (stepSaved) {
      // Navigate to next step (Counselling Fee)
      navigate('/register-scholar/counselling-fee');
    }
  };

  return (
    <div className="p-4 md:p-5">
      {/* {isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Read-only:</strong> Step 9 completed. Documents cannot be modified.
          </p>
        </div>
      )} */}
      
      <form onSubmit={handleSubmit}>
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <UploadOutlined className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-[#111827] font-inter">
            Upload Documents
          </h2>
        </div>

        {/* Upload Section - Only show if there are documents to upload */}
        {availableForDropdown.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Document Selection */}
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-2">
                Select Document Name<span className="text-red-600 ml-1">*</span>
              </label>
              <Select
                placeholder="--Select--"
                value={selectedDocumentId}
                onChange={setSelectedDocumentId}
                className="w-full"
                size="large"
                disabled={loading}
              >
                {availableForDropdown.map(doc => (
                  <Option key={doc.documentMasterID} value={doc.documentMasterID}>
                    {doc.documentName}
                  </Option>
                ))}
              </Select>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-2">
                Upload File<span className="text-red-600 ml-1">*</span>
                {selectedDoc && (
                  <span className="text-blue-600 ml-2">
                    (Allowed File Size: {selectedDoc.validationRules.maxFileSizeMB} MB, Format: PDF)
                  </span>
                )}
              </label>
              <div className="space-y-3">
                <Upload
                  beforeUpload={() => false} // Prevent auto upload
                  onChange={handleFileChange}
                  accept=".pdf"
                  maxCount={1}
                  fileList={selectedFile ? [selectedFile] : []}
                  className="w-full"
                >
                  <Button 
                    size="large" 
                    className="w-full h-12 border-2 border-dashed border-gray-300 hover:border-blue-400"
                    disabled={!selectedDocumentId}
                  >
                    <UploadOutlined /> Choose file
                  </Button>
                </Upload>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={!selectedDocumentId || !selectedFile}
                  className="w-34 bg-blue-600 hover:bg-blue-700 mt-3"
                >
                  Upload
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* All documents uploaded message */}
        {availableForDropdown.length === 0 && !loading && availableDocuments.length > 0 && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <p className="text-green-800 font-medium">
                All available documents have been uploaded successfully!
              </p>
            </div>
            <p className="text-green-700 text-sm mt-1 ml-8">
              You can view or edit any document using the action buttons in the table below.
            </p>
          </div>
        )}

        {/* Documents Table */}
        <div>
          <h3 className="text-lg font-semibold text-[#374151] mb-4">
            Uploaded Documents
          </h3>
          <Table
            columns={columns}
            dataSource={uploadedDocuments}
            rowKey="scholarUploadID"
            loading={loading}
            pagination={false}
            bordered
            size="middle"
            className="ant-table-striped"
            locale={{
              emptyText: 'No documents uploaded yet'
            }}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Instructions:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Select a document type from the dropdown</li>
            <li>• Choose a PDF file that meets the size requirements</li>
            <li>• Click Upload to submit the document</li>
            <li>• Once uploaded, the document will appear in the table below</li>
            <li>• You can view or edit uploaded documents using the action buttons</li>
          </ul>
        </div>

        {/* Upload Progress Summary */}
        {requiredDocuments.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">Upload Progress</h4>
            <div className="space-y-2">
              {availableDocuments.map((doc) => {
                const isUploaded = uploadedDocuments.some(upload => upload.documentMasterID === doc.documentMasterID);
                const isRequired = requiredDocuments.some(reqDoc => reqDoc.documentMasterID === doc.documentMasterID);
                
                return (
                  <div key={doc.documentMasterID} className="flex items-center justify-between text-xs">
                    <span className="text-blue-900">
                      {doc.documentName} {!isRequired && '(Optional)'}
                    </span>
                    <div className="flex items-center gap-1">
                      {isUploaded ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} />
                          <span>Uploaded</span>
                        </div>
                      ) : isRequired ? (
                        <span className="text-orange-600">Required</span>
                      ) : (
                        <span className="text-gray-500">Optional</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Verification Checkbox */}
        <div className="mt-4 flex items-start gap-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-md">
          <input
            type="checkbox"
            checked={isVerified}
            onChange={(e) => setIsVerified(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-[#dc2626] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#dc2626]"
            disabled={isReadOnly || !areAllRequiredDocumentsUploaded()}
            required
          />
          <label className="text-xs text-[#dc2626] font-medium font-inter">
            All required documents are uploaded correctly and verified
            {!areAllRequiredDocumentsUploaded() && (
              <span className="block text-gray-500 mt-1">
                (Upload all required documents first)
              </span>
            )}
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-3 border-t border-[#e5e7eb] mt-4">
          <div className="flex flex-col items-end gap-2">
            {/* Validation Status */}
            {!isFormReady && !isReadOnly && (
              <div className="text-xs text-gray-500">
                {!areAllRequiredDocumentsUploaded() && (
                  <p>• Upload all required documents</p>
                )}
                {!isVerified && (
                  <p>• Verify documents are uploaded correctly</p>
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
      </div>
      </form>

      {/* View Document Modal */}
      <Modal
        title="View Document"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingDocument(null);
        }}
        footer={[
          <Button 
            key="close" 
            onClick={() => {
              setViewModalVisible(false);
              setViewingDocument(null);
            }}
          >
            Close
          </Button>,
          <Button
            key="download"
            type="primary"
            onClick={() => {
              if (viewingDocument) {
                const baseURL = getBaseFileURL();
                const fileUrl = `${baseURL}/${viewingDocument.path}`;
                window.open(fileUrl, '_blank');
              }
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Open in New Tab
          </Button>,
        ]}
        width={800}
        style={{ top: 20 }}
      >
        {viewingDocument && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-[#374151] mb-2">
                Document Name: {availableDocuments.find(doc => doc.documentMasterID === viewingDocument.documentMasterID)?.documentName}
              </h4>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <iframe
                src={`${getBaseFileURL()}/${viewingDocument.path}`}
                width="100%"
                height="600px"
                title="Document Preview"
                className="border-0"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Document Modal */}
      <Modal
        title="Edit Document"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingDocument(null);
          setEditFile(null);
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setEditModalVisible(false);
              setEditingDocument(null);
              setEditFile(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploading}
            onClick={handleEditUpload}
            disabled={!editFile}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Update Document
          </Button>,
        ]}
        width={800}
        style={{ top: 20 }}
      >
        {editingDocument && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left side - Current document preview */}
              <div>
                <h4 className="text-sm font-semibold text-[#374151] mb-2">
                  Current Document
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <iframe
                    src={`${getBaseFileURL()}/${editingDocument.path}`}
                    width="100%"
                    height="400px"
                    title="Current Document Preview"
                    className="border-0"
                  />
                </div>
              </div>

              {/* Right side - Upload new document */}
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#374151] mb-2">
                    Document Name
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    {availableDocuments.find(doc => doc.documentMasterID === editingDocument.documentMasterID)?.documentName}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-2">
                    Select New File
                    {(() => {
                      const doc = availableDocuments.find(d => d.documentMasterID === editingDocument.documentMasterID);
                      return doc && (
                        <span className="text-blue-600 ml-2">
                          (Max Size: {doc.validationRules.maxFileSizeMB} MB, Format: PDF)
                        </span>
                      );
                    })()}
                  </label>
                  <Upload
                    beforeUpload={() => false}
                    onChange={handleEditFileChange}
                    accept=".pdf"
                    maxCount={1}
                    fileList={editFile ? [editFile] : []}
                  >
                    <Button 
                      size="large" 
                      className="w-full h-12 border-2 border-dashed border-gray-300 hover:border-blue-400"
                    >
                      <UploadOutlined /> Choose new file
                    </Button>
                  </Upload>
                  
                  {editFile && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Selected file:</strong> {editFile.name}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        File size: {(editFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UploadDocumentCounselling;