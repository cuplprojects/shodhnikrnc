import { useState, useEffect } from 'react';
import { Upload, Image, Palette, Type, Phone, Mail, X, Save } from 'lucide-react';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';
import { useHeaderSettings } from '@/hooks/useHeaderSettings';
import { hasPermission } from '@/services/hasPermissionService';

const HeaderSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_header.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  const { headerSettings, loading, error, refetch } = useHeaderSettings(1, { enableCache: false });
  const [localSettings, setLocalSettings] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');
  
  // Image error states
  const [logoError, setLogoError] = useState(false);
  const [rmsLogoError, setRmsLogoError] = useState(false);

  // Initialize local settings when header settings load
  useEffect(() => {
    if (headerSettings) {
      const nestedSettings = {
        ...headerSettings,
        universityName: {
          hindi: headerSettings.universityNameHindi || '',
          english: headerSettings.universityNameEnglish || ''
        },
        universityFullName: {
          hindi: headerSettings.universityFullNameHindi || '',
          english: headerSettings.universityFullNameEnglish || ''
        }
      };
      setLocalSettings(nestedSettings);
      setHasChanges(false);
    } else if (!loading && !headerSettings) {
      // No data found - create default empty settings
      const defaultSettings = {
        universityName: { hindi: '', english: '' },
        universityFullName: { hindi: '', english: '' },
        approvalText: '',
        websiteTitle: '',
        helpline: '',
        email: '',
        workingHours: '',
        topBarColor: '#0066cc',
        navBarColor: '#003366',
        logo: '',
        rmsLogo: ''
      };
      setLocalSettings(defaultSettings);
    }
  }, [headerSettings, loading]);

  // Update header settings
  const updateHeaderSettings = async (newSettings) => {
    try {
      // Convert nested structure to FormData for API
      const formData = new FormData();
      
      // Add ID if exists
      if (headerSettings?.id) {
        formData.append('Id', headerSettings.id);
      }
      
      // Add text fields
      formData.append('UniversityNameHindi', newSettings.universityName?.hindi || '');
      formData.append('UniversityNameEnglish', newSettings.universityName?.english || '');
      formData.append('UniversityFullNameHindi', newSettings.universityFullName?.hindi || '');
      formData.append('UniversityFullNameEnglish', newSettings.universityFullName?.english || '');
      formData.append('ApprovalText', newSettings.approvalText || '');
      formData.append('WebsiteTitle', newSettings.websiteTitle || '');
      formData.append('Helpline', newSettings.helpline || '');
      formData.append('Email', newSettings.email || '');
      formData.append('WorkingHours', newSettings.workingHours || '');
      formData.append('TopBarColor', newSettings.topBarColor || '#0066cc');
      formData.append('NavBarColor', newSettings.navBarColor || '#003366');
      
      // Add file fields if they exist
      if (newSettings.logoFile) formData.append('LogoFile', newSettings.logoFile);
      if (newSettings.rmsLogoFile) formData.append('RmsLogoFile', newSettings.rmsLogoFile);

      let response;
      if (headerSettings?.id) {
        // Update existing
        response = await API.put(`/HeaderSettings/${headerSettings.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Create new
        response = await API.post('/HeaderSettings', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      if (response.data.success) {
        // Refresh data from server
        await refetch();
        setHasChanges(false);
        notification().success('Header settings updated successfully!');
      }
    } catch (err) {
      notification().error('Failed to update header settings. Please try again later.');
      console.error('Error updating header settings:', err);
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    let updatedSettings = { ...localSettings };
    
    // Handle nested fields
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updatedSettings = {
        ...localSettings,
        [parent]: {
          ...(localSettings?.[parent] || {}),
          [child]: value
        }
      };
    } else {
      // Handle flat fields
      updatedSettings[field] = value;
    }
    
    setLocalSettings(updatedSettings);
    setHasChanges(true);
  };

  // Handle image upload
  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        notification().error('Please select an image file');
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        notification().error('Image size should be less than 5MB');
        return;
      }

      // Store the file for upload and create preview URL
      const previewUrl = URL.createObjectURL(file);
      
      // Update settings with file and preview
      const fileField = field === 'logo' ? 'logoFile' : 'rmsLogoFile';
      const updatedSettings = {
        ...localSettings,
        [field]: previewUrl, // For preview
        [fileField]: file    // For upload
      };
      
      // Clean up any previous blob URLs to prevent memory leaks
      if (localSettings?.[field] && localSettings[field].startsWith('blob:')) {
        URL.revokeObjectURL(localSettings[field]);
      }
      
      setLocalSettings(updatedSettings);
      setHasChanges(true);
    }
  };

  // Remove image
  const removeImage = (field) => {
    // Clean up blob URL if it exists
    if (localSettings?.[field] && localSettings[field].startsWith('blob:')) {
      URL.revokeObjectURL(localSettings[field]);
    }
    
    // Remove both the image URL and the file
    const fileField = field === 'logo' ? 'logoFile' : 'rmsLogoFile';
    const updatedSettings = {
      ...localSettings,
      [field]: '',
      [fileField]: null
    };
    
    setLocalSettings(updatedSettings);
    setHasChanges(true);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // Check if it's already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Check if it's base64 data
    if (imagePath.startsWith('data:image/')) {
      return imagePath;
    }
    
    // Check if it's a blob URL (preview)
    if (imagePath.startsWith('blob:')) {
      return imagePath;
    }
    
    // Use the proper base URL for files
    const baseURL = getBaseFileURL();
    
    // Ensure the path starts with /
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    
    // Add cache-busting query parameter with timestamp
    const timestamp = new Date().getTime();
    return `${baseURL}${cleanPath}?t=${timestamp}`;
  };

  // Handle image errors
  const handleImageError = (e, field) => {
    const isLogo = field === 'logo';
    const setErrorState = isLogo ? setLogoError : setRmsLogoError;
    
    setErrorState(true);
    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00MCA0MEw1MCAzMEw2MCA0MEw1MCA1MEw0MCA0MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
    e.target.alt = 'Failed to load image';
  };

  // Handle image load success
  const handleImageLoad = (field) => {
    const isLogo = field === 'logo';
    const setErrorState = isLogo ? setLogoError : setRmsLogoError;
    setErrorState(false);
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066cc] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading header settings...</p>
      </div>
    );
  }

  // Error State - only show for actual errors, not empty data
  if (error && !localSettings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-700">{error}</p>
          <button 
            onClick={refetch}
            className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: Type },
    { id: 'contact', label: 'Contact Info', icon: Phone },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'colors', label: 'Colors', icon: Palette }
  ];

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">University Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            University Name (Hindi)
          </label>
          <input
            type="text"
            value={localSettings?.universityName?.hindi || ''}
            onChange={(e) => handleInputChange('universityName.hindi', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            University Name (English)
          </label>
          <input
            type="text"
            value={localSettings?.universityName?.english || ''}
            onChange={(e) => handleInputChange('universityName.english', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full University Name (Hindi)
          </label>
          <input
            type="text"
            value={localSettings?.universityFullName?.hindi || ''}
            onChange={(e) => handleInputChange('universityFullName.hindi', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full University Name (English)
          </label>
          <input
            type="text"
            value={localSettings?.universityFullName?.english || ''}
            onChange={(e) => handleInputChange('universityFullName.english', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Approval Text
        </label>
        <input
          type="text"
          value={localSettings?.approvalText || ''}
          onChange={(e) => handleInputChange('approvalText', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Website Title
        </label>
        <input
          type="text"
          value={localSettings?.websiteTitle || ''}
          onChange={(e) => handleInputChange('websiteTitle', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderContactInfo = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Contact Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone size={16} className="inline mr-1" />
            Helpline Number
          </label>
          <input
            type="text"
            value={localSettings?.helpline || ''}
            onChange={(e) => handleInputChange('helpline', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail size={16} className="inline mr-1" />
            Email Address
          </label>
          <input
            type="email"
            value={localSettings?.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Working Hours
        </label>
        <input
          type="text"
          value={localSettings?.workingHours || ''}
          onChange={(e) => handleInputChange('workingHours', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderImageUpload = (field, label, altText) => {
    const isLogo = field === 'logo';
    const imageError = isLogo ? logoError : rmsLogoError;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        
        {/* Current Image Preview */}
        {localSettings?.[field] && (
          <div className="mb-3 relative inline-block">
            <img
              key={`${field}-${localSettings[field]}`}
              src={getImageUrl(localSettings[field])}
              alt={altText}
              className="h-20 w-20 object-contain border border-gray-300 rounded-lg bg-white p-2"
              onLoad={() => handleImageLoad(field)}
              onError={(e) => handleImageError(e, field)}
            />
            {imageError && (
              <div className="absolute bottom-0 left-0 right-0 bg-red-100 text-red-600 text-xs p-1 rounded-b-lg">
                Image failed to load
              </div>
            )}
            <button
              type="button"
              onClick={() => removeImage(field)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload size={16} />
            {localSettings?.[field] ? 'Change Logo' : 'Upload Logo'}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, field)}
              className="hidden"
            />
          </label>
          <span className="text-sm text-gray-500">
            Max 5MB, JPG/PNG/GIF
          </span>
        </div>
      </div>
    );
  };

  const renderBranding = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Logos & Images</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderImageUpload('logo', 'University Logo', 'University Logo')}
        {renderImageUpload('rmsLogo', 'Shodhanik Logo', 'Shodhanik Logo')}
      </div>
    </div>
  );

  const renderColors = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Color Scheme</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Top Bar Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localSettings?.topBarColor || '#0066cc'}
              onChange={(e) => handleInputChange('topBarColor', e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={localSettings?.topBarColor || '#0066cc'}
              onChange={(e) => handleInputChange('topBarColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Navigation Bar Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localSettings?.navBarColor || '#003366'}
              onChange={(e) => handleInputChange('navBarColor', e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={localSettings?.navBarColor || '#003366'}
              onChange={(e) => handleInputChange('navBarColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">Preview</h4>
        <div className="space-y-2">
          <div 
            className="h-8 rounded flex items-center px-3 text-white text-sm"
            style={{ backgroundColor: localSettings?.topBarColor || '#0066cc' }}
          >
            Top Bar Preview
          </div>
          <div 
            className="h-12 rounded flex items-center px-3 text-white text-sm"
            style={{ backgroundColor: localSettings?.navBarColor || '#003366' }}
          >
            Navigation Bar Preview
          </div>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'basic':
        return renderBasicInfo();
      case 'contact':
        return renderContactInfo();
      case 'branding':
        return renderBranding();
      case 'colors':
        return renderColors();
      default:
        return renderBasicInfo();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Header Settings</h2>
        <div className="flex items-center gap-4">
          {hasChanges && (
            <button
              onClick={() => updateHeaderSettings(localSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save Changes
            </button>
          )}
          <div className="text-sm text-gray-500">
            Configure header appearance and content
          </div>
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
              onClick={refetch}
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
    </div>
  );
};

export default HeaderSettings;
