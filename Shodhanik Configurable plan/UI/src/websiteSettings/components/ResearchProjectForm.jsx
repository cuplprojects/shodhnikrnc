import { useState, useEffect } from 'react';
import { X, Upload, FileText, Calendar, DollarSign, User, Building, Save } from 'lucide-react';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const ResearchProjectForm = ({ project, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    fundingAgency: '',
    principalInvestigator: '',
    department: '',
    startDate: '',
    expectedCompletionDate: '',
    amount: '',
    status: 'Active',
    attachment: null
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Initialize form data when project prop changes
  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title || '',
        fundingAgency: project.fundingAgency || '',
        principalInvestigator: project.principalInvestigator || '',
        department: project.department || '',
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        expectedCompletionDate: project.expectedCompletionDate ? new Date(project.expectedCompletionDate).toISOString().split('T')[0] : '',
        amount: project.amount || '',
        status: project.status || 'Active',
        attachment: null
      });
    } else {
      setFormData({
        title: '',
        fundingAgency: '',
        principalInvestigator: '',
        department: '',
        startDate: '',
        expectedCompletionDate: '',
        amount: '',
        status: 'Active',
        attachment: null
      });
    }
  }, [project]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (file) => {
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        notification().error('File size must be less than 10MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a valid file (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF)');
        notification().error('Please upload a valid file (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF)');
        return;
      }
      
      setError(null);
      setFormData(prev => ({
        ...prev,
        attachment: file
      }));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      const requiredFields = ['title', 'fundingAgency', 'principalInvestigator', 'department', 'startDate', 'expectedCompletionDate', 'amount'];
      const missingFields = requiredFields.filter(field => !formData[field]);
      
      if (missingFields.length > 0) {
        setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
        notification().error(`Please fill in all required fields: ${missingFields.join(', ')}`);
        setLoading(false);
        return;
      }

      // Validate dates
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.expectedCompletionDate);
      
      if (endDate <= startDate) {
        setError('Expected completion date must be after the start date');
        notification().error('Expected completion date must be after the start date');
        setLoading(false);
        return;
      }

      // Validate amount
      if (parseFloat(formData.amount) <= 0) {
        setError('Amount must be greater than 0');
        notification().error('Amount must be greater than 0');
        setLoading(false);
        return;
      }

      // Prepare form data for submission
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('fundingAgency', formData.fundingAgency);
      submitData.append('principalInvestigator', formData.principalInvestigator);
      submitData.append('department', formData.department);
      submitData.append('startDate', formData.startDate);
      submitData.append('expectedCompletionDate', formData.expectedCompletionDate);
      submitData.append('amount', formData.amount);
      submitData.append('status', formData.status);
      
      if (formData.attachment) {
        submitData.append('attachment', formData.attachment);
      }

      let response;
      if (project) {
        // Update existing project
        response = await API.put(`/ResearchProjects/${project.id}`, submitData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        // Create new project
        response = await API.post('/ResearchProjects', submitData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      if (response.data.success) {
        onSubmit();
      } else {
        setError(response.data.message || 'Failed to save research project');
        notification().error(response.data.message || 'Failed to save research project');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save research project. Please try again.');
      notification().error(err.response?.data?.message || 'Failed to save research project. Please try again.');
      console.error('Error saving project:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {project ? 'Edit Project' : 'Add Project'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Title of the Project <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="Enter project title"
              required
            />
          </div>

          {/* Two columns for smaller fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Funding Agency <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fundingAgency}
                onChange={(e) => handleInputChange('fundingAgency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Enter funding agency"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Name of PI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.principalInvestigator}
                onChange={(e) => handleInputChange('principalInvestigator', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Enter PI name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Name of Department <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Enter department name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amount (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Enter amount"
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date of Project Start <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Expected Date of Completion <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.expectedCompletionDate}
                onChange={(e) => handleInputChange('expectedCompletionDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                required
              />
            </div>
          </div>

          {/* File Upload - Simplified */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Attachment
            </label>
            <div className="relative">
              <input
                type="file"
                onChange={(e) => handleFileChange(e.target.files[0])}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
              />
              {formData.attachment && (
                <p className="text-xs text-green-600 mt-1">
                  {formData.attachment.name} ({formatFileSize(formData.attachment.size)})
                </p>
              )}
              {project?.attachmentFileName && !formData.attachment && (
                <p className="text-xs text-gray-500 mt-1">
                  Current: {project.attachmentFileName}
                </p>
              )}
            </div>
          </div>

          {/* Status - Simplified */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="Active">Active</option>
              <option value="Submitted">Submitted</option>
              <option value="Archive">Archive</option>
              <option value="Delete">Delete</option>
            </select>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  {project ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save size={14} />
                  {project ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResearchProjectForm;