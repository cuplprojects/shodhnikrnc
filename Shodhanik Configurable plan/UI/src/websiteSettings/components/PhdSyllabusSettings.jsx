import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Save, X, FileText, Upload, Download, ChevronDown, Search, Eye } from 'lucide-react';
import API from '@/services/API';
import TableService from '@/services/TableService';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const PhdSyllabusSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_phdsyllabus.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_phdsyllabus.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [syllabusData, setSyllabusData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const tableRef = useRef();
  const dropdownRef = useRef(null);

  // Filter departments based on search
  const filteredDepartments = departments.filter(dept =>
    dept.toLowerCase().includes(departmentSearch.toLowerCase())
  );

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
      }
    };

    const handleKeyDown = (event) => {
      if (showDepartmentDropdown) {
        if (event.key === 'Escape') {
          setShowDepartmentDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDepartmentDropdown]);

  // Fetch departments from API
  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const response = await API.get('/Department');
      if (response.data && Array.isArray(response.data)) {
        // Extract unique subjects from the department data
        const uniqueSubjects = [...new Set(response.data.map(dept => dept.subject))];
        setDepartments(uniqueSubjects.sort());
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Failed to fetch departments. Please try again later.');
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // Fetch syllabus data
  const fetchSyllabusData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/PhdSyllabus');
      if (response.data.success) {
        setSyllabusData(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching syllabus data:', error);
      setError('Failed to fetch syllabus data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyllabusData();
  }, []);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  // Reset form
  const resetForm = () => {
    setSelectedFile(null);
    setEditingSyllabus(null);
    setShowForm(false);
    setError(null);
    setSuccessMessage(null);
    setSelectedDepartment('');
    setDepartmentSearch('');
    setShowDepartmentDropdown(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle upload/create
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDepartment) {
      setError('Please select a department');
      return;
    }

    if (!editingSyllabus && !selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('Department', selectedDepartment);
      formDataToSend.append('Subject', selectedDepartment); // Using department as subject
      
      if (selectedFile) {
        formDataToSend.append('SyllabusFile', selectedFile);
      }

      let response;
      if (editingSyllabus) {
        response = await API.put(`/PhdSyllabus/${editingSyllabus.id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await API.post('/PhdSyllabus', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      if (response.data.success) {
        await fetchSyllabusData();
        setSuccessMessage(editingSyllabus ? 'Syllabus updated successfully!' : 'Syllabus uploaded successfully!');
        resetForm();
      } else {
        setError(response.data.message || 'Operation failed');
      }
    } catch (error) {
      console.error('Error submitting syllabus:', error);
      setError(error.response?.data?.message || 'Error submitting syllabus. Please try again.');
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this syllabus?')) {
      return;
    }

    try {
      const response = await API.delete(`/PhdSyllabus/${id}`);
      if (response.data.success) {
        await fetchSyllabusData();
        setSuccessMessage('Syllabus deleted successfully!');
      } else {
        setError(response.data.message || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting syllabus:', error);
      setError('Error deleting syllabus. Please try again.');
    }
  };

  // Handle file view in modal
  const handleViewFile = async (id, fileName, department) => {
    try {
      setError(null);
      const response = await API.get(`/PhdSyllabus/download/${id}`, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/pdf'
        }
      });
      
      // Check if the response is actually a PDF
      const contentType = response.headers['content-type'] || response.data.type;
      if (!contentType.includes('pdf')) {
        setError('File is not a valid PDF document.');
        return;
      }
      
      const fileBlob = new Blob([response.data], { type: 'application/pdf' });
      const fileUrl = window.URL.createObjectURL(fileBlob);
      
      setCurrentFile({
        url: fileUrl,
        name: fileName || `${department}_syllabus.pdf`,
        department: department,
        id: id
      });
      setShowFileModal(true);
    } catch (error) {
      console.error('Error loading file:', error);
      setError('Failed to load file. Please try again.');
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

  // Handle download with better error handling and user feedback
  const handleDownload = async (id, fileName) => {
    try {
      setError(null); // Clear any previous errors
      const response = await API.get(`/PhdSyllabus/download/${id}`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'syllabus.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Failed to download file. Please try again.');
    }
  };

  // Define table columns
  const columns = useMemo(() => [
    {
      id: 'serialNumber',
      header: 'S.N.',
      size: 60,
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        return (
          <div className="text-center font-medium text-gray-900">
            {pageIndex * pageSize + row.index + 1}
          </div>
        );
      },
    },
    {
      accessorKey: 'department',
      header: 'Department',
      size: 300,
      cell: ({ row }) => (
        <div className="py-2">
          <div className="text-sm font-semibold text-gray-900 mb-1">
            {row.original.department || 'N/A'}
          </div>
          {row.original.subject && row.original.subject !== row.original.department && (
            <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
              Subject: {row.original.subject}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Upload Date',
      size: 150,
      cell: ({ row }) => (
        <div className="text-sm text-gray-600">
          {row.original.createdAt 
            ? new Date(row.original.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })
            : 'N/A'
          }
        </div>
      ),
    },
    {
      id: 'view',
      header: 'View',
      size: 100,
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.syllabusFilePath ? (
            <button
              onClick={() => handleViewFile(
                row.original.id, 
                `${row.original.department || 'syllabus'}_syllabus.pdf`,
                row.original.department
              )}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
              title="View Syllabus"
            >
              <Eye size={12} />
              View
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-gray-400 bg-gray-100 px-3 py-1 rounded-full text-xs font-medium">
              <X size={12} />
              No File
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 120,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          {row.original.syllabusFilePath && (
            <button
              onClick={() => handleDownload(row.original.id, `${row.original.department || 'syllabus'}_syllabus.pdf`)}
              className="text-green-600 hover:text-green-800 p-2 hover:bg-green-50 rounded-md cursor-pointer transition-colors"
              title="Download Syllabus"
            >
              <Download size={16} />
            </button>
          )}
          <button
            onClick={() => {
              setEditingSyllabus(row.original);
              setSelectedDepartment(row.original.department || '');
              setDepartmentSearch('');
              setShowForm(true);
            }}
            className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
            title="Edit Syllabus"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-md cursor-pointer transition-colors"
            title="Delete Syllabus"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    fetchSyllabusData();
    fetchDepartments();
  }, []);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-none p-2 sm:p-4 md:p-6 space-y-2 sm:space-y-4 md:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">PhD Syllabus </h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Manage Pre. Ph.D. Course Work Syllabus by Department</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Upload Syllabus</span>
            </button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">{successMessage}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="text-green-400 hover:text-green-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* Syllabus List */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Pre. Ph.D. Course Work Syllabus</h3>
              <p className="text-sm text-gray-600 mt-1">Manage and download syllabus files by department</p>
            </div>

            <div className="overflow-x-auto">
              {syllabusData.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Syllabus Files</h3>
                  <p className="text-gray-500 mb-4">Get started by uploading your first syllabus file.</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                    Upload Syllabus
                  </button>
                </div>
              ) : (
                <TableService
                  ref={tableRef}
                  columns={columns}
                  data={syllabusData}
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
                {editingSyllabus ? 'Update Syllabus' : 'Add / Update'}
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
                {/* Department Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Department *
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <div
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white flex items-center justify-between"
                      onClick={() => {
                        if (!departmentsLoading) {
                          setShowDepartmentDropdown(!showDepartmentDropdown);
                        }
                      }}
                    >
                      <span className={selectedDepartment ? 'text-gray-900' : 'text-gray-500'}>
                        {departmentsLoading 
                          ? 'Loading departments...' 
                          : selectedDepartment || 'Select Department'
                        }
                      </span>
                      <ChevronDown 
                        size={20} 
                        className={`text-gray-400 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} 
                      />
                    </div>
                    
                    {showDepartmentDropdown && !departmentsLoading && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search departments..."
                              value={departmentSearch}
                              onChange={(e) => setDepartmentSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        
                        {/* Options List */}
                        <div className="max-h-48 overflow-y-auto">
                          {filteredDepartments.length > 0 ? (
                            filteredDepartments.map((dept) => (
                              <div
                                key={dept}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  setSelectedDepartment(dept);
                                  setDepartmentSearch(dept);
                                  setShowDepartmentDropdown(false);
                                }}
                              >
                                {dept}
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              No departments found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {departmentsLoading && (
                    <p className="text-xs text-gray-500 mt-1">Loading departments from server...</p>
                  )}
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Pre. Ph.D. Syllabus {editingSyllabus ? '(Leave empty to keep current file)' : '*'}
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
                          id="syllabus-upload"
                          required={!editingSyllabus}
                        />
                        <label
                          htmlFor="syllabus-upload"
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
                  
                  {editingSyllabus && editingSyllabus.syllabusFilePath && !selectedFile && (
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
                    {editingSyllabus ? 'Update' : 'Upload'} Syllabus
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
                <h3 className="text-lg font-semibold">Syllabus Viewer</h3>
                <p className="text-sm text-gray-300">{currentFile.department} - {currentFile.name}</p>
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
                      <>
                        <iframe
                          src={`${currentFile.url}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                          className="w-full h-full rounded"
                          title="Syllabus PDF Viewer"
                          style={{ minHeight: '500px' }}
                          onLoad={() => setPdfError(false)}
                          onError={() => setPdfError(true)}
                        />
                        
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <FileText size={64} className="text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">PDF Preview Not Available</h3>
                        <p className="text-gray-600 mb-4">
                          This PDF cannot be displayed in the browser. This might be due to:
                        </p>
                        <ul className="text-sm text-gray-600 mb-6 text-left">
                          <li>• PDF encryption or security settings</li>
                          <li>• Browser compatibility issues</li>
                          <li>• File format restrictions</li>
                        </ul>
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
                onClick={() => handleDownload(currentFile.id, currentFile.name)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download size={16} />
                Download
              </button>
              <button
                onClick={closeFileModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
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

export default PhdSyllabusSettings;