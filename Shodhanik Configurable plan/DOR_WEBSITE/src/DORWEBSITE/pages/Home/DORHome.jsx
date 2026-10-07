import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import Noticeboard from '../Notice/Noticeboard';
import ProgramEventsSection from '../../components/ProgramEventsSection';
import ExternalLinksSection from '../../components/ExternalLinksSection';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const DORHome = () => {
  // State for all data
  const [carouselSlides, setCarouselSlides] = useState([]);
  const [leadershipTeam, setLeadershipTeam] = useState([]);
  const [universityStatistics, setUniversityStatistics] = useState([]);
  const [newsAnnouncements, setNewsAnnouncements] = useState([]);
  const [bannerAnnouncements, setBannerAnnouncements] = useState([]);
  const [welcomeSection, setWelcomeSection] = useState(null);
  const [expandedLeader, setExpandedLeader] = useState(null);
  
  // UI state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isNoticeboardOpen, setIsNoticeboardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Fetch all data from APIs
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel using Promise.allSettled to handle individual failures
      const results = await Promise.allSettled([
        API.get('/CarouselSlides'),
        API.get('/LeadershipTeamMembers'),
        API.get('/UniversityStatistics'),
        API.get('/NewsAnnouncements'),
        API.get('/BannerAnnouncements'),
        API.get('/WelcomeSections')
      ]);

      // Process carousel slides
      if (results[0].status === 'fulfilled' && results[0].value.data.success) {
        setCarouselSlides(results[0].value.data.data || []);
      }

      // Process leadership team
      if (results[1].status === 'fulfilled' && results[1].value.data.success) {
        setLeadershipTeam(results[1].value.data.data || []);
      }

      // Process university statistics
      if (results[2].status === 'fulfilled' && results[2].value.data.success) {
        setUniversityStatistics(results[2].value.data.data || []);
      }

      // Process news announcements
      if (results[3].status === 'fulfilled' && results[3].value.data.success) {
        setNewsAnnouncements(results[3].value.data.data || []);
      }

      // Process banner announcements
      if (results[4].status === 'fulfilled' && results[4].value.data.success) {
        setBannerAnnouncements(results[4].value.data.data || []);
      }

      // Process welcome section
      if (results[5].status === 'fulfilled' && results[5].value.data.success) {
        const welcomeData = results[5].value.data.data;
        const activeSection = Array.isArray(welcomeData) 
          ? welcomeData.find(section => section.isActive) || welcomeData[0]
          : welcomeData;
        setWelcomeSection(activeSection);
      }

    } catch (err) {
      console.error('Error fetching home page data:', err);
      setError('Failed to load some content. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Show noticeboard popup when component mounts
    setIsNoticeboardOpen(true);
  }, []);

  // Auto-scroll carousel
  useEffect(() => {
    if (!carouselSlides || carouselSlides.length === 0) {
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [(carouselSlides || []).length]);





  // Get active news announcements from API, sorted by date (newest first)
  const announcements = (newsAnnouncements || [])
    .filter(item => item.status === 'Active')
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA; // Newest first
    });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* Noticeboard Popup */}
      <Noticeboard
        isOpen={isNoticeboardOpen}
        onClose={() => setIsNoticeboardOpen(false)}
      />

      {/* Quick Links Bar
      <div className="bg-gradient-to-r from-[#0099cc] to-[#0077aa] text-white">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-6 text-sm overflow-x-auto">
          <a href="#/dor-website/scholars/viva-schedules" className="whitespace-nowrap hover:text-yellow-300 transition-colors duration-200">
            Viva Scheduled
          </a>
          <a href="#/dor-website/scholars/rdc-schedules" className="whitespace-nowrap hover:text-yellow-300 transition-colors duration-200">
            RDC Scheduled
          </a>
        </div>
      </div> */}

      {/* Announcement Banner */}
      {(() => {
        const activeBannerAnnouncements = (bannerAnnouncements || [])
          .filter(item => item.status === 'Active')
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return activeBannerAnnouncements.length > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-white-600 text-yellow-300 py-3 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col gap-1 text-sm md:text-base font-semibold">
                {activeBannerAnnouncements.map((announcement, index) => (
                  <p key={announcement.id || index} className="animate-pulse">{announcement.title}</p>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main Content */}
      <main className="flex-grow w-full">
        <div className="max-w-7xl mx-auto px-4 py-4 cursor-pointer">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left Side - Image Slider */}
            <div className="w-full lg:flex-1 lg:max-w-[calc(100%-380px)]">
              <div className="relative rounded-lg shadow-lg overflow-hidden w-full h-[450px] md:h-[550px] bg-white">
                {/* Main Image with transitions */}
                <div className="relative w-full h-full">
                  {(!carouselSlides || carouselSlides.length === 0) ? (
                    // Empty state when no carousel slides
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-blue-600 mb-2">No Images Available</h3>
                        <p className="text-blue-500">Carousel images will appear here when uploaded</p>
                      </div>
                    </div>
                  ) : (
                    (carouselSlides || []).map((slide, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}
                        w-full h-full bg-white flex items-center justify-center`}
                    >
                      {slide.image && (
                        <img
                          src={(() => {
                            const imagePath = slide.image;
                            if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
                            if (imagePath.startsWith('/')) return imagePath;
                            if (imagePath.startsWith('data:image/')) return imagePath;
                            const baseURL = getBaseFileURL();
                            const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
                            return `${baseURL}${cleanPath}`;
                          })()}
                          alt={slide.caption || 'Carousel slide'}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      {slide.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 z-20">
                          <p className="text-white text-sm md:text-base font-medium">
                            {slide.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                  )}
                </div>

                {/* Slider Controls - Only show if there are slides */}
                {carouselSlides && carouselSlides.length > 1 && (
                  <>
                    <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 flex justify-between px-4 z-20">
                      <button
                        onClick={() => setCurrentSlide(prev => (prev > 0 ? prev - 1 : carouselSlides.length - 1))}
                        className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentSlide(prev => (prev + 1) % carouselSlides.length)}
                        className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 cursor-pointer"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* Slide Indicators */}
                    <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2 z-20 cursor-pointer">
                      {carouselSlides.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentSlide(index)}
                          className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer shadow-md ${index === currentSlide
                            ? 'bg-blue-600 ring-2 ring-white scale-125'
                            : 'bg-white/80 hover:bg-white ring-1 ring-black/20'
                            }`}
                          aria-label={`Go to slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Side - News & Announcements - Responsive right positioning */}
            <div className="w-full lg:w-[350px] lg:flex-shrink-0 lg:ml-8">
              <div className="bg-gradient-to-r from-[#0099cc] to-[#0077aa] text-white rounded-t-lg px-4 py-3">
                <h2 className="text-xl font-bold">News, Announcements</h2>
              </div>
              <div className="bg-white shadow-lg h-[450px] md:h-[490px] overflow-y-auto">
                {announcements.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">No announcements available</p>
                    </div>
                  </div>
                ) : (
                  announcements.map((announcement, index) => (
                    <div
                      key={announcement.id || index}
                      className="border-b border-gray-200 last:border-b-0 hover:bg-blue-50 transition-colors duration-200"
                    >
                      <div className="block p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2 hover:text-blue-600">
                              {announcement.title}
                            </h3>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                              <span className="bg-gray-100 px-2 py-1 rounded">{announcement.language}</span>
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-semibold">
                                {announcement.format}
                              </span>
                              {announcement.size && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  {announcement.size}
                                </span>
                              )}
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                Date: {formatDate(announcement.date)}
                              </span>
                            </div>
                          </div>
                          {announcement.filePath && (
                            <a
                              href={(() => {
                                const filePath = announcement.filePath;
                                if (!filePath || filePath === '--') return '';
                                if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
                                const baseURL = getBaseFileURL();
                                const separator = filePath.startsWith('/') ? '' : '/';
                                return `${baseURL}${separator}${filePath}`;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-3 inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors"
                              title="Download File"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="bg-gradient-to-r from-[#0099cc] to-[#0077aa] text-white rounded-b-lg px-4 py-2 text-center">
                <a href="#" className="text-sm font-semibold hover:text-yellow-300 transition-colors duration-200">
                  View All Announcements →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Leadership Section */}
        <section className="bg-gradient-to-b from-gray-100 to-white py-6 md:py-8">
          <div className="max-w-7xl mx-auto px-4 cursor-pointer">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-1xl md:text-2xl font-bold text-gray-700">
                Leadership Team
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(leadershipTeam || []).map((leader, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-all duration-300 hover:shadow-2xl"
                >
                  <div className="bg-gradient-to-r from-[#0099cc] to-[#0066aa] p-1"></div>
                  <div className="p-6 text-center">
                    <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#0099cc] shadow-lg">
                      <img
                        src={(() => {
                          const imagePath = leader.image;
                          const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(leader.name)}&size=128&background=0099cc&color=fff`;
                          if (!imagePath) return fallback;
                          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
                          if (imagePath.startsWith('/')) return imagePath;
                          if (imagePath.startsWith('data:image/')) return imagePath;
                          const baseURL = getBaseFileURL();
                          const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
                          return `${baseURL}${cleanPath}`;
                        })()}
                        alt={leader.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(leader.name)}&size=128&background=0099cc&color=fff`;
                        }}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-[#0099cc] mb-1">{leader.name}</h3>
                    <p className="text-sm font-semibold text-gray-700">{leader.title}</p>
                    <p className="text-xs text-gray-500 mb-4">{leader.subtitle}</p>
                    <div className="text-sm text-gray-600 leading-relaxed mb-4 h-24 overflow-y-auto">
                      {expandedLeader === index ? leader.description : `${leader.description.substring(0, 100)}...`}
                    </div>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setExpandedLeader(expandedLeader === index ? null : index);
                      }}
                      className="inline-block text-[#0099cc] font-semibold text-sm hover:text-[#0066aa] transition-colors duration-200"
                    >
                      {expandedLeader === index ? 'Read less' : 'Read more..'}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Welcome / About Us Section - Open Layout (No enclosing card div) */}
        {welcomeSection && (
          <section className="py-10 md:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {welcomeSection?.welcomeTitle && (
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 text-[#0066cc] border border-blue-200/60 mb-3 shadow-xs">
                    <svg className="w-3.5 h-3.5 text-[#0066cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Overview</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                    {welcomeSection.welcomeTitle}
                  </h2>
                  <div className="w-16 h-1 bg-gradient-to-r from-[#0066cc] to-cyan-500 rounded-full mx-auto mt-4"></div>
                </div>
              )}

              <div className="text-slate-700 text-base sm:text-lg lg:text-xl leading-relaxed text-justify space-y-4 font-normal">
                {typeof welcomeSection?.welcomeText === 'string' && welcomeSection.welcomeText.includes('<') ? (
                  <div dangerouslySetInnerHTML={{ __html: welcomeSection.welcomeText }} />
                ) : (
                  <p>{welcomeSection?.welcomeText}</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Statistics Section */}
        {universityStatistics && universityStatistics.length > 0 && (
          <section className="py-6 md:py-8 bg-white">
            <div className="max-w-7xl mx-auto px-4 cursor-pointer">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-1xl md:text-2xl font-bold text-gray-700">
                  University Statistics
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {universityStatistics.map((stat, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-b from-blue-50 to-white rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-all duration-300 border-0 border-none"
                  >
                    <h3 className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                      {stat.count}
                    </h3>
                    <p className="text-gray-700 font-medium text-sm">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Programs / Events Section */}
        <ProgramEventsSection />

        {/* External Links Section */}
        <ExternalLinksSection />
      </main>

      <Footer />
      

    </div>
  );
};

export default DORHome;
