import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Save, X, FileText, Upload, Download, Eye } from 'lucide-react';
import API from '@/services/API';
import TableService from '@/services/TableService';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const ResearchPolicySettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_researchpolicy.update');
  
  if (!canUpdate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600 text-sm mb-4">
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_researchpolicy.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [policyData, setPolicyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [policyTitle, setPolicyTitle] = useState('');
  const fileInputRef = useRef(null);
  const tableRef = useRef();

  // Fetch policy data
  const fetchPolicyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/ResearchPolicies');
      if (Array.isArray(response.data)) {
        setPolicyData(response.data);
      }
    } catch (error) {
      console.error('Error fetching policy data:', error);
      notification().error('Failed to fetch policy data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicyData();
  }, []);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  // Reset form
  const resetForm = () => {
    setSelectedFile(null);
    setEditingPolicy(null);
    setShowForm(false);
    setError(null);
    setPolicyTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle upload/create
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!policyTitle.trim()) {
      notification().error('Please enter a policy title');
      return;
    }

    if (!editingPolicy && !selectedFile) {
      notification().error('Please select a file to upload');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('PolicyTitle', policyTitle);
      
      if (selectedFile) {
        formDataToSend.append('PolicyFile', selectedFile);
      }

      let response;
      if (editingPolicy) {
        response = await API.put(`/ResearchPolicies/${editingPolicy.id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await API.post('/ResearchPolicies', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      await fetchPolicyData();
      notification().success(editingPolicy ? 'Policy updated successfully!' : 'Policy uploaded successfully!');
      resetForm();
    } catch (error) {
      console.error('Error submitting policy:', error);
      notification().error(error.response?.data?.message || 'Error submitting policy. Please try again.');
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) {
      return;
    }

    try {
      await API.delete(`/ResearchPolicies/${id}`);
      await fetchPolicyData();
      notification().success('Policy deleted successfully!');
    } catch (error) {
      console.error('Error deleting policy:', error);
      notification().error('Error deleting policy. Please try again.');
    }
  };

  // Handle file view in modal
  const handleViewFile = async (id, fileName) => {
    try {
      setError(null);
      const baseURL = getBaseFileURL();
      
      // Use the dedicated view endpoint for iframe
      const fileUrl = `${baseURL}/api/ResearchPolicies/view/${id}`;
      
      setCurrentFile({
        url: fileUrl,
        name: fileName || 'policy.pdf',
        id: id
      });
      setShowFileModal(true);
    } catch (error) {
      console.error('Error loading file:', error);
      notification().error('Failed to load file. Please try again.');
    }
  };

  // Close file modal
  const closeFileModal = () => {
    if (currentFile?.url) {
      window.URL.revokeObjectURL(currentFile.url);
    }
    setCurrentFile(null);
    setShowFileModal(false);
    setPdfError(false);
  };

  // Handle download
  const handleDownload = async (id, fileName) => {
    try {
      setError(null);
      const baseURL = getBaseFileURL();
      
      // Use the dedicated download endpoint
      const fileUrl = `${baseURL}/api/ResearchPolicies/download/${id}`;
      
      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', fileName || 'policy.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      notification().success('File downloaded successfully!');
    } catch (error) {
      console.error('Error downloading file:', error);
      notification().error('Failed to download file. Please try again.');
    }
  };

  // Define table columns
  const columns = useMemo(() => [
    {
      id: 'serialNumber',
      header: () => <div className="text-center font-semibold w-full">S.N.</div>,
      size: 60,
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        return (
          <div className="text-center font-medium text-gray-900 w-full">
            {pageIndex * pageSize + row.index + 1}
          </div>
        );
      },
    },
    {
      accessorKey: 'policyTitle',
      header: () => <div className="text-center font-semibold w-full">Policy Title</div>,
      size: 300,
      cell: ({ row }) => (
        <div className="text-center w-full">
          <div className="text-sm font-semibold text-gray-900">
            {row.original.policyTitle || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'filePath',
      header: () => <div className="text-center font-semibold w-full">File Name</div>,
      size: 200,
      cell: ({ row }) => (
        <div className="text-center w-full">
          <div className="text-sm text-gray-600">
            {row.original.filePath ? row.original.filePath.split('/').pop() : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-center font-semibold w-full">Actions</div>,
      size: 150,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2 w-full">
          {row.original.filePath && (
            <button
              onClick={() => handleViewFile(row.original.id, row.original.policyTitle)}
              className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
              title="View Policy"
            >
              <Eye size={16} />
            </button>
          )}
          {row.original.filePath && (
            <button
              onClick={() => handleDownload(row.original.id, row.original.policyTitle)}
              className="text-green-600 hover:text-green-800 p-2 hover:bg-green-50 rounded-md cursor-pointer transition-colors"
              title="Download Policy"
            >
              <Download size={16} />
            </button>
          )}
          <button
            onClick={() => {
              setEditingPolicy(row.original);
              setPolicyTitle(row.original.policyTitle || '');
              setShowForm(true);
            }}
            className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
            title="Edit Policy"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-md cursor-pointer transition-colors"
            title="Delete Policy"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);



  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-none p-2 sm:p-4 md:p-6 space-y-2 sm:space-y-4 md:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Research Policies</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Manage and upload research policy documents</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Upload Policy</span>
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <X size={20} className="text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Policy List */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Research Policy Documents</h3>
              <p className="text-sm text-gray-600 mt-1">View and manage all research policy files</p>
            </div>

            <div className="overflow-x-auto">
              {policyData.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Policy Files</h3>
                  <p className="text-gray-500 mb-4">Get started by uploading your first policy document.</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                    Upload Policy
                  </button>
                </div>
              ) : (
                <TableService
                  ref={tableRef}
                  columns={columns}
                  data={policyData}
                  loading={loading}
                  initialPageSize={10}
                  className="min-w-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl border border-gray-300">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-800 text-white">
              <h3 className="text-lg font-semibold">
                {editingPolicy ? 'Update Policy' : 'Add / Update'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-300 hover:text-white p-1 hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Policy Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Policy Title *
                  </label>
                  <input
                    type="text"
                    value={policyTitle}
                    onChange={(e) => setPolicyTitle(e.target.value)}
                    placeholder="Enter policy title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Policy Document {editingPolicy ? '(Leave empty to keep current file)' : '*'}
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                      <div className="flex items-center justify-center">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          id="policy-upload"
                          required={!editingPolicy}
                        />
                        <label
                          htmlFor="policy-upload"
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md cursor-pointer transition-colors"
                        >
                          Choose file
                        </label>
                        <span className="ml-3 text-gray-500">
                          {selectedFile ? selectedFile.name : 'No file chosen'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Supported formats: PDF, DOC, DOCX (Max size: 10MB)
                      </p>
                    </div>
                  </div>
                  
                  {editingPolicy && editingPolicy.filePath && !selectedFile && (
                    <div className="mt-2 p-2 bg-gray-50 rounded-md">
                      <p className="text-xs text-green-600 mb-1 flex items-center gap-1">
                        <FileText size={12} />
                        Current file available
                      </p>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors font-medium cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-md flex items-center gap-2 transition-colors font-medium cursor-pointer"
                  >
                    <Save size={16} />
                    {editingPolicy ? 'Update' : 'Upload'} Policy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {showFileModal && currentFile && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-800 text-white rounded-t-lg">
              <div>
                <h3 className="text-lg font-semibold">Policy Viewer</h3>
                <p className="text-sm text-gray-300">{currentFile.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(currentFile.id, currentFile.name)}
                  className="text-gray-300 hover:text-white p-2 hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
                  title="Download File"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={closeFileModal}
                  className="text-gray-300 hover:text-white p-2 hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="w-full h-full border border-gray-300 rounded bg-gray-100">
                {currentFile.url ? (
                  <div className="w-full h-full relative">
                    {!pdfError ? (
                      <iframe
                        src={currentFile.url}
                        className="w-full h-full rounded"
                        title="Policy PDF Viewer"
                        style={{ minHeight: '500px' }}
                        onLoad={() => setPdfError(false)}
                        onError={() => setPdfError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <FileText size={64} className="text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">PDF Preview Not Available</h3>
                        <p className="text-gray-600 mb-4">
                          This PDF cannot be displayed in the browser.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleDownload(currentFile.id, currentFile.name)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Download size={16} />
                            Download PDF
                          </button>
                          <button
                            onClick={() => setPdfError(false)}
                            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading PDF...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={closeFileModal}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPolicySettings;
