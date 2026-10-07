import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, AlertCircle, CheckCircle, Info, Bell, Send, FileText, Calendar, X } from 'lucide-react';
import API from '@/services/API';
import RichTextEditor from './RichTextEditor';
import TableService from '@/services/TableService';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const NoticeboardSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_noticeboard.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_noticeboard.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  const [newsAnnouncements, setNewsAnnouncements] = useState([]);
  const [noticeboardNotices, setNoticeboardNotices] = useState([]);
  const [loading, setLoading] = useState({
    newsAnnouncements: true,
    noticeboardNotices: true
  });
  const [error, setError] = useState(null);
  
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('notices');

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return dateString; // Return original string if parsing fails
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

  // Fetch news announcements
  const fetchNewsAnnouncements = async () => {
    try {
      setLoading(prev => ({ ...prev, newsAnnouncements: true }));
      const response = await API.get('/NewsAnnouncements');
      if (response.data.success && response.data.data) {
        setNewsAnnouncements(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching news announcements:', err);
      setError('Failed to fetch news announcements');
    } finally {
      setLoading(prev => ({ ...prev, newsAnnouncements: false }));
    }
  };

  // Fetch noticeboard notices
  const fetchNoticeboardNotices = async () => {
    try {
      setLoading(prev => ({ ...prev, noticeboardNotices: true }));
      const response = await API.get('/NoticeboardNotices');
      if (response.data.success && response.data.data) {
        setNoticeboardNotices(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching noticeboard notices:', err);
      setError('Failed to fetch noticeboard notices');
    } finally {
      setLoading(prev => ({ ...prev, noticeboardNotices: false }));
    }
  };

  // News announcements CRUD operations
  const createNewsAnnouncement = async (data) => {
    try {
      const formData = new FormData();
      if (data.file) formData.append('file', data.file);
      formData.append('title', data.title || '');
      formData.append('category', data.category || 'News');
      formData.append('language', data.language || 'Hindi & English');
      formData.append('date', data.date || new Date().toISOString());
      formData.append('status', data.status || 'Active');

      const response = await API.post('/NewsAnnouncements', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        await fetchNewsAnnouncements();
        return response.data;
      }
    } catch (err) {
      console.error('Error creating news announcement:', err);
      throw err;
    }
  };

  const updateNewsAnnouncement = async (id, data) => {
    try {
      const formData = new FormData();
      formData.append('id', id);
      if (data.file) formData.append('file', data.file);
      formData.append('title', data.title || '');
      formData.append('category', data.category || 'News');
      formData.append('language', data.language || 'Hindi & English');
      formData.append('date', data.date || new Date().toISOString());
      formData.append('status', data.status || 'Active');

      const response = await API.put(`/NewsAnnouncements/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        await fetchNewsAnnouncements();
        return response.data;
      }
    } catch (err) {
      console.error('Error updating news announcement:', err);
      throw err;
    }
  };

  const deleteNewsAnnouncement = async (id) => {
    try {
      const response = await API.delete(`/NewsAnnouncements/${id}`);
      if (response.data.success) {
        await fetchNewsAnnouncements();
        return response.data;
      }
    } catch (err) {
      console.error('Error deleting news announcement:', err);
      throw err;
    }
  };

  const archiveNewsAnnouncement = async (id) => {
    try {
      const response = await API.put(`/NewsAnnouncements/${id}/archive`);
      if (response.data.success) {
        await fetchNewsAnnouncements();
        return response.data;
      }
    } catch (err) {
      console.error('Error archiving news announcement:', err);
      throw err;
    }
  };

  // Noticeboard notices CRUD operations
  const createNoticeboardNotice = async (data) => {
    try {
      const response = await API.post('/NoticeboardNotices', data);
      if (response.data.success) {
        await fetchNoticeboardNotices();
        return response.data;
      }
    } catch (err) {
      console.error('Error creating noticeboard notice:', err);
      throw err;
    }
  };

  const updateNoticeboardNotice = async (id, data) => {
    try {
      const response = await API.put(`/NoticeboardNotices/${id}`, { ...data, id });
      if (response.data.success) {
        await fetchNoticeboardNotices();
        return response.data;
      }
    } catch (err) {
      console.error('Error updating noticeboard notice:', err);
      throw err;
    }
  };

  const deleteNoticeboardNotice = async (id) => {
    try {
      const response = await API.delete(`/NoticeboardNotices/${id}`);
      if (response.data.success) {
        await fetchNoticeboardNotices();
        return response.data;
      }
    } catch (err) {
      console.error('Error deleting noticeboard notice:', err);
      throw err;
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchNewsAnnouncements();
    fetchNoticeboardNotices();
  }, []);

  const noticeTypes = [
    { id: 'info', label: 'Information', color: 'blue', icon: Info },
    { id: 'announcement', label: 'Announcement', color: 'purple', icon: Bell },
    { id: 'urgent', label: 'Urgent', color: 'red', icon: AlertCircle },
    { id: 'success', label: 'Success', color: 'green', icon: CheckCircle }
  ];

  const handleArrayUpdate = async (field, index, newItem) => {
    try {
      let result;
      if (field === 'newsAnnouncements') {
        if (index === -1) {
          result = await createNewsAnnouncement(newItem);
          console.log('Successfully created news announcement:', result);
        } else {
          const existingItem = newsAnnouncements[index];
          if (!existingItem || !existingItem.id) {
            console.warn('No valid ID found for news announcement, creating new item instead');
            result = await createNewsAnnouncement(newItem);
          } else {
            result = await updateNewsAnnouncement(existingItem.id, newItem);
            console.log('Successfully updated news announcement:', result);
          }
        }
      } else if (field === 'notices') {
        if (index === -1) {
          result = await createNoticeboardNotice(newItem);
        } else {
          const existingItem = noticeboardNotices[index];
          if (!existingItem || !existingItem.id) {
            console.warn('No valid ID found for noticeboard notice, creating new item instead');
            result = await createNoticeboardNotice(newItem);
          } else {
            result = await updateNoticeboardNotice(existingItem.id, newItem);
          }
        }
      }
      
      // Show success message
      const action = index === -1 ? 'created' : 'updated';
      const itemType = field === 'newsAnnouncements' ? 'news announcement' : 'notice';
      console.log(`Successfully ${action} ${itemType}:`, result);
      
    } catch (error) {
      console.error('Error updating item:', error);
      
      // Provide more specific error messages
      if (error.message.includes('not found') || error.message.includes('404')) {
        notification().error('The item you are trying to update no longer exists. It may have been deleted. The page will refresh to sync with the server.');
        // Refresh the data to sync with server
        if (field === 'newsAnnouncements') {
          await refreshNewsAnnouncements();
        } else if (field === 'notices') {
          await loadNoticeboardNotices();
        }
      } else {
        notification().error('Error updating item. Please try again.');
      }
      throw error; // Re-throw so the modal can handle it
    }
  };

  const handleArrayDelete = async (field, index) => {
    try {
      if (field === 'newsAnnouncements') {
        await deleteNewsAnnouncement(newsAnnouncements[index].id);
      } else if (field === 'notices') {
        await deleteNoticeboardNotice(noticeboardNotices[index].id);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      notification().error('Error deleting item. Please try again.');
    }
  };

  const handlePublishNotice = (notice) => {
    // Simulate push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notice.title || 'New Notice', {
        body: notice.content,
        icon: '/public/university/logo.png'
      });
    }
    notification().success(`Notice "${notice.title || 'Untitled'}" has been published to the noticeboard!`);
  };

  const renderNewsAnnouncementsSettings = () => {
    const tableRef = useRef(null);
    
    // Define columns for the table
    const columns = [
      {
        accessorKey: 'sn',
        header: 'S.N.',
        cell: ({ row }) => (
          <span className="font-medium text-gray-700">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <div className="font-medium text-blue-600 hover:underline cursor-pointer max-w-xs truncate" title={getValue()}>
            {getValue()}
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            getValue() === 'News'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ getValue }) => <span className="text-sm">{formatDate(getValue())}</span>,
      },
      {
        accessorKey: 'language',
        header: 'Language',
        cell: ({ getValue }) => (
          <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-medium">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'format',
        header: 'Format',
        cell: ({ getValue }) => (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-semibold">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'size',
        header: 'Size',
        cell: ({ getValue }) => getValue() && (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
            getValue() === 'Active'
              ? 'bg-green-100 text-green-700'
              : getValue() === 'Archived'
              ? 'bg-orange-100 text-orange-700'
              : getValue() === 'Draft'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const newsItem = row.original;
          return (
            <div className="flex gap-1 justify-center">
              <button
                onClick={() => setEditingItem({
                  type: 'newsAnnouncements',
                  index: newsAnnouncements.findIndex(item => item.id === newsItem.id),
                  data: newsItem
                })}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Edit"
              >
                <Edit size={16} />
              </button>
              {newsItem.status !== 'Archived' && (
                <button
                  onClick={async () => {
                    try {
                      await archiveNewsAnnouncement(newsItem.id);
                    } catch (error) {
                      console.error('Error archiving announcement:', error);
                      notification().error('Error archiving announcement. Please try again.');
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                  title="Archive"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4m6 5V9a2 2 0 00-2-2H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-1" />
                  </svg>
                </button>
              )}
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
                    try {
                      await deleteNewsAnnouncement(newsItem.id);
                    } catch (error) {
                      console.error('Error deleting announcement:', error);
                      notification().error('Error deleting announcement. Please try again.');
                    }
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        },
      },
    ];

    return (
      <div className="space-y-4">
        {/* Header with Action Button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">News & Announcements</h3>
            <p className="text-sm text-gray-600 mt-1">Manage website news and downloadable content</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNewsAnnouncements}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all cursor-pointer"
              title="Refresh data from server"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => setEditingItem({
                type: 'newsAnnouncements',
                index: -1,
                data: {
                  title: '',
                  category: 'News',
                  language: 'Hindi & English',
                  format: 'PDF',
                  size: '',
                  date: new Date().toISOString(),
                  status: 'Active'
                }
              })}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              Add New Item
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FileText className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Total Items</p>
                <p className="text-2xl font-bold text-blue-900">{newsAnnouncements?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Active</p>
                <p className="text-2xl font-bold text-green-900">
                  {newsAnnouncements?.filter(n => n.status === 'Active').length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Calendar className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700">News</p>
                <p className="text-2xl font-bold text-orange-900">
                  {newsAnnouncements?.filter(n => n.category === 'News').length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Bell className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Downloads</p>
                <p className="text-2xl font-bold text-purple-900">
                  {newsAnnouncements?.filter(n => n.category === 'Downloads').length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading.newsAnnouncements && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading news announcements...</p>
          </div>
        )}

        {/* Table View */}
        {!loading.newsAnnouncements && (!newsAnnouncements || newsAnnouncements.length === 0) ? (
          <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No news items yet</h3>
            <p className="text-gray-500 mb-6">Create your first news announcement to get started</p>
            <button
              onClick={() => setEditingItem({
                type: 'newsAnnouncements',
                index: -1,
                data: {
                  title: '',
                  category: 'News',
                  language: 'Hindi & English',
                  format: 'PDF',
                  size: '',
                  date: new Date().toISOString(),
                  status: 'Active'
                }
              })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={18} />
              Create First News Item
            </button>
          </div>
        ) : (
          <TableService
            ref={tableRef}
            columns={columns}
            data={newsAnnouncements.sort((a, b) => {
              const dateA = new Date(a.date);
              const dateB = new Date(b.date);
              return dateB - dateA; // Newest first
            })}
            initialPageSize={10}
            loading={loading.newsAnnouncements}
          />
        )}
      </div>
    );
  };

  const renderNoticesSettings = () => {
    const tableRef = useRef(null);
    
    // Define columns for the table
    const columns = [
      {
        accessorKey: 'sn',
        header: 'S.N.',
        cell: ({ row }) => (
          <span className="font-medium text-gray-700">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <div className="font-medium text-blue-600 hover:underline cursor-pointer max-w-xs truncate" title={getValue()}>
            {getValue()}
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const notice = row.original;
          const noticeType = noticeTypes.find(type => type.id === notice.type) || noticeTypes[0];
          const Icon = noticeType.icon;
          return (
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
              notice.type === 'urgent' ? 'bg-red-100 text-red-700' :
              notice.type === 'announcement' ? 'bg-purple-100 text-purple-700' :
              notice.type === 'success' ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {noticeType.label}
            </span>
          );
        },
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ getValue }) => (
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            getValue() === 'urgent' ? 'bg-red-100 text-red-700' :
            getValue() === 'high' ? 'bg-orange-100 text-orange-700' :
            getValue() === 'normal' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}>
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'content',
        header: 'Content',
        cell: ({ getValue }) => (
          <div className="text-sm text-gray-700 leading-relaxed max-w-xs truncate" dangerouslySetInnerHTML={{ __html: getValue() }} />
        ),
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const notice = row.original;
          const index = noticeboardNotices.findIndex(n => n.id === notice.id);
          return (
            <div className="flex gap-1 justify-center">
              <button
                onClick={() => handlePublishNotice(notice)}
                className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
                title="Push Notification"
              >
                <Send size={16} />
              </button>
              <button
                onClick={() => setEditingItem({ index, data: notice })}
                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleArrayDelete('notices', index)}
                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        },
      },
    ];

    return (
      <div className="space-y-4">
        {/* Header with Action Button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Push Notifications</h3>
            <p className="text-sm text-gray-600 mt-1">Create and manage push notifications and announcements</p>
          </div>
          <button
            onClick={() => setEditingItem({
              index: -1,
              data: { type: 'info', title: '', content: '', bgColor: 'blue', priority: 'normal' }
            })}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Create Notice
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Info className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Total Notices</p>
                <p className="text-2xl font-bold text-blue-900">{noticeboardNotices?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Bell className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Announcements</p>
                <p className="text-2xl font-bold text-purple-900">
                  {noticeboardNotices?.filter(n => n.type === 'announcement').length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertCircle className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-red-700">Urgent</p>
                <p className="text-2xl font-bold text-red-900">
                  {noticeboardNotices?.filter(n => n.type === 'urgent').length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Success</p>
                <p className="text-2xl font-bold text-green-900">
                  {noticeboardNotices?.filter(n => n.type === 'success').length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading.noticeboardNotices && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading notices...</p>
          </div>
        )}

        {/* Table View */}
        {!loading.noticeboardNotices && (!noticeboardNotices || noticeboardNotices.length === 0) ? (
          <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No notices yet</h3>
            <p className="text-gray-500 mb-6">Create your first notice to get started</p>
            <button
              onClick={() => setEditingItem({
                index: -1,
                data: { type: 'info', title: '', content: '', bgColor: 'blue', priority: 'normal' }
              })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={18} />
              Create First Notice
            </button>
          </div>
        ) : (
          <TableService
            ref={tableRef}
            columns={columns}
            data={noticeboardNotices}
            initialPageSize={10}
            loading={loading.noticeboardNotices}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div >
        <div className="flex items-center justify-between">
          <div>
            <h2 >Noticeboard Management</h2>
           
          </div>
          
        </div>
      </div>

      {/* Tab Navigation - Modern Pills Style */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('notices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'notices'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Bell size={16} />
          Push Notifications
        </button>
        <button
          onClick={() => setActiveTab('newsAnnouncements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'newsAnnouncements'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText size={16} />
          News & Announcements
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                if (activeTab === 'notices') {
                  fetchNoticeboardNotices();
                } else {
                  fetchNewsAnnouncements();
                }
              }}
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          {activeTab === 'notices' ? renderNoticesSettings() : renderNewsAnnouncementsSettings()}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onSave={async (data) => {
            try {
              if (editingItem.type === 'newsAnnouncements') {
                await handleArrayUpdate('newsAnnouncements', editingItem.index, data);
              } else {
                await handleArrayUpdate('notices', editingItem.index, data);
              }
              setEditingItem(null);
            } catch (error) {
              // Error is already handled in handleArrayUpdate
              console.error('Error in onSave:', error);
            }
          }}
          onCancel={() => setEditingItem(null)}
          noticeTypes={noticeTypes}
        />
      )}
    </div>
  );
};

// Edit Modal Component
const EditModal = ({ item, onSave, onCancel, noticeTypes }) => {
  const [formData, setFormData] = useState(item.data);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Check if this is a news announcement edit
  const isNewsAnnouncement = item.type === 'newsAnnouncements';

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isNewsAnnouncement ? (
                <FileText className="text-blue-600" size={24} />
              ) : (
                <Bell className="text-blue-600" size={24} />
              )}
              <h3 className="text-lg font-semibold text-gray-800">
                {item.index === -1 ? 'Create New' : 'Edit'} {isNewsAnnouncement ? 'News Item' : 'Notice'}
              </h3>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isNewsAnnouncement ? (
              // News Announcement Form
              <>
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Category</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="category"
                        value="News"
                        checked={formData.category === 'News'}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">NEWS</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="category"
                        value="Downloads"
                        checked={formData.category === 'Downloads'}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">DOWNLOADS</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    News/Download Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter news/download title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    News Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date ? (formData.date.includes('T') ? formData.date.split('T')[0] : formData.date.split('-').reverse().join('-')) : ''}
                    onChange={(e) => {
                      const dateValue = e.target.value; // This is in YYYY-MM-DD format
                      // Convert to ISO string for API
                      const isoDate = new Date(dateValue).toISOString();
                      setFormData({ ...formData, date: isoDate });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Language</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="language"
                        value="English"
                        checked={formData.language === 'English'}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">English</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="language"
                        value="Hindi"
                        checked={formData.language === 'Hindi'}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Hindi</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="language"
                        value="Hindi & English"
                        checked={formData.language === 'Hindi & English'}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Hindi & English</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF File</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            // Validate file type
                            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];
                            if (!allowedTypes.includes(file.type)) {
                              notification().error('Please select a valid file type (PDF, DOC, DOCX, JPG, PNG)');
                              e.target.value = '';
                              return;
                            }

                            // Validate file size (10MB max)
                            if (file.size > 10 * 1024 * 1024) {
                              notification().error('File size cannot exceed 10MB');
                              e.target.value = '';
                              return;
                            }

                            const sizeInKb = (file.size / 1024).toFixed(2);
                            const format = file.name.split('.').pop().toUpperCase();
                            setFormData({ 
                              ...formData, 
                              size: `${sizeInKb} KB`,
                              format: format,
                              fileName: file.name,
                              file: file // Store the actual file object
                            });
                          } else {
                            // Clear file data if no file selected
                            setFormData({
                              ...formData,
                              size: '',
                              format: 'PDF',
                              fileName: '',
                              file: null
                            });
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.fileName && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              size: '',
                              format: 'PDF',
                              fileName: '',
                              file: null
                            });
                            // Clear the file input
                            const fileInput = document.querySelector('input[type="file"]');
                            if (fileInput) fileInput.value = '';
                          }}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    {formData.fileName ? (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm font-medium text-gray-700">{formData.fileName}</p>
                        <p className="text-xs text-gray-500">
                          Size: {formData.size} | Format: {formData.format}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No file selected</p>
                    )}
                  </div>

                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="Active"
                        checked={formData.status === 'Active'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="text-green-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="Archived"
                        checked={formData.status === 'Archived'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="text-yellow-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Archived</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="Draft"
                        checked={formData.status === 'Draft'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Draft</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              // Notice Form (existing)
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notice Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const selectedType = noticeTypes.find(type => type.id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          type: e.target.value,
                          bgColor: selectedType.color
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {noticeTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={formData.priority || 'normal'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter notice title..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                  <RichTextEditor
                    value={formData.content}
                    onChange={(content) => setFormData({ ...formData, content })}
                    placeholder="Enter notice content... Use the toolbar to format your text with bold, italic, colors, lists, and more."
                  />
                </div>


              </>
            )}
            
            <div className="flex gap-3 pt-6 justify-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`py-3 px-8 rounded-md transition-colors flex items-center justify-center gap-2 font-semibold cursor-pointer ${
                  isSubmitting 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 text-gray-700 py-3 px-8 rounded-md hover:bg-gray-400 transition-colors font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NoticeboardSettings;
