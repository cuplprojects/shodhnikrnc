import { useState, useEffect } from 'react';
import { Eye, Target, Compass, Quote, Sparkles, CheckCircle2, Award, ChevronRight } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const VisionMission = () => {
  const [visionMissions, setVisionMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllVisionMissions();
  }, []);

  const fetchAllVisionMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/VisionMissions');
      setVisionMissions(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching Vision & Mission:', err);
      setError('Failed to load Vision & Mission content. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Helper for image URLs
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    if (imagePath.startsWith('/')) return imagePath;
    if (imagePath.startsWith('data:image/')) return imagePath;
    const baseURL = getBaseFileURL();
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseURL}${cleanPath}`;
  };

  // Parse objectives content into distinct points for clean list presentation
  const parseObjectivePoints = (content) => {
    if (!content) return [];

    // Check if HTML contains <li> items
    if (content.includes('<li') && typeof window !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const lis = Array.from(doc.querySelectorAll('li'));
        if (lis.length > 0) {
          return lis.map(li => li.innerHTML.trim()).filter(Boolean);
        }
      } catch (e) {
        console.error('Error parsing list items:', e);
      }
    }

    // Check if HTML contains multiple <p> tags
    if (content.includes('<p') && typeof window !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const ps = Array.from(doc.querySelectorAll('p'));
        const items = ps.map(p => p.innerHTML.trim()).filter(Boolean);
        if (items.length > 1) {
          return items;
        }
      } catch (e) {
        console.error('Error parsing paragraph items:', e);
      }
    }

    // Clean plain text and split into sentences starting with "To ", numbers, or bullets
    const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const points = cleanText
      .split(/(?=(?:To\s+[A-Za-z]+|[0-9]+\.\s+|•|\-))/g)
      .map(p => p.trim())
      .filter(p => p.length > 15);

    if (points.length > 1) {
      return points;
    }

    return [cleanText || content];
  };

  const visionItems = visionMissions.filter(item => item.type?.toLowerCase() === 'vision');
  const missionItems = visionMissions.filter(item => item.type?.toLowerCase() === 'mission');
  const objectiveItems = visionMissions.filter(item => item.type?.toLowerCase() === 'objective');

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        {/* Page Hero Header */}
        <div className="relative text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 text-[#0066cc] border border-blue-200/60 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
            Directorate of Research
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Vision, Mission <span className="text-[#0066cc]">&amp; Objectives</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            The foundational ethos and strategic directives guiding our pursuit of academic distinction, groundbreaking research, and societal transformation.
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
                onClick={fetchAllVisionMissions}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && visionMissions.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-5">
              <Compass className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Content Available</h3>
            <p className="text-slate-500 text-base max-w-md mx-auto">
              Vision, Mission, and Objectives content will be displayed here once configured in the system.
            </p>
          </div>
        )}

        {/* Content Section */}
        {!loading && !error && (
          <div className="space-y-16 lg:space-y-24">
            {/* Vision Section - Editorial Horizontal Split */}
            {visionItems.length > 0 && (
              <div className="space-y-12">
                {visionItems.map((item) => (
                  <section
                    key={item.id}
                    className="relative bg-white rounded-3xl p-8 sm:p-12 lg:p-14 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden"
                  >
                    {/* Ambient subtle light glow */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                      {/* Left Column: Narrative Content */}
                      <div className="lg:col-span-7">
                        {/* Section Tag */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-50 text-[#0066cc] border border-blue-200/80 mb-5">
                          <Eye className="w-4 h-4 text-[#0066cc]" />
                          <span>Our Vision</span>
                        </div>

                        {/* Title / Sanskrit Motto */}
                        {item.title && (
                          <div className="mb-6">
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight font-serif">
                              {item.title}
                            </h2>
                            <div className="w-16 h-1 bg-blue-500 rounded-full mt-3"></div>
                          </div>
                        )}

                        {/* Statement / Manifesto */}
                        <div className="relative mt-6">
                          <Quote className="w-10 h-10 text-blue-200/70 mb-2 transform -scale-x-100" />
                          <div
                            className="text-slate-700 text-lg sm:text-xl font-normal leading-relaxed italic border-l-4 border-[#0066cc] pl-5 py-2"
                            dangerouslySetInnerHTML={{
                              __html: item.content || 'Vision statement will appear here.'
                            }}
                          />
                        </div>
                      </div>

                      {/* Right Column: Visual Graphic / Illustration */}
                      {item.image && (
                        <div className="lg:col-span-5 flex justify-center items-center">
                          <img
                            src={getImageUrl(item.image)}
                            alt={item.title || 'Our Vision'}
                            className="max-h-80 w-auto object-contain transition-transform duration-300 hover:scale-105"
                          />
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Mission Section - Alternating Horizontal Split (Image on Left, Content on Right) */}
            {missionItems.length > 0 && (
              <div className="space-y-12">
                {missionItems.map((item) => (
                  <section
                    key={item.id}
                    className="relative bg-white rounded-3xl p-8 sm:p-12 lg:p-14 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden"
                  >
                    {/* Ambient subtle light glow */}
                    <div className="absolute top-0 left-0 -ml-20 -mt-20 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                      {/* Left Column (Desktop): Visual Graphic / Illustration */}
                      {item.image && (
                        <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center items-center">
                          <img
                            src={getImageUrl(item.image)}
                            alt={item.title || 'Our Mission'}
                            className="max-h-80 w-auto object-contain transition-transform duration-300 hover:scale-105"
                          />
                        </div>
                      )}

                      {/* Right Column: Narrative Content */}
                      <div className={`order-1 lg:order-2 ${item.image ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
                        {/* Section Tag */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-purple-50 text-purple-700 border border-purple-200/80 mb-5">
                          <Compass className="w-4 h-4 text-purple-600" />
                          <span>Our Mission</span>
                        </div>

                        {/* Title / Sanskrit Motto */}
                        {item.title && (
                          <div className="mb-6">
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight font-serif">
                              {item.title}
                            </h2>
                            <div className="w-16 h-1 bg-purple-500 rounded-full mt-3"></div>
                          </div>
                        )}

                        {/* Statement / Manifesto */}
                        <div className="relative mt-6">
                          <Quote className="w-10 h-10 text-purple-200/70 mb-2 transform -scale-x-100" />
                          <div
                            className="text-slate-700 text-lg sm:text-xl font-normal leading-relaxed italic border-l-4 border-purple-500 pl-5 py-2"
                            dangerouslySetInnerHTML={{
                              __html: item.content || 'Mission statement will appear here.'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Objectives Section - Strategic Action Pillars */}
            {objectiveItems.length > 0 && (
              <section className="relative">
                {/* Section Title */}
                <div className="text-center mb-12 sm:mb-16">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-200/80 mb-4">
                    <Target className="w-4 h-4 text-teal-600" />
                    <span>Strategic Directives</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    Our Core Objectives
                  </h2>
                  <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-3">
                    Structured targets driving high-impact research, multidisciplinary collaboration, and academic integrity.
                  </p>
                  <div className="w-16 h-1 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full mx-auto mt-5"></div>
                </div>

                {objectiveItems.map((item) => {
                  const points = parseObjectivePoints(item.content);
                  const hasImage = Boolean(item.image);

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.03)]"
                    >
                      <div className={`grid grid-cols-1 ${hasImage ? 'lg:grid-cols-12 gap-8 lg:gap-12' : 'gap-6'} items-start`}>
                        {/* Illustration Showcase Column (if image present) */}
                        {hasImage && (
                          <div className="lg:col-span-4 lg:sticky lg:top-8 flex flex-col items-center justify-center text-center p-2">
                            <img
                              src={getImageUrl(item.image)}
                              alt={item.title || 'Research Objectives'}
                              className="max-h-64 w-auto object-contain mb-3 transition-transform duration-300 hover:scale-105"
                            />
                            {item.title && (
                              <h3 className="text-lg font-bold text-slate-900 mt-2">
                                {item.title}
                              </h3>
                            )}
                          </div>
                        )}

                        {/* Objectives Points List */}
                        <div className={`${hasImage ? 'lg:col-span-8' : 'w-full'}`}>
                          {points.length > 1 ? (
                            <div className="space-y-4">
                              {points.map((pointText, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="group flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/60 hover:border-teal-300 hover:shadow-md transition-all duration-200"
                                >
                                  {/* Number Pill Badge */}
                                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                                    {String(pIdx + 1).padStart(2, '0')}
                                  </div>

                                  {/* Point Description */}
                                  <div className="flex-1 pt-0.5">
                                    <div
                                      className="text-slate-800 text-base leading-relaxed font-medium"
                                      dangerouslySetInnerHTML={{ __html: pointText }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            /* Fallback for single block content */
                            <div className="prose prose-slate max-w-none text-slate-800 text-base sm:text-lg leading-relaxed p-6 bg-slate-50/70 rounded-2xl border border-slate-200/60">
                              <div dangerouslySetInnerHTML={{ __html: item.content }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default VisionMission;