import { useState, useEffect } from 'react';
import { MapPin, Phone, Mail, Clock, Navigation, Save } from 'lucide-react';
import API from '@/services/API';
import { hasPermission } from '@/services/hasPermissionService';

const ContactSettings = () => {
  // Check permission
  const canUpdate = hasPermission('website_settings_contact.update');
  
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
            You don't have permission to access this section. Required permission: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">website_settings_contact.update</span>
          </p>
          <p className="text-gray-500 text-xs">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  // Initialize with empty template
  const emptySettings = {
    universityName: '',
    streetAddress: '',
    city: '',
    phone: '',
    email: '',
    helpline: '',
    helpdeskEmail: '',
    workingHours: '',
    mapUrl: '',
    railwayDistance: '',
    oldBusStandDistance: '',
    newBusStandDistance: ''
  };

  const [contactSettings, setContactSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Local state for immediate UI updates - initialize with empty settings
  const [localSettings, setLocalSettings] = useState(emptySettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState('address');

  // Fetch contact settings from API
  const fetchContactSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/ContactSettings');
      if (response.data.success && response.data.data) {
        const settings = Array.isArray(response.data.data) ? response.data.data[0] : response.data.data;
        setContactSettings(settings);
        setLocalSettings(settings);
        setHasChanges(false);
      } else {
        // No data found, use empty settings - no error message
        setContactSettings(null);
        setLocalSettings(emptySettings);
        setHasChanges(false);
      }
    } catch (err) {
      // Only show error for actual API failures, not for 404 (no data)
      if (err.response?.status !== 404) {
        setError('Failed to fetch contact settings. Please try again later.');
      }
      console.error('Error fetching contact settings:', err);
      // Still show UI with empty settings
      setLocalSettings(emptySettings);
    } finally {
      setLoading(false);
    }
  };

  // Update contact settings
  const updateContactSettings = async (newSettings) => {
    try {
      setError(null);
      
      let response;
      if (contactSettings?.id) {
        response = await API.put(`/ContactSettings/${contactSettings.id}`, { ...newSettings, id: contactSettings.id });
      } else {
        response = await API.post('/ContactSettings', newSettings);
      }
      
      if (response.data.success) {
        await fetchContactSettings(); // Refresh data
        setHasChanges(false);
      }
    } catch (err) {
      setError('Failed to update contact settings. Please try again later.');
      console.error('Error updating contact settings:', err);
    }
  };

  // Update local state when contactSettings from API changes
  useEffect(() => {
    if (contactSettings) {
      setLocalSettings(contactSettings);
      setHasChanges(false);
    }
  }, [contactSettings]);

  // Fetch data on component mount
  useEffect(() => {
    fetchContactSettings();
  }, []);

  const sections = [
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'contact', label: 'Contact Info', icon: Phone },
    { id: 'support', label: 'Help & Support', icon: Mail },
    { id: 'location', label: 'Location & Map', icon: Navigation }
  ];

  const handleInputChange = (field, value) => {
    const updatedSettings = { ...localSettings, [field]: value };
    setLocalSettings(updatedSettings);
    setHasChanges(true);
  };

  // Function to extract URL from iframe HTML or return the URL as-is
  const extractMapUrl = (mapUrlOrHtml) => {
    if (!mapUrlOrHtml) return '';
    
    // If it's already a URL, return it
    if (mapUrlOrHtml.startsWith('https://www.google.com/maps/embed')) {
      return mapUrlOrHtml;
    }
    
    // If it's iframe HTML, extract the src attribute
    if (mapUrlOrHtml.includes('<iframe') && mapUrlOrHtml.includes('src=')) {
      const srcMatch = mapUrlOrHtml.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1]) {
        return srcMatch[1];
      }
    }
    
    return mapUrlOrHtml;
  };

  // Function to check if URL is valid embed URL
  const isValidEmbedUrl = (url) => {
    const cleanUrl = extractMapUrl(url);
    return cleanUrl.includes('maps/embed');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066cc] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading contact settings...</p>
      </div>
    );
  }

  const renderAddressSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Address Information</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            University Name
          </label>
          <input
            type="text"
            value={localSettings?.universityName || ''}
            onChange={(e) => handleInputChange('universityName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Street Address
          </label>
          <input
            type="text"
            value={localSettings?.streetAddress || ''}
            onChange={(e) => handleInputChange('streetAddress', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City, State, PIN
          </label>
          <input
            type="text"
            value={localSettings?.city || ''}
            onChange={(e) => handleInputChange('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">Address Preview</h4>
        <div className="text-sm text-gray-600">
          <p className="font-semibold text-blue-600">{localSettings?.universityName || ''}</p>
          <p>{localSettings?.streetAddress || ''}</p>
          <p>{localSettings?.city || ''}</p>
        </div>
      </div>
    </div>
  );

  const renderContactSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Contact Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone size={16} className="inline mr-1" />
            Main Phone Number
          </label>
          <input
            type="text"
            value={localSettings?.phone || ''}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail size={16} className="inline mr-1" />
            Main Email Address
          </label>
          <input
            type="email"
            value={localSettings?.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );

  const renderSupportSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Help & Support</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Technical Helpline
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
            Helpdesk Email
          </label>
          <input
            type="email"
            value={localSettings?.helpdeskEmail || ''}
            onChange={(e) => handleInputChange('helpdeskEmail', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Clock size={16} className="inline mr-1" />
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

  const renderLocationSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Location & Transportation</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Maps Embed URL
        </label>
        <textarea
          value={localSettings?.mapUrl || ''}
          onChange={(e) => handleInputChange('mapUrl', e.target.value)}
          rows={3}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            localSettings?.mapUrl && !isValidEmbedUrl(localSettings.mapUrl) 
              ? 'border-red-300 bg-red-50' 
              : 'border-gray-300'
          }`}
          placeholder="https://www.google.com/maps/embed?pb=... OR paste the entire iframe code"
        />
        
        {/* Show extracted URL if iframe was pasted */}
        {localSettings?.mapUrl && localSettings.mapUrl.includes('<iframe') && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">✅ Iframe detected</p>
            <p className="text-xs text-blue-600 mt-1">
              <strong>Extracted URL:</strong> {extractMapUrl(localSettings.mapUrl)}
            </p>
            <button
              onClick={() => handleInputChange('mapUrl', extractMapUrl(localSettings.mapUrl))}
              className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Use extracted URL only
            </button>
          </div>
        )}
        
        {/* URL Validation Message */}
        {localSettings?.mapUrl && !isValidEmbedUrl(localSettings.mapUrl) && !localSettings.mapUrl.includes('<iframe') && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">⚠️ Invalid Map URL</p>
            <p className="text-xs text-red-600 mt-1">
              Please use a Google Maps <strong>embed</strong> URL, not a regular Google Maps URL.
            </p>
          </div>
        )}
        
        {/* Instructions */}
        <div className="mt-3 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="text-sm font-medium text-blue-800 mb-2">How to add Google Maps:</h5>
          <div className="text-xs text-blue-700 space-y-3">
            <div>
              <p className="font-medium mb-1">Option 1: Paste the embed URL</p>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Go to <a href="https://maps.app.goo.gl/ziCyW1kneRcyFG839" target="_blank" rel="noopener noreferrer" className="underline">Google Maps</a></li>
                <li>Search for your location</li>
                <li>Click "Share" button</li>
                <li>Click "Embed a map" tab</li>
                <li>Copy just the URL from the iframe src attribute</li>
              </ol>
            </div>
            <div>
              <p className="font-medium mb-1">Option 2: Paste the entire iframe code</p>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Follow steps 1-4 above</li>
                <li>Copy the entire iframe code and paste it here</li>
                <li>The URL will be automatically extracted</li>
              </ol>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-3 font-medium">
            Both formats work: URL only or full iframe code
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-700">Distance Information</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Railway Station Distance
            </label>
            <input
              type="text"
              value={localSettings?.railwayDistance || ''}
              onChange={(e) => handleInputChange('railwayDistance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Old Bus Stand Distance
            </label>
            <input
              type="text"
              value={localSettings?.oldBusStandDistance || ''}
              onChange={(e) => handleInputChange('oldBusStandDistance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Bus Stand Distance
            </label>
            <input
              type="text"
              value={localSettings?.newBusStandDistance || ''}
              onChange={(e) => handleInputChange('newBusStandDistance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Map Preview */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">Map Preview</h4>
        {localSettings?.mapUrl ? (
          isValidEmbedUrl(localSettings.mapUrl) ? (
            <div className="w-full h-64 sm:h-80 md:h-96 bg-white rounded border overflow-hidden">
              <iframe
                src={extractMapUrl(localSettings.mapUrl)}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="University Location"
                className="rounded"
              ></iframe>
            </div>
          ) : (
            <div className="w-full h-64 sm:h-80 md:h-96 bg-red-50 border border-red-200 rounded flex items-center justify-center">
              <div className="text-center p-4 max-w-md mx-auto">
                <p className="text-red-600 font-medium mb-2">❌ Cannot display map</p>
                <p className="text-sm text-red-500 mb-2">
                  Please use a Google Maps embed URL or paste the iframe code from Google Maps.
                </p>
                <p className="text-xs text-red-400">
                  Embed URLs start with: https://www.google.com/maps/embed?pb=...
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="w-full h-64 sm:h-80 md:h-96 bg-gray-200 rounded flex items-center justify-center">
            <div className="text-center p-4 max-w-md mx-auto">
              <p className="text-gray-500 mb-2">📍 No map URL provided</p>
              <p className="text-xs text-gray-400">
                Add a Google Maps embed URL or paste iframe code to show the location preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'address':
        return renderAddressSettings();
      case 'contact':
        return renderContactSettings();
      case 'support':
        return renderSupportSettings();
      case 'location':
        return renderLocationSettings();
      default:
        return renderAddressSettings();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Contact Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure contact information and location details
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={() => updateContactSettings(localSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Save size={16} />
            Save Changes
          </button>
        )}
      </div>

      {/* Error State - Only show if there's an actual error */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-yellow-700">{error}</p>
            <button 
              onClick={fetchContactSettings}
              className="ml-auto px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none justify-center sm:justify-start ${
                activeSection === section.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{section.label}</span>
              <span className="sm:hidden">{section.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        {renderSectionContent()}
      </div>

      {/* Contact Preview Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information Preview</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Address Card Preview */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center mb-3">
              <MapPin size={20} className="text-blue-600 mr-2" />
              <h4 className="font-semibold text-blue-800">Address</h4>
            </div>
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-blue-600">{localSettings?.universityName || ''}</p>
              <p>{localSettings?.streetAddress || ''}</p>
              <p>{localSettings?.city || ''}</p>
            </div>
          </div>

          {/* Contact Info Preview */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center mb-3">
              <Phone size={20} className="text-green-600 mr-2" />
              <h4 className="font-semibold text-green-800">Contact Info</h4>
            </div>
            <div className="text-sm space-y-2">
              <div className="flex items-center">
                <span className="font-medium text-green-700 min-w-[50px]">Phone:</span>
                <span className="text-gray-700">{localSettings?.phone || ''}</span>
              </div>
              <div className="flex items-center">
                <span className="font-medium text-green-700 min-w-[50px]">Email:</span>
                <span className="text-gray-700">{localSettings?.email || ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactSettings;
