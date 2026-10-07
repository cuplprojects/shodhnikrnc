import { useState, useEffect } from 'react';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const ExternalLinksSection = () => {
  const [externalLinks, setExternalLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch external links from API
  const fetchExternalLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/ExternalLinks/active');
      if (response.data.success && response.data.data) {
        setExternalLinks(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching external links:', err);
      notification().error('Failed to fetch external links');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchExternalLinks();
  }, []);

  // Filter active links and sort by display order
  const activeLinks = (externalLinks || [])
    .filter(link => link.status === 'Active')
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });

  // Don't render if no active links
  if (!loading && (!activeLinks || activeLinks.length === 0)) {
    return null;
  }

  return (
    <section className="py-4 md:py-6 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-center mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-700">
            External Links
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow-none border-0 border-none p-4">
          {loading ? (
            <div className="w-full text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600">Loading external links...</p>
            </div>
          ) : error ? (
            <div className="w-full text-center py-6">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {activeLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-blue-600 hover:text-white rounded-full px-3.5 py-1.5 text-xs md:text-sm text-gray-700 transition-all duration-200 border-0 border-none shadow-none outline-none"
                title={link.category ? `${link.name} (${link.category})` : link.name}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {link.name}
              </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ExternalLinksSection;
