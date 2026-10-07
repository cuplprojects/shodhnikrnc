import { useState, useEffect } from 'react';
import { Sparkles, Info } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';

const AboutDoR = () => {
  const [welcomeData, setWelcomeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch welcome sections from API
  const fetchWelcomeSections = async () => {
    try {
      setLoading(true);
      setError(null);

      let sections = [];

      try {
        // Try to fetch all welcome sections first (if endpoint exists)
        const response = await API.get('/WelcomeSections');
        if (response.data.success && Array.isArray(response.data.data)) {
          sections = response.data.data.filter(item => item.isActive);
        } else if (response.data.success && response.data.data) {
          sections = [response.data.data].filter(item => item.isActive);
        }
      } catch (getAllError) {
        console.log('GET all endpoint not available, trying range fetch...');
        // Fallback: fetch multiple welcome sections by ID range
        const promises = [];
        for (let id = 1; id <= 20; id++) {
          promises.push(
            API.get(`/WelcomeSections/${id}`)
              .then(response => {
                if (response.data.success && response.data.data && response.data.data.isActive) {
                  return response.data.data;
                }
                return null;
              })
              .catch(() => null)
          );
        }
        const results = await Promise.all(promises);
        sections = results.filter(item => item !== null);
      }

      setWelcomeData(sections);
    } catch (err) {
      setError('Failed to fetch welcome sections. Please try again later.');
      console.error('Error fetching welcome sections:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchWelcomeSections();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        {/* Page Hero Header */}
        <div className="relative text-center mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 text-[#0066cc] border border-blue-200/60 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
            Directorate of Research
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            About <span className="text-[#0066cc]">DoR</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Catalyzing advanced academic inquiry, fostering collaborative research, and empowering scholars across diverse disciplines.
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-[#0066cc] to-cyan-500 rounded-full mx-auto mt-6"></div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-200 border-t-[#0066cc] mx-auto mb-4"></div>
              <p className="text-slate-600 text-base font-medium">Loading content...</p>
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
                onClick={fetchWelcomeSections}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Content - Open Editorial Layout (No enclosing card/box div) */}
        {!loading && !error && (
          <div className="space-y-16">
            {welcomeData.length > 0 ? (
              welcomeData.map((section, index) => (
                <article key={section.id || index} className="space-y-6">
                  {section.welcomeTitle && section.welcomeTitle !== 'NA' && (
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {section.welcomeTitle}
                      </h2>
                      <div className="w-14 h-1 bg-gradient-to-r from-[#0066cc] to-cyan-500 rounded-full mt-3"></div>
                    </div>
                  )}

                  <div className="text-slate-700 text-lg leading-relaxed text-justify space-y-4 font-normal">
                    {section.welcomeText ? (
                      <div
                        className="prose prose-slate max-w-none text-slate-700 text-lg leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: section.welcomeText }}
                      />
                    ) : (
                      <p className="text-slate-400 italic">No content available.</p>
                    )}
                  </div>

                  {index < welcomeData.length - 1 && (
                    <div className="pt-8 border-b border-slate-200/80"></div>
                  )}
                </article>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-5">
                  <Info className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Content Available</h3>
                <p className="text-slate-500 text-base max-w-md mx-auto">
                  About Directorate of Research information will appear here once configured.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AboutDoR;
