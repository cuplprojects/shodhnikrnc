import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Trash2, Save, X, User, FileText, Building, Users, Download } from 'lucide-react';
import API from '@/services/API';
import TableService from '@/services/TableService';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const CoOrdinatorsSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_coordinators.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_coordinators.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCoordinator, setEditingCoordinator] = useState(null);
  const [formData, setFormData] = useState({
    id: 0,
    name: '',
    affiliationResearchCenter: '',
    department: '',
    contactNo: '',
    email: '',
    pdfFile: null,
    status: true // Changed to boolean
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const tableRef = useRef();

  // Research Centers options
  const researchCenters = [
    'M. J. P. ROHILKHAND UNIVERSITY CAMPUS',
    'Regional Center - Delhi',
    'Regional Center - Mumbai',
    'Regional Center - Kolkata'
  ];

  // Department options
  const departments = [
    'Agad Tantra Avum Vidhi Vaidyaka',
    'Plant Science / Botany',
    'Mechanical Engineering',
    'Electronics & Instrumentation',
    'Computer Science',
    'Physics',
    'Chemistry',
    'Mathematics'
  ];

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
      accessorKey: 'name',
      header: 'Co-Ordinator Details',
      size: 250,
      cell: ({ row }) => (
        <div className="flex items-center py-2">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.original.name || 'N/A'}
            </div>
            {row.original.pdfFile && (
              <div className="text-sm text-green-600 flex items-center gap-1 font-medium">
                <FileText size={12} />
                PDF Available
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'affiliationResearchCenter',
      header: 'Affiliation & Department',
      size: 280,
      cell: ({ row }) => (
        <div className="py-2">
          <div className="flex items-center gap-1 mb-1">
            <Building size={12} className="text-gray-400" />
            <span className="font-medium text-xs">Research Center:</span>
          </div>
          <div className="text-xs text-gray-600 mb-2 max-w-xs">
            {row.original.affiliationResearchCenter ? (
              <span title={row.original.affiliationResearchCenter}>
                {row.original.affiliationResearchCenter.length > 40 
                  ? `${row.original.affiliationResearchCenter.substring(0, 40)}...`
                  : row.original.affiliationResearchCenter
                }
              </span>
            ) : (
              'Not specified'
            )}
          </div>
          <div className="flex items-center gap-1">
            <Users size={12} className="text-gray-400" />
            <span className="font-medium text-xs">Department:</span>
          </div>
          <div className="text-xs text-gray-600 max-w-xs">
            {row.original.department ? (
              <span title={row.original.department}>
                {row.original.department.length > 35 
                  ? `${row.original.department.substring(0, 35)}...`
                  : row.original.department
                }
              </span>
            ) : (
              'Not specified'
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contactNo',
      header: 'Contact Info',
      size: 200,
      cell: ({ row }) => (
        <div className="py-2">
          {row.original.contactNo && (
            <div className="mb-1">
              <span className="font-medium text-sm">Mobile:</span> 
              <span className="text-sm text-gray-600 ml-1">{row.original.contactNo}</span>
            </div>
          )}
          {row.original.email && (
            <div className="text-xs text-gray-600 max-w-xs">
              <span className="font-medium">Email:</span> 
              <span className="ml-1" title={row.original.email}>
                {row.original.email.length > 25 
                  ? `${row.original.email.substring(0, 25)}...`
                  : row.original.email
                }
              </span>
            </div>
          )}
          {!row.original.contactNo && !row.original.email && (
            <span className="text-gray-400 text-xs">No contact info</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 100,
      cell: ({ row }) => (
        <div className="text-center">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            row.original.status 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {row.original.status ? 'Active' : 'Archive'}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 120,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          {/* Download button - only show if PDF file exists */}
          {row.original.pdfFile && (
            <button
              onClick={() => handleDownload(
                row.original.id, 
                `${row.original.name || 'coordinator'}_${row.original.id}.pdf`
              )}
              className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded cursor-pointer"
              title="Download PDF"
            >
              <Download size={16} />
            </button>
          )}
          
          {/* Edit button */}
          <button
            onClick={() => handleEdit(row.original)}
            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded cursor-pointer"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          
          {/* Delete button */}
          <button
            onClick={() => handleDelete(row.original.id)}
            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded cursor-pointer"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);

  // Fetch coordinators
  const fetchCoordinators = async () => {
    try {
      setLoading(true);
      const response = await API.get('/CoOrdinators');
      setCoordinators(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching coordinators:', error);
      notification().error('Error loading coordinators. Please refresh the page.');
      setCoordinators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Handle mobile number input
    if (name === 'contactNo') {
      // Remove any non-digit characters
      const cleanValue = value.replace(/\D/g, '');
      
      // Limit to 10 digits
      if (cleanValue.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: cleanValue
        }));
      }
      return;
    }
    
    // Handle email input
    if (name === 'email') {
      setFormData(prev => ({
        ...prev,
        [name]: value.toLowerCase().trim()
      }));
      return;
    }
    
    // Handle other inputs
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      id: 0,
      name: '',
      affiliationResearchCenter: '',
      department: '',
      contactNo: '',
      email: '',
      pdfFile: null,
      status: true // Changed to boolean
    });
    setSelectedFile(null);
    setEditingCoordinator(null);
    setShowForm(false);
    setErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validate form data
  const validateForm = () => {
    const newErrors = {};
    
    // Name validation
    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters long';
    }
    
    // Mobile number validation
    if (formData.contactNo && formData.contactNo.trim() !== '') {
      const cleanMobile = formData.contactNo.replace(/\D/g, '');
      if (cleanMobile.length !== 10) {
        newErrors.contactNo = 'Mobile number must be exactly 10 digits';
      } else if (!cleanMobile.match(/^[6-9]\d{9}$/)) {
        newErrors.contactNo = 'Please enter a valid Indian mobile number (starting with 6-9)';
      }
    }
    
    // Email validation
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }
    
    // At least one contact method required
    if ((!formData.contactNo || formData.contactNo.trim() === '') && 
        (!formData.email || formData.email.trim() === '')) {
      newErrors.contact = 'Please provide at least mobile number or email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create new coordinator
  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('Name', formData.name);
      formDataToSend.append('AffiliationResearchCenter', formData.affiliationResearchCenter);
      formDataToSend.append('Department', formData.department);
      formDataToSend.append('ContactNo', formData.contactNo);
      formDataToSend.append('Email', formData.email);
      formDataToSend.append('Status', formData.status);
      
      // Append PDF file if selected
      if (selectedFile) {
        formDataToSend.append('pdfFile', selectedFile);
      }
      
      await API.post('/CoOrdinators', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      await fetchCoordinators();
      resetForm();
      notification().success('Coordinator created successfully!');
    } catch (error) {
      console.error('Error creating coordinator:', error);
      notification().error('Error creating coordinator. Please try again.');
    }
  };

  // Update coordinator
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('Id', formData.id);
      formDataToSend.append('Name', formData.name);
      formDataToSend.append('AffiliationResearchCenter', formData.affiliationResearchCenter);
      formDataToSend.append('Department', formData.department);
      formDataToSend.append('ContactNo', formData.contactNo);
      formDataToSend.append('Email', formData.email);
      formDataToSend.append('Status', formData.status);
      
      // Append PDF file if selected
      if (selectedFile) {
        formDataToSend.append('pdfFile', selectedFile);
      }
      
      await API.put(`/CoOrdinators/${formData.id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      await fetchCoordinators();
      resetForm();
      notification().success('Coordinator updated successfully!');
    } catch (error) {
      console.error('Error updating coordinator:', error);
      notification().error('Error updating coordinator. Please try again.');
    }
  };

  // Delete coordinator (Permanent deletion)
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this coordinator? This action cannot be undone.')) {
      try {
        await API.delete(`/CoOrdinators/${id}`);
        await fetchCoordinators();
        notification().success('Coordinator deleted successfully!');
      } catch (error) {
        console.error('Error deleting coordinator:', error);
        notification().error('Error deleting coordinator. Please try again.');
      }
    }
  };

  // Edit coordinator
  const handleEdit = (coordinator) => {
    setFormData({
      id: coordinator.id,
      name: coordinator.name || '',
      affiliationResearchCenter: coordinator.affiliationResearchCenter || '',
      department: coordinator.department || '',
      contactNo: coordinator.contactNo || '',
      email: coordinator.email || '',
      pdfFile: coordinator.pdfFile,
      status: coordinator.status !== undefined ? coordinator.status : true // Handle boolean
    });
    setEditingCoordinator(coordinator);
    setErrors({}); // Clear any existing errors
    setShowForm(true);
  };

  // Download PDF file
  const handleDownload = async (coordinatorId, fileName) => {
    try {
      const response = await API.get(`/CoOrdinators/${coordinatorId}/download`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename
      const downloadFileName = fileName || `coordinator_${coordinatorId}.pdf`;
      link.setAttribute('download', downloadFileName);
      
      // Append to html link element page
      document.body.appendChild(link);
      
      // Start download
      link.click();
      
      // Clean up and remove the link
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notification().success('File downloaded successfully!');
    } catch (error) {
      console.error('Error downloading file:', error);
      notification().error('Error downloading file. Please try again.');
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-none p-2 sm:p-4 md:p-6 space-y-2 sm:space-y-4 md:space-y-6" style={{ minWidth: 0 }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Co-Ordinators</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1 truncate">Manage PhD Course Work Co-Ordinators</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm cursor-pointer"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add New Co-Ordinator</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          {/* Coordinators Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 w-full min-w-0" style={{ overflow: 'hidden' }}>
            <div className="p-3 sm:p-4 md:p-6 w-full min-w-0">
              {coordinators.length === 0 && !loading ? (
                <div className="text-center py-6 sm:py-8 md:py-12">
                  <Users size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-sm sm:text-base text-gray-500">No co-ordinators found.</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">Add your first co-ordinator to get started.</p>
                </div>
              ) : (
                <TableService
                  ref={tableRef}
                  columns={columns}
                  data={coordinators}
                  loading={loading}
                  initialPageSize={10}
                  className="min-w-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4"
        >
          <div 
            className="bg-white rounded-lg shadow-2xl w-full border flex flex-col"
            style={{
              maxWidth: 'min(95vw, 700px)',
              maxHeight: 'min(95vh, 700px)',
              minHeight: '400px',
              overflow: 'hidden'
            }}
          >
            {/* Header - Fixed */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0 w-full min-w-0 bg-gray-800 text-white">
              <h3 className="text-lg font-semibold truncate pr-4 flex-1 min-w-0">
                {editingCoordinator ? 'Edit Co-Ordinator' : 'Add New Co-Ordinator'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-300 hover:text-white p-1 flex-shrink-0 hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <div 
              className="flex-1 p-6 min-h-0 w-full"
              style={{ 
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                minWidth: 0
              }}
            >
              <form id="coordinator-form" onSubmit={editingCoordinator ? handleUpdate : handleCreate} className="space-y-4 w-full min-w-0">
                <div className="grid grid-cols-1 gap-4 w-full min-w-0">
                  {/* Name */}
                  <div className="w-full min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name of Co-Ordinator *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      style={{ minWidth: 0 }}
                      required
                    />
                    {errors.name && (
                      <p className="text-xs text-red-600 mt-1">{errors.name}</p>
                    )}
                  </div>

                  {/* Affiliation Research Center */}
                  <div className="w-full min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Affiliation Research Center
                    </label>
                    <select
                      name="affiliationResearchCenter"
                      value={formData.affiliationResearchCenter}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      style={{ minWidth: 0 }}
                    >
                      <option value="">Select Research Center</option>
                      {researchCenters.map((center) => (
                        <option key={center} value={center}>
                          {center}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  <div className="w-full min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name of Department
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      style={{ minWidth: 0 }}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contact Number and Email in same row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mobile Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mobile No. <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="contactNo"
                        value={formData.contactNo}
                        onChange={handleInputChange}
                        maxLength={10}
                        placeholder="Enter 10-digit mobile number"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                          errors.contactNo ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.contactNo && (
                        <p className="text-xs text-red-600 mt-1">{errors.contactNo}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Format: 9876543210</p>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Enter email address"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.email && (
                        <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Format: user@example.com</p>
                    </div>
                  </div>

                  {/* Contact validation message */}
                  {errors.contact && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-xs text-red-600">{errors.contact}</p>
                    </div>
                  )}

                  {/* PDF File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload PDF File
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {selectedFile && (
                      <p className="text-xs text-gray-600 mt-1 p-2 bg-green-50 rounded-md">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                    {editingCoordinator && formData.pdfFile && !selectedFile && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-green-600 mb-1">
                          Current: {formData.pdfFile.split('/').pop()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Status
                    </label>
                    <div className="flex gap-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="true"
                          checked={formData.status === true}
                          onChange={() => setFormData(prev => ({ ...prev, status: true }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Active</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="false"
                          checked={formData.status === false}
                          onChange={() => setFormData(prev => ({ ...prev, status: false }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Archive</span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Form Actions - Fixed Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors text-sm font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                form="coordinator-form"
                className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium cursor-pointer"
              >
                <Save size={16} />
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoOrdinatorsSettings;