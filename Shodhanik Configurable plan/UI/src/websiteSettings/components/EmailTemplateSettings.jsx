import { useState, useEffect, useMemo } from 'react';
import { Mail, MessageSquare, Plus, Edit, Trash2, Save, X, Eye } from 'lucide-react';
import API from '@/services/API';
import RichTextEditor from './RichTextEditor';
import TableService from '@/services/TableService';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const EmailTemplateSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_emailtemplates.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_emailtemplates.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('email');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    templateName: '',
    type: 'Email',
    subject: '',
    content: ''
  });

  // Fetch templates from API
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching templates...'); // Debug log
      const response = await API.get('/EmailTemplates');
      console.log('Fetch response:', response.data); // Debug log
      
      if (response.data && response.data.success && response.data.data) {
        const templates = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        console.log('Templates set:', templates); // Debug log
        setTemplates([...templates]); // Force array update with spread operator
      } else if (response.data && Array.isArray(response.data)) {
        console.log('Templates set (direct array):', response.data); // Debug log
        setTemplates([...response.data]); // Force array update with spread operator
      } else {
        console.log('No templates found or unexpected response format');
        setTemplates([]);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      notification().error('Failed to fetch email templates. Please try again later.');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // Create or update template
  const saveTemplate = async () => {
    // Validation
    if (!formData.templateName.trim()) {
      notification().error('Template name is required');
      return;
    }
    
    if (!formData.content.trim()) {
      notification().error('Template content is required');
      return;
    }
    
    // Require subject for both Email and SMS templates
    if (!formData.subject.trim()) {
      notification().error(`${formData.type} subject is required`);
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        templateName: formData.templateName.trim(),
        type: formData.type,
        subject: formData.subject.trim(), // Required for both Email and SMS
        content: formData.content.trim()
      };

      // Add templateId only when editing (not for new templates)
      if (editingTemplate && editingTemplate.templateId) {
        payload.templateId = editingTemplate.templateId;
      }

      console.log('Saving template:', payload); // Debug log
      console.log('Form data type:', formData.type); // Debug log
      console.log('Active tab:', activeTab); // Debug log
      
      let response;
      if (editingTemplate) {
        console.log('Updating template ID:', editingTemplate.id); // Debug log
        response = await API.put(`/EmailTemplates/${editingTemplate.id}`, payload);
      } else {
        console.log('Creating new template'); // Debug log
        response = await API.post('/EmailTemplates', payload);
      }
      
      console.log('API Response:', response.data); // Debug log
      
      if (response.data && (response.data.success || response.status === 200)) {
        notification().success(
          editingTemplate 
            ? 'Template updated successfully!' 
            : 'Template created successfully!'
        );
        
        // Force refresh the templates list to get updated data
        await fetchTemplates();
        
        // Wait a bit to ensure the fetch is complete, then close form
        setTimeout(() => {
          resetForm();
        }, 100);
      } else {
        notification().error(response.data?.message || 'Failed to save template');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      notification().error(err.response?.data?.message || 'Failed to save template. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const deleteTemplate = async (id) => {
    // Use window.confirm for now, but show notification after
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      console.log('Deleting template ID:', id); // Debug log
      
      const response = await API.delete(`/EmailTemplates/${id}`);
      console.log('Delete response:', response.data); // Debug log
      
      if (response.data && (response.data.success || response.status === 200)) {
        notification().success('Template deleted successfully!');
        await fetchTemplates();
        console.log('Template deleted and list refreshed'); // Debug log
      } else {
        notification().error(response.data?.message || 'Failed to delete template');
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      notification().error(err.response?.data?.message || 'Failed to delete template. Please try again later.');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      templateName: '',
      type: activeTab === 'email' ? 'Email' : 'SMS',
      subject: '',
      content: ''
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  // Start editing
  const startEdit = (template) => {
    console.log('Starting edit for template:', template); // Debug log
    
    setFormData({
      templateName: template.templateName || '',
      type: template.type || 'Email',
      subject: template.subject || '',
      content: template.content || ''
    });
    setEditingTemplate(template);
    
    // Set the active tab based on template type
    setActiveTab(template.type?.toLowerCase() || 'email');
    setShowForm(true);
    
    console.log('Form data set:', {
      templateName: template.templateName || '',
      type: template.type || 'Email',
      subject: template.subject || '',
      content: template.content || ''
    }); // Debug log
  };

  // Start creating new template
  const startCreate = () => {
    setFormData({
      templateName: '',
      type: activeTab === 'email' ? 'Email' : 'SMS',
      subject: '',
      content: ''
    });
    setEditingTemplate(null);
    setShowForm(true);
  };

  // Filter templates by type
  const getFilteredTemplates = () => {
    return templates.filter(template => 
      template.type?.toLowerCase() === activeTab
    );
  };

  // Helper function to truncate HTML content
  const truncateHtmlContent = (htmlContent, maxLength = 80) => {
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

  // Define table columns
  const columns = useMemo(() => [
    {
      id: 'serialNumber',
      header: 'S.N.',
      size: 60,
      cell: ({ row, table }) => {
        // Use the row's position in the current page's row model
        const currentPageRows = table.getRowModel().rows;
        const rowPosition = currentPageRows.indexOf(row);
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        const serialNumber = pageIndex * pageSize + rowPosition + 1;
        
        return (
          <div className="text-center font-medium text-gray-900">
            {serialNumber}
          </div>
        );
      },
    },
    {
      accessorKey: 'templateId',
      header: 'Template ID',
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded">
          {row.original.templateId}
        </span>
      ),
    },
    {
      accessorKey: 'templateName',
      header: 'Template Name',
      size: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.type === 'Email' ? (
            <Mail size={16} className="text-blue-600 flex-shrink-0" />
          ) : (
            <MessageSquare size={16} className="text-green-600 flex-shrink-0" />
          )}
          <span className="font-medium text-sm truncate" title={row.original.templateName}>
            {row.original.templateName}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      size: 80,
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
          row.original.type === 'Email' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-green-100 text-green-800'
        }`}>
          {row.original.type}
        </span>
      ),
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      size: 200,
      cell: ({ row }) => {
        const subject = row.original.subject;
        const truncatedSubject = subject && subject.length > 40 
          ? `${subject.substring(0, 40)}...` 
          : subject;
        
        return (
          <div className="max-w-xs">
            {subject ? (
              <span 
                className="text-sm text-gray-700" 
                title={subject}
              >
                {truncatedSubject}
              </span>
            ) : (
              <span className="text-xs text-gray-400">No subject</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'content',
      header: 'Content Preview',
      size: 250,
      cell: ({ row }) => {
        const content = row.original.content || '';
        const isEmail = row.original.type === 'Email';
        const truncatedContent = truncateHtmlContent(content, 60);
        const hasMoreContent = content.length > 60;
        
        return (
          <div className="max-w-xs">
            <div 
              className="text-sm text-gray-700"
              title={hasMoreContent ? content.replace(/<[^>]*>/g, '') : ''}
            >
              {isEmail ? (
                <span dangerouslySetInnerHTML={{ __html: truncatedContent }} />
              ) : (
                <span>{truncatedContent}</span>
              )}
            </div>
            {hasMoreContent && (
              <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                View more...
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 120,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              previewTemplateContent(row.original);
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
            title="Preview"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startEdit(row.original);
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteTemplate(row.original.id);
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);

  // Get filtered data for the table
  const tableData = useMemo(() => {
    const filtered = getFilteredTemplates();
    console.log('Table data updated:', filtered); // Debug log
    return filtered;
  }, [templates, activeTab]);

  // Preview template
  const previewTemplateContent = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (showForm && !editingTemplate) {
      // Only update type for new templates, not when editing
      setFormData(prev => ({
        ...prev,
        type: activeTab === 'email' ? 'Email' : 'SMS'
      }));
    }
  }, [activeTab, showForm, editingTemplate]);

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066cc] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading email templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Email & SMS Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage email and SMS templates for automated communications
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Template
        </button>
      </div>

      {/* Template Type Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center cursor-pointer ${
            activeTab === 'email'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Mail size={16} />
          Email Templates
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center cursor-pointer ${
            activeTab === 'sms'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <MessageSquare size={16} />
          SMS Templates
        </button>
      </div>

      {/* Template Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Template Name and Subject in same row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.templateName}
                  onChange={(e) => setFormData(prev => ({ ...prev, templateName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter template name"
                  required
                />
              </div>

              {(activeTab === 'email' || activeTab === 'sms') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {activeTab === 'email' ? 'Email Subject' : 'SMS Subject'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={activeTab === 'email' ? 'Enter email subject' : 'Enter SMS subject/title'}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {activeTab === 'email' ? 'Email Content' : 'SMS Content'} <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                placeholder={activeTab === 'email' ? 'Enter email content...' : 'Enter SMS content...'}
                height={activeTab === 'email' ? '300px' : '200px'}
                maxLength={activeTab === 'sms' ? 160 : null}
                showCharCount={activeTab === 'sms'}
                showWordCount={activeTab === 'email'}
              />
              {activeTab === 'sms' && (
                <div className="text-xs text-gray-500 mt-1">
                  Note: SMS templates support rich formatting, but actual SMS delivery may be limited to plain text depending on the service provider.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  saving 
                    ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                }`}
              >
                <Save size={16} />
                {saving ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {activeTab === 'email' ? 'Email Templates' : 'SMS Templates'} ({tableData.length})
          </h3>
        </div>

        <div className="p-4">
          {tableData.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                {activeTab === 'email' ? <Mail size={48} className="mx-auto" /> : <MessageSquare size={48} className="mx-auto" />}
              </div>
              <p className="text-gray-500">No {activeTab} templates found</p>
              <button
                onClick={startCreate}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm cursor-pointer"
              >
                Create your first template
              </button>
            </div>
          ) : (
            <TableService
              key={`email-template-table-${activeTab}`} // Reset table state when switching tabs
              columns={columns}
              data={tableData}
              initialPageSize={10}
              loading={loading}
              onRowClick={(row) => {
                // Optional: Handle row click if needed
                console.log('Row clicked:', row.original);
              }}
            />
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-300">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {previewTemplate.type === 'Email' ? (
                  <Mail size={20} className="text-blue-600" />
                ) : (
                  <MessageSquare size={20} className="text-green-600" />
                )}
                <h3 className="text-lg font-semibold text-gray-800">
                  Preview: {previewTemplate.templateName}
                </h3>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {previewTemplate.subject && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Subject:</p>
                  <p className="font-medium text-gray-900">{previewTemplate.subject}</p>
                </div>
              )}
              
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                {previewTemplate.type === 'Email' ? (
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.content }} 
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-gray-900">
                    {previewTemplate.content}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateSettings;