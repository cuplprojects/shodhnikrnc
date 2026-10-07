import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, Eye } from 'lucide-react';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const PhotographSignature = () => {
  const baseFileURL = getBaseFileURL();
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();
  
  const [documents, setDocuments] = useState({
    photograph: null,
    signature: null
  });
  
  const [previews, setPreviews] = useState({
    photograph: null,
    signature: null
  });

  const [currentDocuments, setCurrentDocuments] = useState({
    photograph: null,
    signature: null
  });

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const photographRef = useRef(null);
  const signatureRef = useRef(null);

  // Fetch current documents on component mount
  useEffect(() => {
    fetchCurrentDocuments();
  }, [supId]);

  const fetchCurrentDocuments = async () => {
    try {
      setLoading(true);
      if (!supId) {
        setLoading(false);
        return;
      }

      const response = await API.get(`/SupervisorUploads/${supId}`);
      if (response.data) {
        setCurrentDocuments({
          photograph: response.data.photo,
          signature: response.data.sign
        });
      }
    } catch (error) {
      console.log('No current documents found:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (type, file) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        notification().error('Please select a valid image file (JPG/JPEG/PNG)');
        return;
      }
      
      // Validate file size (100KB for photo, 50KB for signature)
      const maxSize = type === 'photograph' ? 100 * 1024 : 50 * 1024;
      if (file.size > maxSize) {
        notification().error(`File size should be less than ${type === 'photograph' ? '100KB' : '50KB'}`);
        return;
      }
      
      setDocuments(prev => ({ ...prev, [type]: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [type]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = (type) => {
    setDocuments(prev => ({ ...prev, [type]: null }));
    setPreviews(prev => ({ ...prev, [type]: null }));
    
    // Reset file input
    if (type === 'photograph' && photographRef.current) {
      photographRef.current.value = '';
    }
    if (type === 'signature' && signatureRef.current) {
      signatureRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!documents.photograph && !documents.signature) {
      notification().error('Please select at least one document to upload');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      
      // Required fields according to API specification
      formData.append('SupId', supId);
      
      // Photo field - use new file if selected, otherwise send empty
      if (documents.photograph) {
        formData.append('Photo', documents.photograph);
      } else {
        formData.append('Photo', '');
      }
      
      // Signature field - use new file if selected, otherwise send empty
      if (documents.signature) {
        formData.append('Signature', documents.signature);
      } else {
        formData.append('Signature', '');
      }
      
      // Other required fields - send empty as per API spec
      formData.append('TeachCertificate', '');
      formData.append('AppLetter', '');
      formData.append('IdentityProof', '');

      // Use the specific UpdateDocuments endpoint
      const response = await API.put('/SupervisorUploads/UpdateDocuments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data) {
        notification().success('Documents updated successfully!');
        
        // Reset form and refresh current documents
        setDocuments({ photograph: null, signature: null });
        setPreviews({ photograph: null, signature: null });
        
        // Reset file inputs
        if (photographRef.current) photographRef.current.value = '';
        if (signatureRef.current) signatureRef.current.value = '';
        
        // Refresh current documents display
        await fetchCurrentDocuments();
        
        // Dispatch event to update navbar if needed
        window.dispatchEvent(new CustomEvent('supervisorProfileUpdated'));
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      // Handle specific error messages
      if (error.response?.status === 400) {
        notification().error('Invalid file format or size. Please check requirements');
      } else if (error.response?.status === 404) {
        notification().error('Supervisor record not found. Please contact support');
      } else if (error.response?.data?.message) {
        notification().error(`Error: ${error.response.data.message}`);
      } else {
        notification().error('Upload failed. Please try again');
      }
    } finally {
      setUploading(false);
    }
  };

  // Function to handle viewing images
  const handleViewImage = (type) => {
    if (previews[type]) {
      // Create a new window with the image
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>${type === 'photograph' ? 'Photograph' : 'Signature'} Preview</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background-color: #f5f5f5;
                  font-family: Arial, sans-serif;
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                img {
                  max-width: 100%;
                  max-height: 80vh;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                }
                h2 {
                  margin-top: 0;
                  color: #333;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>${type === 'photograph' ? 'Photograph' : 'Signature'} Preview</h2>
                <img src="${previews[type]}" alt="${type} preview" />
                <p style="margin-top: 15px; color: #666;">
                  File: ${documents[type]?.name || 'Unknown'}
                </p>
              </div>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    }
  };

  const DocumentUploadCard = ({ 
    type, 
    title, 
    description, 
    dimensions, 
    maxSize, 
    fileRef 
  }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      
      {/* Requirements */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <h4 className="font-medium text-blue-800 mb-2">Requirements:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Format: JPG/JPEG/PNG</li>
          <li>• Max Size: {maxSize}</li>
          <li>• Dimensions: {dimensions}</li>
          <li>• Clear and recent image</li>
        </ul>
      </div>

      {/* Preview Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4 text-center">
        {previews[type] ? (
          <div className="space-y-3">
            <img
              src={previews[type]}
              alt={`${type} preview`}
              className={`mx-auto object-fitcover border border-gray-300 ${
                type === 'photograph' 
                  ? 'w-32 h-40' 
                  : 'w-40 h-20'
              }`}
            />
            <p className="text-sm text-green-600 font-medium">
              ✓ {documents[type]?.name}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Camera size={48} className="mx-auto text-gray-400" />
            <p className="text-gray-500">No {type} uploaded</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(type, e.target.files[0])}
          className="hidden"
        />
        
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
        >
          <Upload size={16} />
          {documents[type] ? 'Replace' : 'Upload'}
        </button>
        
        {documents[type] && (
          <>
            <button
              onClick={() => handleRemove(type)}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => handleViewImage(type)}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Eye size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Photograph & Signature</h1>
        <p className="text-gray-600">View your current documents and upload new ones to update them</p>
      </div>

      {/* Upload Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <DocumentUploadCard
          type="photograph"
          title="Photograph"
          description="Upload a recent passport-size photograph"
          dimensions="140px × 170px"
          maxSize="100KB"
          fileRef={photographRef}
        />
        
        <DocumentUploadCard
          type="signature"
          title="Signature"
          description="Upload your clear signature"
          dimensions="180px × 70px"
          maxSize="50KB"
          fileRef={signatureRef}
        />
      </div>

      {/* Guidelines */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-yellow-800 mb-3">Important Guidelines:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
          <div>
            <h4 className="font-medium mb-2">Photograph Guidelines:</h4>
            <ul className="space-y-1">
              <li>• Recent photograph (not older than 6 months)</li>
              <li>• Clear face visibility</li>
              <li>• Plain background (preferably white)</li>
              <li>• No sunglasses or hat</li>
              <li>• Professional attire recommended</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Signature Guidelines:</h4>
            <ul className="space-y-1">
              <li>• Clear and legible signature</li>
              <li>• Use black or blue ink</li>
              <li>• Plain white background</li>
              <li>• No smudges or unclear marks</li>
              <li>• Same as used in official documents</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Button */}
      {(documents.photograph || documents.signature) && (
        <div className="text-center">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              'Update Documents'
            )}
          </button>
        </div>
      )}

      {/* Current Documents */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Documents</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading current documents...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Current Photograph */}
              <div className="text-center">
                <h4 className="font-medium text-gray-700 mb-4">Current Photograph</h4>
                <div className="w-32 h-40 bg-gray-100 mx-auto rounded border border-gray-300 flex items-center justify-center overflow-hidden">
                  {currentDocuments.photograph ? (
                    <img
                      src={`${baseFileURL}/${currentDocuments.photograph}`}
                      alt="Current Photograph"
                      className="w-full h-full object-fitcover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <span className="text-gray-500 text-sm">No photo uploaded</span>
                  )}
                  <div className="w-full h-full items-center justify-center text-gray-500 text-sm" style={{ display: 'none' }}>
                    No photo uploaded
                  </div>
                </div>
                {currentDocuments.photograph && (
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={() => window.open(`${baseFileURL}/${currentDocuments.photograph}`, '_blank')}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                )}
              </div>

              {/* Current Signature */}
              <div className="text-center">
                <h4 className="font-medium text-gray-700 mb-4">Current Signature</h4>
                <div className="w-40 h-20 bg-gray-100 mx-auto rounded border border-gray-300 flex items-center justify-center overflow-hidden">
                  {currentDocuments.signature ? (
                    <img
                      src={`${baseFileURL}/${currentDocuments.signature}`}
                      alt="Current Signature"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <span className="text-gray-500 text-sm">No signature uploaded</span>
                  )}
                  <div className="w-full h-full items-center justify-center text-gray-500 text-sm" style={{ display: 'none' }}>
                    No signature uploaded
                  </div>
                </div>
                {currentDocuments.signature && (
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={() => window.open(`${baseFileURL}/${currentDocuments.signature}`, '_blank')}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotographSignature;