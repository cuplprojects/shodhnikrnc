import { useState, useEffect } from 'react';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const ProgramEventsSection = () => {
  const [programEvents, setProgramEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);

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
      
      const response = await API.get('/ProgramEvents/active');
      if (response.data.success && response.data.data) {
        setProgramEvents(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching program events:', err);
      setError('Failed to fetch program events');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchProgramEvents();
  }, []);

  // Filter active events and sort by display order
  const activeEvents = (programEvents || [])
    .filter(event => event.status === 'Active' || event.status === 'string')
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Don't render section if no active events and not loading
  if (!loading && (!activeEvents || activeEvents.length === 0)) {
    return null;
  }

  const toggleExpand = (eventId) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // Check if it's already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Check if it's a local static file
    if (imagePath.startsWith('/')) {
      return imagePath;
    }
    
    // Check if it's base64 data
    if (imagePath.startsWith('data:image/')) {
      return imagePath;
    }
    
    // Use the proper base URL for uploaded files
    const baseURL = getBaseFileURL();
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseURL}${cleanPath}`;
  };

  return (
    <section className="py-6 md:py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 cursor-pointer">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-1xl md:text-2xl font-bold text-gray-700">
            Programs / Events
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow-none border-0 border-none p-4 md:p-6">
          {loading ? (
            <div className="w-full text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading program events...</p>
            </div>
          ) : error ? (
            <div className="w-full text-center py-6">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {activeEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 group border-0 border-none"
              >
                {/* Event Image */}
                <div className="relative h-48 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {event.image ? (
                    <img
                      src={getImageUrl(event.image)}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Date Badge */}
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                    <svg className="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(event.date)}
                  </div>
                  {/* Overlay on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Event Content */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors duration-200">
                    {event.title}
                  </h3>
                  <p className={`text-sm text-gray-600 leading-relaxed mb-4 ${expandedEvent === event.id ? '' : 'line-clamp-3'}`}>
                    {event.description}
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm hover:text-blue-700 transition-colors duration-200"
                    >
                      {expandedEvent === event.id ? 'Show less' : 'Read more'}
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${expandedEvent === event.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ProgramEventsSection;
