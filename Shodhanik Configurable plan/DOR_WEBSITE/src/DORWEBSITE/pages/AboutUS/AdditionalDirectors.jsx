import { useState, useEffect } from 'react';
import { User, Mail, Phone, Users, Sparkles, Search } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const AdditionalDirectors = () => {
  const [directors, setDirectors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function for image URLs
  const getImageUrl = (imagePath, fallback = '') => {
    if (!imagePath) return fallback;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    if (imagePath.startsWith('/')) return imagePath;
    if (imagePath.startsWith('data:image/')) return imagePath;
    const baseURL = getBaseFileURL();
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseURL}${cleanPath}`;
  };

  useEffect(() => {
    fetchAdditionalDirectors();
  }, []);

  const fetchAdditionalDirectors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/AdditionalDirectors');
      setDirectors(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching Additional Directors:', err);
      setError('Failed to load Additional Directors. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDirectors = directors.filter((director) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = director.name?.toLowerCase().includes(query);
    const designationMatch = director.designation?.toLowerCase().includes(query);
    const emailMatch = director.email?.toLowerCase().includes(query);
    return nameMatch || designationMatch || emailMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        {/* Page Hero Header */}
        <div className="relative text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 text-[#0066cc] border border-blue-200/60 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
            Leadership &amp; Administration
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Additional <span className="text-[#0066cc]">Directors</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Distinguished academic leaders driving specialized research collaborations, quality governance, and institutional innovation.
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-[#0066cc] to-cyan-500 rounded-full mx-auto mt-6"></div>
        </div>

        {/* Search Bar */}
        {!loading && !error && directors.length > 3 && (
          <div className="max-w-md mx-auto mb-10">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, designation, or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] shadow-xs transition-all"
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-200 border-t-[#0066cc] mx-auto mb-4"></div>
              <p className="text-slate-600 text-base font-medium">Loading Additional Directors...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6 mb-12 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
              </div>
              <button
                onClick={fetchAdditionalDirectors}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && directors.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-5">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Additional Directors Available</h3>
            <p className="text-slate-500 text-base max-w-md mx-auto">
              Additional Directors will be listed here once added to the system.
            </p>
          </div>
        )}

        {/* Directors List View (Faculty Directory Roster Layout) */}
        {!loading && !error && directors.length > 0 && (
          <div className="divide-y divide-slate-200">
            {filteredDirectors.length > 0 ? (
              filteredDirectors.map((director) => (
                <div
                  key={director.id}
                  className="py-6 sm:py-8 px-4 sm:px-6 rounded-2xl transition-all duration-200 hover:bg-white hover:shadow-xs flex flex-col md:flex-row items-center md:items-start lg:items-center justify-between gap-6"
                >
                  {/* Left: Avatar & Identity */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-5 text-center sm:text-left flex-1">
                    {/* Portrait Avatar */}
                    <div className="flex-shrink-0">
                      {director.image ? (
                        <img
                          src={getImageUrl(director.image)}
                          alt={director.name || 'Additional Director'}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-xs"
                        />
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                    </div>

                    {/* Information */}
                    <div className="flex-1">
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {director.name || 'Name Not Available'}
                      </h3>

                      <div className="inline-flex items-center px-3 py-1 bg-blue-50 text-[#0066cc] border border-blue-200/60 rounded-full text-xs font-bold uppercase tracking-wider mt-2">
                        {director.designation || 'Additional Director'}
                      </div>

                      <p className="text-xs text-slate-500 mt-2 font-medium">
                        Directorate of Research, CCS University
                      </p>
                    </div>
                  </div>

                  {/* Right: Quick Contact Channels */}
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 flex-shrink-0 w-full md:w-auto">
                    {director.email && (
                      <a
                        href={`mailto:${director.email}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 text-sm font-medium text-slate-700 hover:text-[#0066cc] hover:border-blue-300 hover:bg-blue-50/40 shadow-xs transition-all duration-200"
                        title={director.email}
                      >
                        <Mail className="w-4 h-4 text-[#0066cc]" />
                        <span>{director.email}</span>
                      </a>
                    )}

                    {director.contactNo && (
                      <a
                        href={`tel:${director.contactNo}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 text-sm font-medium text-slate-700 hover:text-[#0066cc] hover:border-blue-300 hover:bg-blue-50/40 shadow-xs transition-all duration-200"
                        title={director.contactNo}
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span>{director.contactNo}</span>
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16">
                <p className="text-slate-500 text-base">No additional directors match your search.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AdditionalDirectors;