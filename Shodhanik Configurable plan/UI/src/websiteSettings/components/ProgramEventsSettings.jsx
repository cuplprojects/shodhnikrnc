import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit, Calendar, Upload, X } from 'lucide-react';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import TableService from '@/services/TableService';

const ProgramEventsSettings = () => {
  const [programEvents, setProgramEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    description: '',
    link: '',
    status: 'Active',
    displayOrder: 0,
    imageFile: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // Handle different date formats
    let date;
    try {
      // Try parsing as-is first
      date = new Date(dateString);
      
      // If that fails, try some common formats
      if (isNaN(date.getTime())) {
        // Try DD/MM/YYYY format
        if (dateString.includes('/')) {
          const parts = dateString.split('/');
          if (parts.length === 3) {
            date = new Date(parts[2], parts[1] - 1, parts[0]); // Year, Month (0-indexed), Day
          }
        }
        // Try DD-MM-YYYY format
        else if (dateString.includes('-') && !dateString.includes('T')) {
          const parts = dateString.split('-');
          if (parts.length === 3 && parts[0].length <= 2) {
            date = new Date(parts[2], parts[1] - 1, parts[0]); // Year, Month (0-indexed), Day
          }
        }
      }
      
      // Final check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Could not parse date string:', dateString);
        return dateString; // Return original string if all parsing attempts fail
      }
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Original value:', dateString);
      return dateString; // Return original string instead of "Invalid Date"
    }
  };

  // Fetch program events from API
  const fetchProgramEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/ProgramEvents');
      if (response.data.success && response.data.data) {
        setProgramEvents(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching program events:', err);
      notification().error('Failed to fetch program events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Create program event
  const createProgramEvent = async (eventData) => {
    try {
      const formData = new FormData();
      formData.append('title', eventData.title || '');
      formData.append('date', eventData.date || '');
      formData.append('description', eventData.description || '');
      formData.append('link', eventData.link || '');
      formData.append('status', eventData.status || 'Active');
      formData.append('displayOrder', eventData.displayOrder || 0);
      
      if (eventData.imageFile && eventData.imageFile instanceof File) {
        formData.append('imageFile', eventData.imageFile);
      }

      const response = await API.post('/ProgramEvents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        await fetchProgramEvents(); // Refresh list
        notification().success('Program event created successfully!');
        return response.data;
      }
    } catch (err) {
      console.error('Error creating program event:', err);
      notification().error('Failed to create program event');
      throw err;
    }
  };

  // Update program event
  const updateProgramEvent = async (id, eventData) => {
    try {
      const formData = new FormData();
      formData.append('title', eventData.title || '');
      formData.append('date', eventData.date || '');
      formData.append('description', eventData.description || '');
      formData.append('link', eventData.link || '');
      formData.append('status', eventData.status || 'Active');
      formData.append('displayOrder', eventData.displayOrder || 0);
      
      if (eventData.imageFile && eventData.imageFile instanceof File) {
        formData.append('imageFile', eventData.imageFile);
      }

      const response = await API.put(`/ProgramEvents/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        await fetchProgramEvents(); // Refresh list
        notification().success('Program event updated successfully!');
        return response.data;
      }
    } catch (err) {
      console.error('Error updating program event:', err);
      notification().error('Failed to update program event');
      throw err;
    }
  };

  // Delete program event
  const deleteProgramEvent = async (id) => {
    try {
      const response = await API.delete(`/ProgramEvents/${id}`);
      if (response.data.success) {
        await fetchProgramEvents(); // Refresh list
        notification().success('Program event deleted successfully!');
        return response.data;
      }
    } catch (err) {
      console.error('Error deleting program event:', err);
      notification().error('Failed to delete program event');
      throw err;
    }
  };

  useEffect(() => {
    fetchProgramEvents();
  }, []);

  // Column definitions for program events table
  const programEventsColumns = useMemo(() => [
    {
      id: 'serialNumber',
      header: 'S.N.',
      cell: ({ row }) => {
        return <div className="font-medium text-gray-900">{row.index + 1}</div>;
      },
      enableSorting: false,
      enableColumnFilter: false,
      size: 60,
    },
    {
      accessorKey: 'image',
      header: 'Image',
      cell: ({ row }) => {
        const event = row.original;
        if (!event.image) {
          return (
            <div className="w-16 h-12 bg-gray-100 rounded-md flex items-center justify-center">
              <Calendar size={16} className="text-gray-400" />
            </div>
          );
        }
        
        const imageUrl = (() => {
          if (event.image.startsWith('http://') || 
              event.image.startsWith('https://') || 
              event.image.startsWith('data:image/')) {
            return event.image;
          }
          
          const baseURL = getBaseFileURL();
          const cleanPath = event.image.startsWith('/') ? event.image : `/${event.image}`;
          return `${baseURL}${cleanPath}`;
        })();

        return (
          <img
            src={imageUrl}
            alt={event.title}
            className="w-16 h-12 object-cover rounded-md"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => (
        <div className="font-medium text-gray-900 max-w-xs truncate" title={getValue()}>
          {getValue() || 'No title'}
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ getValue }) => (
        <div className="text-sm text-blue-600 font-medium">
          {formatDate(getValue())}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => (
        <div className="text-sm text-gray-600 max-w-xs truncate" title={getValue()}>
          {getValue() || 'No description'}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue() || 'Active';
        return (
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            status === 'Active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'displayOrder',
      header: 'Order',
      cell: ({ getValue }) => getValue() || 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(event);
              }}
              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit size={14} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(event.id);
              }}
              className="text-red-600 hover:text-red-900 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
  ], []);

  const resetForm = () => {
    setFormData({
      title: '',
      date: '',
      description: '',
      link: '',
      status: 'Active',
      displayOrder: 0,
      imageFile: null
    });
    setImagePreview(null);
    setEditingEvent(null);
    setIsFormOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    console.log('handleImageChange called with file:', file);
    
    if (file) {
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      setFormData(prev => ({
        ...prev,
        imageFile: file
      }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('Image preview loaded');
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      console.log('No file selected');
      setFormData(prev => ({
        ...prev,
        imageFile: null
      }));
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      console.log('Submitting program event with data:', formData);
      
      if (editingEvent) {
        console.log('Updating existing event:', editingEvent.id);
        await updateProgramEvent(editingEvent.id, formData);
      } else {
        console.log('Creating new event');
        await createProgramEvent(formData);
      }
      resetForm();
    } catch (error) {
      console.error('Error saving program event:', error);
      // Error notifications are handled in the API functions
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      date: event.date || '',
      description: event.description || '',
      link: event.link || '',
      status: event.status || 'Active',
      displayOrder: event.displayOrder || 0,
      imageFile: null
    });
    setImagePreview((() => {
      if (!event.image) return '';
      
      // Check if it's already a full URL or base64
      if (event.image.startsWith('http://') || 
          event.image.startsWith('https://') || 
          event.image.startsWith('data:image/')) {
        return event.image;
      }
      
      // Use the proper base URL for files
      const baseURL = getBaseFileURL();
      const cleanPath = event.image.startsWith('/') ? event.image : `/${event.image}`;
      return `${baseURL}${cleanPath}`;
    })());
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this program event?')) {
      try {
        await deleteProgramEvent(id);
      } catch (error) {
        console.error('Error deleting program event:', error);
        // Error notification is handled in the API function
      }
    }
  };

  const handleAddNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Program Events Settings</h2>
          <p className="text-gray-600">Manage program events displayed on the homepage</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={fetchProgramEvents}
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {editingEvent ? 'Edit Program Event' : 'Add New Program Event'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Date *
                </label>
                <input
                  type="text"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 15-20 January, 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter event description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Link (Optional)
                </label>
                <input
                  type="url"
                  name="link"
                  value={formData.link}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/event-details"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    name="displayOrder"
                    value={formData.displayOrder}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-32 h-24 object-fitcover rounded-lg border"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : (editingEvent ? 'Update Event' : 'Create Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Program Events</h3>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Event
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading program events...</p>
          </div>
        ) : programEvents.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Program Events</h3>
            <p className="text-gray-500 mb-4">Add your first program event to get started</p>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Add First Event
            </button>
          </div>
        ) : (
          <TableService
            columns={programEventsColumns}
            data={programEvents}
            initialPageSize={10}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default ProgramEventsSettings;
