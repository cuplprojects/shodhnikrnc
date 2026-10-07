import { useState, useEffect } from 'react';
import { User, Quote, Sparkles, Award, GraduationCap } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const VCMessage = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchViceChancellorMessages();
  }, []);

  const fetchViceChancellorMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/ViceChancellorMessages');
      setMessages(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching Vice Chancellor messages:', err);
      setError('Failed to load Vice Chancellor messages. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    if (imagePath.startsWith('/')) return imagePath;
    if (imagePath.startsWith('data:image/')) return imagePath;
    const baseURL = getBaseFileURL();
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseURL}${cleanPath}`;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        {/* Page Hero Header */}
        <div className="relative text-center mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 text-[#0066cc] border border-blue-200/60 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
            University Leadership
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Vice Chancellor's <span className="text-[#0066cc]">Message</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Inspiring academic rigor, visionary research, and empowering the next generation of global scholars.
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-[#0066cc] to-cyan-500 rounded-full mx-auto mt-6"></div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-200 border-t-[#0066cc] mx-auto mb-4"></div>
              <p className="text-slate-600 text-base font-medium">Loading Vice Chancellor's Message...</p>
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
                onClick={fetchViceChancellorMessages}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && messages.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-5">
              <User className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Message Available</h3>
            <p className="text-slate-500 text-base max-w-md mx-auto">
              Vice Chancellor's message will appear here once published in the system.
            </p>
          </div>
        )}

        {/* Messages Content - Open Editorial Layout (No enclosing card/box div) */}
        {!loading && !error && messages.length > 0 && (
          <div className="space-y-20">
            {messages.map((message) => (
              <div key={message.id}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
                  {/* Left Column: Portrait Only (Open, clean presentation) */}
                  <div className="lg:col-span-4 lg:sticky lg:top-8 flex flex-col items-center lg:items-start text-center lg:text-left">
                    {message.image && (
                      <div className="w-full max-w-sm mb-6 flex justify-center lg:justify-start">
                        <img
                          src={getImageUrl(message.image)}
                          alt={message.name || 'Vice Chancellor'}
                          className="w-full h-auto max-h-[380px] object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Editorial Message Letter (Open, no card box) */}
                  <div className="lg:col-span-8 flex flex-col justify-between pt-2">
                    <div>
                      {/* Decorative Quote Icon */}
                      <Quote className="w-12 h-12 text-blue-200/90 mb-4 transform -scale-x-100" />

                      {/* Main Message Typography */}
                      {message.message ? (
                        <div
                          className="text-slate-700 text-lg leading-relaxed text-justify space-y-4 font-normal"
                          dangerouslySetInnerHTML={{ __html: message.message }}
                        />
                      ) : (
                        <p className="text-slate-500 italic py-6">No message content available.</p>
                      )}
                    </div>

                    {/* Executive Sign-off */}
                    <div className="mt-12 pt-8 border-t border-slate-200 flex justify-end">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-500 italic">With warm regards,</p>
                        {message.name && (
                          <p className="text-xl font-bold text-slate-900 mt-0.5">
                            {message.name}
                          </p>
                        )}
                        {message.designation && (
                          <p className="text-xs font-semibold text-[#0066cc] tracking-wide uppercase">
                            {message.designation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default VCMessage;
