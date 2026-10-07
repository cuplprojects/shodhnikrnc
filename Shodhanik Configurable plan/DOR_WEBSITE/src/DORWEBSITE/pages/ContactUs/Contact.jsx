import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';

const Contact = () => {
    const [contactSettings, setContactSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch contact settings from API
    const fetchContactSettings = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await API.get('/ContactSettings');
            if (response.data.success && response.data.data) {
                setContactSettings(response.data.data);
            }
        } catch (err) {
            setError('Failed to fetch contact settings');
            console.error('Error fetching contact settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContactSettings();
    }, []);
    
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

    // Show loading state while contact settings are being fetched
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Header />
                <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="max-w-7xl mx-auto">
                        <h1 className="text-xl sm:text-2xl text-[#003366] mb-8">
                            Contact Us
                        </h1>
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003366] mx-auto mb-4"></div>
                                <p className="text-gray-500">Loading contact information...</p>
                            </div>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    // Show message when no contact settings are available
    if (!contactSettings) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Header />
                <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="max-w-7xl mx-auto">
                        <h1 className="text-xl sm:text-2xl text-[#003366] mb-8">
                            Contact Us
                        </h1>
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Contact Information Not Available</h3>
                            <p className="text-gray-600">
                                Contact settings have not been configured yet. Please check back later or contact the administrator.
                            </p>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />

            <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="max-w-7xl mx-auto">
                    {/* Page Title */}
                    <h1 className="text-xl sm:text-2xl text-[#003366] mb-8">
                        Contact Us
                    </h1>

                    {/* Contact Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                        {/* Address Card */}
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-[#e6f3ff] px-5 py-3 border-b border-gray-200">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-[#003366] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <h2 className="text-lg font-semibold text-[#003366]">Address</h2>
                                </div>
                            </div>
                            <div className="p-5">
                                <p className="text-gray-700 leading-relaxed">
                                    <span className="font-semibold text-[#003366]">{contactSettings.universityName}</span><br />
                                    {contactSettings.streetAddress}<br />
                                    {contactSettings.city}
                                </p>
                            </div>
                        </div>

                        {/* Phone & Email Card */}
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-[#e6f3ff] px-5 py-3 border-b border-gray-200">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-[#003366] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <h2 className="text-lg font-semibold text-[#003366]">Phone & Email</h2>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="flex items-start">
                                    <span className="font-semibold text-[#003366] min-w-[60px]">Phone:</span>
                                    <a href={`tel:${contactSettings.phone}`} className="text-gray-700 hover:text-[#0099cc] transition-colors">
                                        {contactSettings.phone}
                                    </a>
                                </div>
                                <div className="flex items-start">
                                    <span className="font-semibold text-[#003366] min-w-[60px]">Email:</span>
                                    <a href={`mailto:${contactSettings.email}`} className="text-gray-700 hover:text-[#0099cc] transition-colors break-all">
                                        {contactSettings.email}
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Help & Support Card */}
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-[#e6f3ff] px-5 py-3 border-b border-gray-200">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-[#003366] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <h2 className="text-lg font-semibold text-[#003366]">Help & Support</h2>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-start">
                                    <span className="font-semibold text-[#003366] min-w-[140px]">Technical Helpline:</span>
                                    <a href={`tel:${contactSettings.helpline}`} className="text-gray-700 hover:text-[#0099cc] transition-colors">
                                        {contactSettings.helpline}
                                    </a>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-start">
                                    <span className="font-semibold text-[#003366] min-w-[140px]">Email:</span>
                                    <a href={`mailto:${contactSettings.helpdeskEmail}`} className="text-gray-700 hover:text-[#0099cc] transition-colors break-all">
                                        {contactSettings.helpdeskEmail}
                                    </a>
                                </div>
                                <div className="flex items-center mt-3 pt-3 border-t border-gray-200">
                                    <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">
                                        <span className="font-semibold">Working Hours:</span> {contactSettings.workingHours}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* How to Reach Us Card */}
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-[#e6f3ff] px-5 py-3 border-b border-gray-200">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-[#003366] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                    <h2 className="text-lg font-semibold text-[#003366]">How to Reach Us</h2>
                                </div>
                            </div>
                            <div className="p-5">
                                <p className="text-gray-600 mb-4 text-sm">
                                    Distance of University from Railway and Bus station:
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center bg-[#e6f3ff] rounded-lg p-3">
                                        <div className="flex-shrink-0 w-10 h-10 bg-[#003366] rounded-full flex items-center justify-center mr-3">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#003366]">Railway Station</p>
                                            <p className="text-gray-600 text-sm">{contactSettings.railwayDistance}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center bg-[#e6f3ff] rounded-lg p-3">
                                        <div className="flex-shrink-0 w-10 h-10 bg-[#003366] rounded-full flex items-center justify-center mr-3">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#003366]">Bus Station</p>
                                            <p className="text-gray-600 text-sm">
                                                {contactSettings.oldBusStandDistance} (Old) | {contactSettings.newBusStandDistance} (New/Satellite)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location Map Section */}
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-[#e6f3ff] px-5 py-3 border-b border-gray-200">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-[#003366] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <h2 className="text-lg font-semibold text-[#003366]">Location Map</h2>
                            </div>
                        </div>
                        <div className="p-0">
                            {contactSettings.mapUrl ? (
                                <iframe
                                    src={extractMapUrl(contactSettings.mapUrl)}
                                    width="100%"
                                    height="400"
                                    style={{ border: 0 }}
                                    allowFullScreen=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title="University Location"
                                    className="w-full"
                                ></iframe>
                            ) : (
                                <div className="flex items-center justify-center h-96 bg-gray-100">
                                    <div className="text-center">
                                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <p className="text-gray-500">Map not available</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
                            <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(contactSettings.universityName + ' ' + contactSettings.city)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[#003366] hover:text-[#0099cc] transition-colors text-sm font-medium"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open in Google Maps
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Contact;
