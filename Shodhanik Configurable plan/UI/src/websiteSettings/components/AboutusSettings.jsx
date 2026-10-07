import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Save, X, User, MessageSquare, Users, Building } from 'lucide-react';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import RichTextEditor from './RichTextEditor';
import notification from '@/services/NotificationService';
import TableService from '@/services/TableService';
import { hasPermission } from '@/services/hasPermissionService';

// Validation functions
const validateEmail = (email) => {
  const re = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return re.test(email);
};

const validateMobileNumber = (mobile) => {
  const re = /^\d{10}$/;
  return re.test(mobile);
};

const AboutusSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_aboutus.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_aboutus.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [activeTab, setActiveTab] = useState('vc-message');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [formData, setFormData] = useState({
    id: 0,
    name: '',
    designation: '',
    message: '',
    contactNo: '',
    email: '',
    type: '',
    title: '',
    content: '',
    image: null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // Define tabs for different message types
  const tabs = [
    { id: 'vc-message', label: "Vice Chancellor's Message", icon: User, color: 'bg-purple-500', endpoint: 'ViceChancellorMessages' },
    { id: 'vision-mission', label: 'Vision and Mission', icon: MessageSquare, color: 'bg-blue-500', endpoint: 'VisionMissions' },
    { id: 'director-message', label: "Director's Message", icon: User, color: 'bg-green-500', endpoint: 'DirectorMessages' },
    { id: 'associate-directors', label: 'Associate Directors', icon: Users, color: 'bg-orange-500', endpoint: 'AssociateDirectors' },
    { id: 'assistant-directors', label: 'Assistant Directors', icon: Users, color: 'bg-red-500', endpoint: 'AssistantDirectors' },
    { id: 'additional-directors', label: 'Additional Directors', icon: Users, color: 'bg-indigo-500', endpoint: 'AdditionalDirectors' },
    { id: 'office-staff', label: 'Office Staff', icon: Building, color: 'bg-teal-500', endpoint: 'OfficeStaffs' },
    { id: 'supporting-staff', label: 'Supporting Staff', icon: Building, color: 'bg-amber-500', endpoint: 'SupportingStaffs' }
  ];

  // Get current tab info
  const getCurrentTab = () => tabs.find(tab => tab.id === activeTab);

  // Helper function to truncate HTML content
  const truncateHtmlContent = (htmlContent, maxLength = 100) => {
    if (!htmlContent) return '';
    
    // Remove HTML tags for length calculation
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    
    if (textContent.length <= maxLength) {
      return htmlContent;
    }
    
    // Truncate and add ellipsis
    const truncatedText = textContent.substring(0, maxLength) + '...';
    return truncatedText;
  };

  // Define table columns based on active tab
  const getTableColumns = () => {
    const baseColumns = [
      {
        id: 'serialNumber',
        header: 'S.N.',
        cell: ({ row }) => (
          <div className="text-sm font-medium text-gray-900">
            {row.index + 1}
          </div>
        ),
        size: 60,
      },
      {
        accessorKey: 'image',
        header: 'Image',
        cell: ({ row }) => {
          const message = row.original;
          return (
            <div className="w-16 h-16 flex-shrink-0">
              {message.image ? (
                <img
                  src={(() => {
                    if (!message.image) return '';
                    
                    // Check if it's already a full URL or base64
                    if (message.image.startsWith('http://') || 
                        message.image.startsWith('https://') || 
                        message.image.startsWith('data:image/')) {
                      return message.image;
                    }
                    
                    // Use the proper base URL for files
                    const baseURL = getBaseFileURL();
                    const cleanPath = message.image.startsWith('/') ? message.image : `/${message.image}`;
                    return `${baseURL}${cleanPath}`;
                  })()}
                  alt={message.name || message.title}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  <User size={20} className="text-gray-400" />
                </div>
              )}
            </div>
          );
        },
        size: 80,
      }
    ];

    if (activeTab === 'vision-mission') {
      return [
        ...baseColumns,
        {
          accessorKey: 'title',
          header: 'Title',
          cell: ({ row }) => (
            <div className="max-w-xs">
              <div className="font-semibold text-gray-900 truncate">{row.original.title}</div>
              <div className="text-sm text-blue-600 capitalize">{row.original.type}</div>
            </div>
          ),
          size: 200,
        },
        {
          accessorKey: 'content',
          header: 'Content',
          cell: ({ row }) => {
            const content = row.original.content || '';
            const truncatedContent = truncateHtmlContent(content, 80);
            const hasMoreContent = content.length > 80;
            
            return (
              <div className="max-w-xs">
                <div 
                  className="text-sm text-gray-700"
                  title={hasMoreContent ? content.replace(/<[^>]*>/g, '') : ''}
                >
                  {truncatedContent}
                </div>
                {hasMoreContent && (
                  <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                    View more...
                  </span>
                )}
              </div>
            );
          },
          size: 250,
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => (
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(row.original)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDelete(row.original.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ),
          size: 100,
        },
      ];
    } else {
      const columns = [
        ...baseColumns,
        {
          accessorKey: 'name',
          header: 'Name',
          cell: ({ row }) => (
            <div className="max-w-xs">
              <div className="font-semibold text-gray-900 truncate">{row.original.name}</div>
              {row.original.designation && (
                <div className="text-sm text-blue-600 truncate">{row.original.designation}</div>
              )}
            </div>
          ),
          size: 200,
        }
      ];

      // Add contact and email columns for relevant tabs
      if (activeTab === 'director-message' || activeTab === 'assistant-directors' || 
          activeTab === 'additional-directors' || activeTab === 'office-staff' || 
          activeTab === 'supporting-staff') {
        columns.push(
          {
            accessorKey: 'contactNo',
            header: 'Contact',
            cell: ({ row }) => (
              <div className="text-sm text-gray-600">
                {row.original.contactNo || '-'}
              </div>
            ),
            size: 120,
          },
          {
            accessorKey: 'email',
            header: 'Email',
            cell: ({ row }) => (
              <div className="text-sm text-gray-600 max-w-xs truncate">
                {row.original.email || '-'}
              </div>
            ),
            size: 180,
          }
        );
      }

      // Add message column for message tabs
      if (activeTab === 'vc-message' || activeTab === 'director-message') {
        columns.push({
          accessorKey: 'message',
          header: 'Message',
          cell: ({ row }) => {
            const message = row.original.message || '';
            const truncatedMessage = truncateHtmlContent(message, 80);
            const hasMoreContent = message.length > 80;
            
            return (
              <div className="max-w-xs">
                <div 
                  className="text-sm text-gray-700"
                  title={hasMoreContent ? message.replace(/<[^>]*>/g, '') : ''}
                >
                  {truncatedMessage}
                </div>
                {hasMoreContent && (
                  <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                    View more...
                  </span>
                )}
              </div>
            );
          },
          size: 250,
        });
      }

      // Add actions column
      columns.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => handleDelete(row.original.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
        size: 100,
      });

      return columns;
    }
  };

  // Fetch messages for current tab
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const currentTab = getCurrentTab();
      const response = await API.get(`/${currentTab.endpoint}`);
      setMessages(Array.isArray(response.data) ? response.data : response.data ? [response.data] : []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    resetFormForTab();
  }, [activeTab]);

  // Reset form for current tab
  const resetFormForTab = () => {
    const baseForm = {
      id: 0,
      name: '',
      designation: '',
      image: null
    };

    if (activeTab === 'vision-mission') {
      setFormData({
        ...baseForm,
        type: 'vision',
        title: '',
        content: ''
      });
    } else if (activeTab === 'vc-message') {
      setFormData({
        ...baseForm,
        message: ''
      });
    } else if (activeTab === 'director-message') {
      setFormData({
        ...baseForm,
        message: '',
        contactNo: '',
        email: ''
      });
    } else {
      setFormData({
        ...baseForm,
        contactNo: '',
        email: ''
      });
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Limit contact number to 10 digits
    if (name === 'contactNo') {
      // Only allow digits and limit to 10 characters
      if (/\D/.test(value)) {
        return; // Ignore non-digit characters
      }
      if (value.length > 10) {
        return; // Don't allow more than 10 digits
      }
    }
    
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
    resetFormForTab();
    setSelectedFile(null);
    setEditingMessage(null);
    setShowForm(false);
    setErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validate form data
  const validateForm = () => {
    const newErrors = {};
    
    // Validate contact number if present
    if (formData.contactNo && formData.contactNo.trim() !== '') {
      if (!validateMobileNumber(formData.contactNo)) {
        newErrors.contactNo = 'Please enter a valid 10-digit mobile number';
      }
    }
    
    // Validate email if present
    if (formData.email && formData.email.trim() !== '') {
      if (!validateEmail(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create new message
  const handleCreate = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      const currentTab = getCurrentTab();
      const formDataToSend = new FormData();
      
      // Append form fields based on tab type
      if (activeTab === 'vision-mission') {
        formDataToSend.append('Type', formData.type);
        formDataToSend.append('Title', formData.title);
        formDataToSend.append('Content', formData.content);
      } else {
        formDataToSend.append('Name', formData.name);
        formDataToSend.append('Designation', formData.designation);
        
        if (activeTab === 'vc-message') {
          formDataToSend.append('Message', formData.message);
        } else if (activeTab === 'director-message') {
          formDataToSend.append('Message', formData.message);
          formDataToSend.append('ContactNo', formData.contactNo);
          formDataToSend.append('Email', formData.email);
        } else {
          formDataToSend.append('ContactNo', formData.contactNo);
          formDataToSend.append('Email', formData.email);
        }
      }
      
      // Append file if selected
      if (selectedFile) {
        formDataToSend.append('image', selectedFile);
      }
      
      await API.post(`/${currentTab.endpoint}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      await fetchMessages();
      resetForm();
      notification().success('Message created successfully!');
    } catch (error) {
      console.error('Error creating message:', error);
      notification().error('Error creating message. Please try again.');
    }
  };

  // Update message
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      const currentTab = getCurrentTab();
      const formDataToSend = new FormData();
      
      formDataToSend.append('Id', formData.id);
      
      // Append form fields based on tab type
      if (activeTab === 'vision-mission') {
        formDataToSend.append('Type', formData.type);
        formDataToSend.append('Title', formData.title);
        formDataToSend.append('Content', formData.content);
      } else {
        formDataToSend.append('Name', formData.name);
        formDataToSend.append('Designation', formData.designation);
        
        if (activeTab === 'vc-message') {
          formDataToSend.append('Message', formData.message);
        } else if (activeTab === 'director-message') {
          formDataToSend.append('Message', formData.message);
          formDataToSend.append('ContactNo', formData.contactNo);
          formDataToSend.append('Email', formData.email);
        } else {
          formDataToSend.append('ContactNo', formData.contactNo);
          formDataToSend.append('Email', formData.email);
        }
      }
      
      // Append file if selected
      if (selectedFile) {
        formDataToSend.append('image', selectedFile);
      }
      
      await API.put(`/${currentTab.endpoint}/${formData.id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      await fetchMessages();
      resetForm();
      notification().success('Message updated successfully!');
    } catch (error) {
      console.error('Error updating message:', error);
      notification().error('Error updating message. Please try again.');
    }
  };

  // Delete message
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        const currentTab = getCurrentTab();
        await API.delete(`/${currentTab.endpoint}/${id}`);
        await fetchMessages();
        notification().success('Message deleted successfully!');
      } catch (error) {
        console.error('Error deleting message:', error);
        notification().error('Error deleting message. Please try again.');
      }
    }
  };

  // Edit message
  const handleEdit = (message) => {
    if (activeTab === 'vision-mission') {
      setFormData({
        id: message.id,
        type: message.type || 'vision',
        title: message.title || '',
        content: message.content || '',
        image: message.image
      });
    } else {
      setFormData({
        id: message.id,
        name: message.name || '',
        designation: message.designation || '',
        message: message.message || '',
        contactNo: message.contactNo || '',
        email: message.email || '',
        image: message.image
      });
    }
    setEditingMessage(message);
    setShowForm(true);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-none p-2 sm:p-4 md:p-6 space-y-2 sm:space-y-4 md:space-y-6" style={{ minWidth: 0 }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">About Us Settings</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1 truncate">Manage messages and information for different sections</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 -mx-2 sm:-mx-4 md:-mx-6 px-2 sm:px-4 md:px-6 w-full min-w-0">
            <div 
              className="overflow-x-auto w-full" 
              style={{
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <nav className="flex space-x-1 sm:space-x-2 lg:space-x-4 pb-2" style={{ minWidth: 'max-content' }}>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 py-2 px-2 sm:px-3 lg:px-4 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors min-w-0 ${
                        isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className={`p-1 rounded flex-shrink-0 ${
                        isActive ? tab.color : 'bg-gray-400'
                      }`}>
                        <Icon size={10} className="sm:w-3 sm:h-3 text-white" />
                      </div>
                      <span className="whitespace-nowrap text-xs sm:text-sm lg:text-base truncate" style={{ maxWidth: '150px' }}>{tab.label}</span>
                    </button>
                  );
                })}</nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow border border-gray-200 w-full min-w-0" style={{ overflow: 'hidden' }}>
            <div className="p-3 sm:p-4 md:p-6 w-full min-w-0">
              {/* Tab Header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 w-full min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    {getCurrentTab()?.label}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                    Manage {getCurrentTab()?.label.toLowerCase()} content
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetFormForTab();
                    setShowForm(true);
                  }}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add New</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>

              {/* Messages Table */}
              {loading ? (
                <div className="flex justify-center items-center p-4 sm:p-6 md:p-8">
                  <div className="text-sm sm:text-base text-gray-600">Loading...</div>
                </div>
              ) : (
                <TableService
                  columns={getTableColumns()}
                  data={messages}
                  initialPageSize={10}
                  serverPagination={false}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-transparent bg-opacity-30 flex items-center justify-center z-50 p-4"
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl w-full border border-gray-300 flex flex-col"
            style={{
              maxWidth: 'min(95vw, 600px)',
              maxHeight: 'min(95vh, 600px)',
              minHeight: '300px',
              overflow: 'hidden'
            }}
          >
            {/* Header - Fixed */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0 w-full min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate pr-4 flex-1 min-w-0">
                {editingMessage ? 'Edit' : 'Add New'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <div 
              className="flex-1 p-4 min-h-0 w-full"
              style={{ 
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                minWidth: 0
              }}
            >
              <form id="aboutus-form" onSubmit={editingMessage ? handleUpdate : handleCreate} className="space-y-4 w-full min-w-0">
                <div className="grid grid-cols-1 gap-4 w-full min-w-0">
                  {activeTab === 'vision-mission' ? (
                    <>
                      {/* Type for Vision/Mission */}
                      <div className="w-full min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Type *
                        </label>
                        <select
                          name="type"
                          value={formData.type}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          style={{ minWidth: 0 }}
                          required
                        >
                          <option value="vision">Vision</option>
                          <option value="mission">Mission</option>
                          <option value="objective">Objective</option>
                        </select>
                      </div>

                      {/* Title */}
                      <div className="w-full min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          style={{ minWidth: 0 }}
                          required
                        />
                      </div>

                      {/* Content */}
                      <div className="w-full min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Content
                        </label>
                        <RichTextEditor
                          value={formData.content}
                          onChange={(content) => {
                            setFormData(prev => ({
                              ...prev,
                              content: content
                            }));
                          }}
                          placeholder="Enter the content..."
                          height="200px"
                          showWordCount={true}
                          showCharCount={true}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Name */}
                      <div className="w-full min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          style={{ minWidth: 0 }}
                          required
                        />
                      </div>

                      {/* Designation */}
                      <div className="w-full min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          name="designation"
                          value={formData.designation}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          style={{ minWidth: 0 }}
                        />
                      </div>

                      {(activeTab === 'director-message' || activeTab === 'associate-directors' || 
                        activeTab === 'assistant-directors' || activeTab === 'additional-directors' || 
                        activeTab === 'office-staff' || activeTab === 'supporting-staff') && (
                        <>
                          {/* Contact Number */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Contact Number
                            </label>
                            <input
                              type="text"
                              name="contactNo"
                              value={formData.contactNo}
                              onChange={handleInputChange}
                              maxLength={10}
                              pattern="[0-9]*"
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${errors.contactNo ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.contactNo && (
                              <p className="text-xs text-red-600 mt-1 ml-1">
                                {errors.contactNo}
                              </p>
                            )}
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email
                            </label>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.email && (
                              <p className="text-xs text-red-600 mt-1 ml-1">
                                {errors.email}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {(activeTab === 'vc-message' || activeTab === 'director-message') && (
                        /* Message */
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message
                          </label>
                          <RichTextEditor
                            value={formData.message}
                            onChange={(content) => {
                              setFormData(prev => ({
                                ...prev,
                                message: content
                              }));
                            }}
                            placeholder="Enter the message content..."
                            height="200px"
                            showWordCount={true}
                            showCharCount={true}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {selectedFile && (
                      <p 
                        className="text-xs text-gray-600 mt-1 p-2 bg-green-50 rounded-md"
                        style={{
                          wordBreak: 'break-all',
                          overflow: 'hidden'
                        }}
                      >
                        Selected: {selectedFile.name}
                      </p>
                    )}
                    {editingMessage && formData.image && !selectedFile && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p 
                          className="text-xs text-green-600 mb-1"
                          style={{
                            wordBreak: 'break-all',
                            overflow: 'hidden'
                          }}
                        >
                          Current: {formData.image.split('/').pop()}
                        </p>
                        <img
                          src={(() => {
                            if (!formData.image) return '';
                            
                            // Check if it's already a full URL or base64
                            if (formData.image.startsWith('http://') || 
                                formData.image.startsWith('https://') || 
                                formData.image.startsWith('data:image/')) {
                              return formData.image;
                            }
                            
                            // Use the proper base URL for files
                            const baseURL = getBaseFileURL();
                            const cleanPath = formData.image.startsWith('/') ? formData.image : `/${formData.image}`;
                            return `${baseURL}${cleanPath}`;
                          })()}
                          alt="Current"
                          className="w-16 h-16 object-fitcover rounded border border-gray-200"
                          style={{ maxWidth: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Form Actions - Fixed Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="aboutus-form"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium"
              >
                <Save size={16} />
                {editingMessage 
                  ? (activeTab === 'vc-message' || activeTab === 'director-message' ? 'Update Message' : 'Update') 
                  : (activeTab === 'vc-message' || activeTab === 'director-message' ? 'Create Message' : 'Add New')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutusSettings;