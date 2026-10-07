import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit, Image, Users, BarChart3, Calendar, Upload, X } from 'lucide-react';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import ProgramEventsSettings from './ProgramEventsSettings';
import ExternalLinksSettings from './ExternalLinksSettings';
import notification from '@/services/NotificationService';
import TableService from '@/services/TableService';
import { hasPermission } from '@/services/hasPermissionService';

const HomeSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_home.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_home.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  // State for different sections
  const [carouselSlides, setCarouselSlides] = useState([]);
  const [leadershipTeam, setLeadershipTeam] = useState([]);
  const [universityStatistics, setUniversityStatistics] = useState([]);
  const [bannerAnnouncements, setBannerAnnouncements] = useState([]);
  const [welcomeSection, setWelcomeSection] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    carousel: true,
    leadership: true,
    statistics: true,
    banners: true,
    welcome: true
  });
  
  // Error states
  const [error, setError] = useState(null);
  
  // UI state
  const [activeSection, setActiveSection] = useState('carousel');
  const [editingItem, setEditingItem] = useState(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());

  // Fetch carousel slides
  const fetchCarouselSlides = async (forceRefresh = false) => {
    try {
      setLoading(prev => ({ ...prev, carousel: true }));
      // Add cache busting parameter when force refreshing
      const url = forceRefresh ? `/CarouselSlides?_t=${Date.now()}` : '/CarouselSlides';
      const response = await API.get(url);
      if (response.data.success && response.data.data) {
        setCarouselSlides(response.data.data);
      }
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching carousel slides:', err);
      notification().error('Failed to fetch carousel slides');
    } finally {
      setLoading(prev => ({ ...prev, carousel: false }));
    }
  };

  // Fetch leadership team
  const fetchLeadershipTeam = async () => {
    try {
      setLoading(prev => ({ ...prev, leadership: true }));
      const response = await API.get('/LeadershipTeamMembers');
      if (response.data.success && response.data.data) {
        setLeadershipTeam(response.data.data);
      }
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching leadership team:', err);
      notification().error('Failed to fetch leadership team');
    } finally {
      setLoading(prev => ({ ...prev, leadership: false }));
    }
  };

  // Fetch university statistics
  const fetchUniversityStatistics = async () => {
    try {
      setLoading(prev => ({ ...prev, statistics: true }));
      const response = await API.get('/UniversityStatistics');
      if (response.data.success && response.data.data) {
        setUniversityStatistics(response.data.data);
      }
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching university statistics:', err);
      notification().error('Failed to fetch university statistics');
    } finally {
      setLoading(prev => ({ ...prev, statistics: false }));
    }
  };

  // Fetch banner announcements
  const fetchBannerAnnouncements = async () => {
    try {
      setLoading(prev => ({ ...prev, banners: true }));
      const response = await API.get('/BannerAnnouncements');
      if (response.data.success && response.data.data) {
        setBannerAnnouncements(response.data.data);
      }
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching banner announcements:', err);
      notification().error('Failed to fetch banner announcements');
    } finally {
      setLoading(prev => ({ ...prev, banners: false }));
    }
  };

  // Fetch welcome section
  const fetchWelcomeSection = async () => {
    try {
      setLoading(prev => ({ ...prev, welcome: true }));
      const response = await API.get('/WelcomeSections');
      if (response.data.success && response.data.data) {
        // Get the first active welcome section
        const activeSection = Array.isArray(response.data.data) 
          ? response.data.data.find(section => section.isActive) || response.data.data[0]
          : response.data.data;
        setWelcomeSection(activeSection);
      }
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching welcome section:', err);
      notification().error('Failed to fetch welcome section');
    } finally {
      setLoading(prev => ({ ...prev, welcome: false }));
    }
  };

  // Load all data on component mount
  useEffect(() => {
    fetchCarouselSlides();
    fetchLeadershipTeam();
    fetchUniversityStatistics();
    fetchBannerAnnouncements();
    fetchWelcomeSection();
  }, []);

  // Handle carousel slide operations
  const handleCarouselSlide = async (action, data, id = null) => {
    try {
      if (action === 'delete') {
        await API.delete(`/CarouselSlides/${id}`);
        await fetchCarouselSlides(true);
        setImageRefreshKey(Date.now());
        setError(null);
        return;
      }

      // Validate required fields for create/update
      if (!data.caption || data.caption.trim() === '') {
        setError('Caption is required for carousel slides');
        return;
      }

      if (action === 'create' && !data.imageFile) {
        setError('Image is required for new carousel slides');
        return;
      }

      const formData = new FormData();
      if (data.imageFile) {
        formData.append('imageFile', data.imageFile);
      }
      formData.append('caption', data.caption.trim());
      formData.append('displayOrder', data.displayOrder || 0);

      if (action === 'create') {
        await API.post('/CarouselSlides', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (action === 'update') {
        await API.put(`/CarouselSlides/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      // Force refresh carousel slides with cache busting
      await fetchCarouselSlides(true);
      
      // Update image refresh key to force re-render of images
      setImageRefreshKey(Date.now());
      
      // Clear any error state on successful update
      setError(null);
      
      // Show success message
      const successMessage = action === 'create' ? 'Carousel slide created successfully!' : 'Carousel slide updated successfully!';
      notification().success(successMessage);
      console.log(successMessage, 'Image refresh key:', Date.now());
    } catch (err) {
      console.error('Error handling carousel slide:', err);
      
      // Extract more specific error message from API response
      let errorMessage = 'Failed to update carousel slide';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  // Handle leadership team operations
  const handleLeadershipTeam = async (action, data, id = null) => {
    try {
      const formData = new FormData();
      if (data.imageFile) formData.append('ImageFile', data.imageFile);
      formData.append('Name', data.name || '');
      formData.append('Title', data.title || '');
      formData.append('Subtitle', data.subtitle || '');
      formData.append('Description', data.description || '');
      formData.append('DisplayOrder', data.displayOrder || 0);

      if (action === 'create') {
        await API.post('/LeadershipTeamMembers', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        notification().success('Leadership team member created successfully!');
      } else if (action === 'update') {
        formData.append('Id', id);
        await API.put(`/LeadershipTeamMembers/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        notification().success('Leadership team member updated successfully!');
      } else if (action === 'delete') {
        await API.delete(`/LeadershipTeamMembers/${id}`);
        notification().success('Leadership team member deleted successfully!');
      }
      
      await fetchLeadershipTeam();
    } catch (err) {
      console.error('Error handling leadership team:', err);
      notification().error('Failed to update leadership team');
    }
  };

  // Handle university statistics operations
  const handleUniversityStatistics = async (action, data, id = null) => {
    try {
      if (action === 'create') {
        await API.post('/UniversityStatistics', data);
        notification().success('University statistic created successfully!');
      } else if (action === 'update') {
        await API.put(`/UniversityStatistics/${id}`, { ...data, id });
        notification().success('University statistic updated successfully!');
      } else if (action === 'delete') {
        await API.delete(`/UniversityStatistics/${id}`);
        notification().success('University statistic deleted successfully!');
      }
      
      await fetchUniversityStatistics();
    } catch (err) {
      console.error('Error handling university statistics:', err);
      notification().error('Failed to update university statistics');
    }
  };

  // Handle banner announcements operations
  const handleBannerAnnouncements = async (action, data, id = null) => {
    try {
      if (action === 'create') {
        await API.post('/BannerAnnouncements', data);
        notification().success('Banner announcement created successfully!');
      } else if (action === 'update') {
        await API.put(`/BannerAnnouncements/${id}`, { ...data, id });
        notification().success('Banner announcement updated successfully!');
      } else if (action === 'delete') {
        await API.delete(`/BannerAnnouncements/${id}`);
        notification().success('Banner announcement deleted successfully!');
      } else if (action === 'archive') {
        await API.put(`/BannerAnnouncements/${id}/archive`);
        notification().success('Banner announcement archived successfully!');
      }
      
      await fetchBannerAnnouncements();
    } catch (err) {
      console.error('Error handling banner announcements:', err);
      notification().error('Failed to update banner announcements');
    }
  };

  // Handle welcome section operations
  const handleWelcomeSection = async (data) => {
    try {
      const updatedData = {
        welcomeTitle: data.welcomeTitle || '',
        welcomeText: data.welcomeText || '',
        isActive: true
      };

      if (welcomeSection?.id) {
        await API.put(`/WelcomeSections/${welcomeSection.id}`, { ...updatedData, id: welcomeSection.id });
        notification().success('Welcome section updated successfully!');
      } else {
        await API.post('/WelcomeSections', updatedData);
        notification().success('Welcome section created successfully!');
      }
      
      await fetchWelcomeSection();
    } catch (err) {
      console.error('Error handling welcome section:', err);
      notification().error('Failed to update welcome section');
    }
  };

  const sections = [
    { id: 'carousel', label: 'Image Carousel', icon: Image },
    { id: 'announcements', label: 'Announcements', icon: Calendar },
    { id: 'welcome', label: 'Welcome Section', icon: Edit },
    { id: 'leaders', label: 'Leadership', icon: Users },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'events', label: 'Program Events', icon: Calendar },
    { id: 'links', label: 'External Links', icon: Plus }
  ];

  const getImageUrl = (imagePath, forceRefresh = false) => {
    if (!imagePath) return '';
    
    // Check if it's already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Check if it's base64 data
    if (imagePath.startsWith('data:image/')) {
      return imagePath;
    }
    
    // Use the proper base URL for files
    const baseURL = getBaseFileURL();
    
    // Ensure the path starts with /
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    
    // Add cache busting parameter to force refresh
    const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : '';
    
    return `${baseURL}${cleanPath}${cacheBuster}`;
  };

  // Column definitions for carousel slides table
  const carouselColumns = useMemo(() => [
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
        const slide = row.original;
        return (
          <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
            {slide.image ? (
              <img
                key={`${slide.id}-${imageRefreshKey}`}
                src={`${getImageUrl(slide.image)}?_refresh=${imageRefreshKey}`}
                alt={slide.caption || 'Carousel slide'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.nextElementSibling;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-full h-full flex items-center justify-center text-gray-400"
              style={{ display: slide.image ? 'none' : 'flex' }}
            >
              <Image size={20} />
            </div>
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: 'caption',
      header: 'Caption',
      cell: ({ getValue }) => (
        <div className="max-w-xs truncate" title={getValue()}>
          {getValue() || 'No caption'}
        </div>
      ),
    },
    {
      accessorKey: 'displayOrder',
      header: 'Display Order',
      cell: ({ getValue }) => getValue() || 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const slide = row.original;
        const index = carouselSlides.findIndex(s => s.id === slide.id);
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingItem({ type: 'carousel', index, data: slide });
              }}
              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit size={14} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCarouselSlide('delete', null, slide.id);
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
  ], [carouselSlides, imageRefreshKey]);

  const renderCarouselSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Carousel Slides</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchCarouselSlides(true);
              setImageRefreshKey(Date.now());
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
            title="Refresh images"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setEditingItem({ type: 'carousel', index: -1, data: { caption: '' } })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Slide
          </button>
        </div>
      </div>

      {loading.carousel ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading carousel slides...</p>
        </div>
      ) : carouselSlides.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Carousel Slides</h3>
          <p className="text-gray-500 mb-4">Add your first carousel slide to get started</p>
          <button
            onClick={() => setEditingItem({ type: 'carousel', index: -1, data: { caption: '' } })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add First Slide
          </button>
        </div>
      ) : (
        <TableService
          columns={carouselColumns}
          data={carouselSlides}
          initialPageSize={10}
          loading={loading.carousel}
        />
      )}
    </div>
  );

  // Column definitions for banner announcements table
  const announcementsColumns = useMemo(() => [
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
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => (
        <div className="max-w-xs truncate" title={getValue()}>
          {getValue() || 'No title'}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => getValue() || 'Banner',
    },
    {
      accessorKey: 'language',
      header: 'Language',
      cell: ({ getValue }) => getValue() || 'Hindi & English',
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ getValue }) => {
        const date = getValue();
        return date ? new Date(date).toLocaleDateString() : 'No date';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue() || 'Unknown';
        return (
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            status === 'Active' 
              ? 'bg-green-100 text-green-800' 
              : status === 'Archived'
              ? 'bg-orange-100 text-orange-800'
              : status === 'Draft'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {status}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const announcement = row.original;
        const index = bannerAnnouncements.findIndex(a => a.id === announcement.id);
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingItem({ 
                  type: 'bannerAnnouncements', 
                  index: index, 
                  data: announcement 
                });
              }}
              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit size={14} />
              Edit
            </button>
            {announcement.status !== 'Archived' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBannerAnnouncements('archive', null, announcement.id);
                }}
                className="text-orange-600 hover:text-orange-900 flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4m6 5V9a2 2 0 00-2-2H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-1" />
                </svg>
                Archive
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to permanently delete this announcement?')) {
                  handleBannerAnnouncements('delete', null, announcement.id);
                }
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
  ], [bannerAnnouncements]);

  const renderAnnouncementsSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Banner Announcements</h3>
        <button
          onClick={() => setEditingItem({ 
            type: 'bannerAnnouncements', 
            index: -1, 
            data: { 
              title: '', 
              category: 'Banner', 
              language: 'Hindi & English',
              date: new Date().toISOString(),
              status: 'Active'
            } 
          })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Announcement
        </button>
      </div>

      {loading.banners ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading banner announcements...</p>
        </div>
      ) : bannerAnnouncements.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Banner Announcements</h3>
          <p className="text-gray-500 mb-4">Add your first banner announcement to get started</p>
          <button
            onClick={() => setEditingItem({ 
              type: 'bannerAnnouncements', 
              index: -1, 
              data: { 
                title: '', 
                category: 'Banner', 
                language: 'Hindi & English',
                date: new Date().toISOString(),
                status: 'Active'
              } 
            })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add First Announcement
          </button>
        </div>
      ) : (
        <TableService
          columns={announcementsColumns}
          data={bannerAnnouncements}
          initialPageSize={10}
          loading={loading.banners}
        />
      )}
    </div>
  );

  const renderWelcomeSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">Welcome Section</h3>
      
      {loading.welcome ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading welcome section...</p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Welcome Title
            </label>
            <input
              type="text"
              value={welcomeSection?.welcomeTitle || ''}
              onChange={(e) => handleWelcomeSection({ 
                ...welcomeSection, 
                welcomeTitle: e.target.value 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter welcome title..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Welcome Text
            </label>
            <textarea
              value={welcomeSection?.welcomeText || ''}
              onChange={(e) => handleWelcomeSection({ 
                ...welcomeSection, 
                welcomeText: e.target.value 
              })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter welcome text..."
            />
          </div>
        </>
      )}
    </div>
  );

  // Column definitions for leadership team table
  const leadershipColumns = useMemo(() => [
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
      header: 'Photo',
      cell: ({ row }) => {
        const leader = row.original;
        return (
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
            <img
              src={getImageUrl(leader.image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(leader.name || 'Leader')}&size=48&background=0099cc&color=fff`}
              alt={leader.name || 'Leader'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(leader.name || 'Leader')}&size=48&background=0099cc&color=fff`;
              }}
            />
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <div className="font-medium text-gray-900">{getValue() || 'No name'}</div>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => getValue() || 'No title',
    },
    {
      accessorKey: 'subtitle',
      header: 'Subtitle',
      cell: ({ getValue }) => getValue() || 'No subtitle',
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => (
        <div className="max-w-xs truncate" title={getValue()}>
          {getValue() || 'No description'}
        </div>
      ),
    },
    {
      accessorKey: 'displayOrder',
      header: 'Display Order',
      cell: ({ getValue }) => getValue() || 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const leader = row.original;
        const index = leadershipTeam.findIndex(l => l.id === leader.id);
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingItem({ type: 'leaders', index, data: leader });
              }}
              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit size={14} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLeadershipTeam('delete', null, leader.id);
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
  ], [leadershipTeam]);

  const renderLeadersSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Leadership Team</h3>
        <button
          onClick={() => setEditingItem({ 
            type: 'leaders', 
            index: -1, 
            data: { name: '', title: '', subtitle: '', description: '' } 
          })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Leader
        </button>
      </div>

      {loading.leadership ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading leadership team...</p>
        </div>
      ) : leadershipTeam.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Leadership Team</h3>
          <p className="text-gray-500 mb-4">Add your first leader to get started</p>
          <button
            onClick={() => setEditingItem({ 
              type: 'leaders', 
              index: -1, 
              data: { name: '', title: '', subtitle: '', description: '' } 
            })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add First Leader
          </button>
        </div>
      ) : (
        <TableService
          columns={leadershipColumns}
          data={leadershipTeam}
          initialPageSize={10}
          loading={loading.leadership}
        />
      )}
    </div>
  );

  // Column definitions for statistics table
  const statisticsColumns = useMemo(() => [
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
      accessorKey: 'count',
      header: 'Count',
      cell: ({ getValue }) => (
        <div className="text-2xl font-bold text-blue-600">{getValue() || '0'}</div>
      ),
    },
    {
      accessorKey: 'label',
      header: 'Label',
      cell: ({ getValue }) => (
        <div className="font-medium text-gray-900">{getValue() || 'No label'}</div>
      ),
    },
    {
      accessorKey: 'displayOrder',
      header: 'Display Order',
      cell: ({ getValue }) => getValue() || 0,
    },
    {
      accessorKey: 'createdDate',
      header: 'Created Date',
      cell: ({ getValue }) => {
        const date = getValue();
        return date ? new Date(date).toLocaleDateString() : 'N/A';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const stat = row.original;
        const index = universityStatistics.findIndex(s => s.id === stat.id);
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingItem({ type: 'statistics', index, data: stat });
              }}
              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit size={14} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUniversityStatistics('delete', null, stat.id);
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
  ], [universityStatistics]);

  const renderStatisticsSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Statistics</h3>
        <button
          onClick={() => setEditingItem({ 
            type: 'statistics', 
            index: -1, 
            data: { count: '', label: '' } 
          })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Statistic
        </button>
      </div>

      {loading.statistics ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading statistics...</p>
        </div>
      ) : universityStatistics.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Statistics</h3>
          <p className="text-gray-500 mb-4">Add your first university statistic to get started</p>
          <button
            onClick={() => setEditingItem({ 
              type: 'statistics', 
              index: -1, 
              data: { count: '', label: '' } 
            })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add First Statistic
          </button>
        </div>
      ) : (
        <TableService
          columns={statisticsColumns}
          data={universityStatistics}
          initialPageSize={10}
          loading={loading.statistics}
        />
      )}
    </div>
  );

  const renderEventsSettings = () => <ProgramEventsSettings />;
  const renderLinksSettings = () => <ExternalLinksSettings />;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'carousel': return renderCarouselSettings();
      case 'announcements': return renderAnnouncementsSettings();
      case 'welcome': return renderWelcomeSettings();
      case 'leaders': return renderLeadersSettings();
      case 'statistics': return renderStatisticsSettings();
      case 'events': return renderEventsSettings();
      case 'links': return renderLinksSettings();
      default: return renderCarouselSettings();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Home Page Settings</h2>
        <div className="text-sm text-gray-500">
          Configure home page content and layout
        </div>
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
                // Refresh current section
                if (activeSection === 'carousel') fetchCarouselSlides();
                else if (activeSection === 'leaders') fetchLeadershipTeam();
                else if (activeSection === 'statistics') fetchUniversityStatistics();
                else if (activeSection === 'announcements') fetchBannerAnnouncements();
                else if (activeSection === 'welcome') fetchWelcomeSection();
              }}
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSection === section.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon size={16} />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {renderSectionContent()}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onSave={(data) => {
            if (editingItem.type === 'carousel') {
              const action = editingItem.index === -1 ? 'create' : 'update';
              const id = editingItem.index === -1 ? null : carouselSlides[editingItem.index].id;
              handleCarouselSlide(action, data, id);
            } else if (editingItem.type === 'leaders') {
              const action = editingItem.index === -1 ? 'create' : 'update';
              const id = editingItem.index === -1 ? null : leadershipTeam[editingItem.index].id;
              handleLeadershipTeam(action, data, id);
            } else if (editingItem.type === 'statistics') {
              const action = editingItem.index === -1 ? 'create' : 'update';
              const id = editingItem.index === -1 ? null : universityStatistics[editingItem.index].id;
              handleUniversityStatistics(action, data, id);
            } else if (editingItem.type === 'bannerAnnouncements') {
              const action = editingItem.index === -1 ? 'create' : 'update';
              const id = editingItem.index === -1 ? null : bannerAnnouncements[editingItem.index].id;
              handleBannerAnnouncements(action, data, id);
            }
            setEditingItem(null);
          }}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

// Edit Modal Component
const EditModal = ({ item, onSave, onCancel }) => {
  const [formData, setFormData] = useState(item.data);
  const [imagePreview, setImagePreview] = useState(() => {
    if (!item.data?.image) return null;
    
    // Check if it's already a full URL or base64
    if (item.data.image.startsWith('http://') || 
        item.data.image.startsWith('https://') || 
        item.data.image.startsWith('data:image/')) {
      return item.data.image;
    }
    
    // Use the proper base URL for files
    const baseURL = getBaseFileURL();
    const cleanPath = item.data.image.startsWith('/') ? item.data.image : `/${item.data.image}`;
    return `${baseURL}${cleanPath}`;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate carousel slide requirements
    if (item.type === 'carousel') {
      if (!formData.caption || formData.caption.trim() === '') {
        notification().error('Caption is required for carousel slides');
        return;
      }
      
      if (item.index === -1 && !formData.imageFile) {
        notification().error('Image is required for new carousel slides');
        return;
      }
    }
    
    onSave(formData);
  };

  const handleImageUpload = (e, field = 'image') => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        notification().error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notification().error('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target.result;
        setFormData({ 
          ...formData, 
          [field]: imageUrl,
          [`${field}File`]: file
        });
        setImagePreview(imageUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (field = 'image') => {
    const updatedFormData = { ...formData };
    updatedFormData[field] = '';
    delete updatedFormData[`${field}File`];
    setFormData(updatedFormData);
    setImagePreview(null);
  };

  const renderImageUpload = (field = 'image', label = 'Image') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      
      {(formData[field] || imagePreview) && (
        <div className="mb-3 relative inline-block">
          <img
            src={imagePreview || formData[field]}
            alt="Preview"
            className="w-32 h-32 object-fitcover rounded-lg border border-gray-300"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIGZpbGw9IiNEMUQ1REIiLz4KPHN2Zz4K';
            }}
          />
          <button
            type="button"
            onClick={() => removeImage(field)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <Upload size={16} />
          {formData[field] ? 'Change Image' : 'Upload Image'}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e, field)}
            className="hidden"
          />
        </label>
        <span className="text-sm text-gray-500">
          Max 5MB, JPG/PNG/GIF
          {item.type === 'carousel' && item.index === -1 && ' (Required)'}
        </span>
      </div>
    </div>
  );

  const renderFormFields = () => {
    switch (item.type) {
      case 'carousel':
        return (
          <>
            {renderImageUpload('image', 'Carousel Image *')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caption *
              </label>
              <input
                type="text"
                value={formData.caption || ''}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter image caption..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
              <input
                type="number"
                value={formData.displayOrder || 0}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
          </>
        );
      case 'bannerAnnouncements':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Announcement Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter announcement title..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <select
                  value={formData.language || 'Hindi & English'}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Hindi & English">Hindi & English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Archived">Archived</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>
          </>
        );
      case 'leaders':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter job title..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
              <input
                type="text"
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter subtitle or organization..."
              />
            </div>
            {renderImageUpload('image', 'Profile Photo')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter brief description..."
              />
            </div>
          </>
        );
      case 'statistics':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Count</label>
              <input
                type="text"
                value={formData.count || ''}
                onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 1000+"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
              <input
                type="text"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Students"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {item.index === -1 ? 'Add' : 'Edit'} {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </h3>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderFormFields()}
            
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                className="bg-blue-600 text-white py-3 px-8 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold cursor-pointer"
              >
                {item.index === -1 ? 'Create' : 'Update'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 text-gray-700 py-3 px-8 rounded-md hover:bg-gray-400 transition-colors font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HomeSettings;
