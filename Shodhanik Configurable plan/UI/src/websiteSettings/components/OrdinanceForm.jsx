import { useState, useEffect } from 'react';
import { X, Upload, FileText, Save } from 'lucide-react';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const OrdinanceForm = ({ ordinance, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    status: 'Active',
    pdfFile: null
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form data when ordinance prop changes
  useEffect(() => {
    if (ordinance) {
      setFormData({
        title: ordinance.title || '',
        year: ordinance.year || new Date().getFullYear(),
        status: ordinance.status || 'Active',
        pdfFile: null
      });
    } else {
      setFormData({
        title: '',
        year: new Date().getFullYear(),
        status: 'Active',
        pdfFile: null
      });
    }
  }, [ordinance]);

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
      
      // Validate file type (PDF only)
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Please upload a PDF file only');
        notification().error('Please upload a PDF file only');
        return;
      }
      
      setError(null);
      setFormData(prev => ({
        ...prev,
        pdfFile: file
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        setError('Title is required');
        notification().error('Title is required');
        setLoading(false);
        return;
      }

      if (!formData.year || formData.year < 1900 || formData.year > 2100) {
        setError('Please enter a valid year');
        notification().error('Please enter a valid year');
        setLoading(false);
        return;
      }

      // Prepare form data for submission
      const submitData = new FormData();
      submitData.append('title', formData.title.trim());
      submitData.append('year', formData.year.toString());
      submitData.append('status', formData.status);
      
      if (formData.pdfFile) {
        submitData.append('pdfFile', formData.pdfFile);
      }

      let response;
      if (ordinance) {
        // Update existing ordinance
        response = await API.put(`/Ordinances/${ordinance.id}`, submitData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        // Create new ordinance
        response = await API.post('/Ordinances', submitData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      if (response.data.success) {
        onSubmit();
      } else {
        setError(response.data.message || 'Failed to save ordinance');
        notification().error(response.data.message || 'Failed to save ordinance');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save ordinance. Please try again.');
      notification().error(err.response?.data?.message || 'Failed to save ordinance. Please try again.');
      console.error('Error saving ordinance:', err);
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {ordinance ? 'Edit Ordinance' : 'Add Ordinance'}
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

          {/* Title of Ordinance */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Title of Ordinance <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="Enter ordinance title"
              required
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1900"
              max="2100"
              value={formData.year}
              onChange={(e) => handleInputChange('year', parseInt(e.target.value) || new Date().getFullYear())}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="Enter year"
              required
            />
          </div>

          {/* Upload PDF File */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Upload PDF File
            </label>
            <div className="relative">
              <input
                type="file"
                onChange={(e) => handleFileChange(e.target.files[0])}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                accept=".pdf"
              />
              {formData.pdfFile && (
                <p className="text-xs text-green-600 mt-1">
                  {formData.pdfFile.name} ({formatFileSize(formData.pdfFile.size)})
                </p>
              )}
              {ordinance?.pdfFileName && !formData.pdfFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Current: {ordinance.pdfFileName}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Only PDF files are allowed (Max 10MB)
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-4">
              {['Active', 'Archive', 'Delete'].map((status) => (
                <label key={status} className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    checked={formData.status === status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">{status}</span>
                </label>
              ))}
            </div>
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
                  {ordinance ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save size={14} />
                  {ordinance ? 'Update' : 'Submit'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrdinanceForm;