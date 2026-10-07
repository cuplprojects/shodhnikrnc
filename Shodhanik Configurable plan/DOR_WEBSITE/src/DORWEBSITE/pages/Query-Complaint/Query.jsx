import { useState } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';
import notification from '../../../services/NotificationService';

const Query = () => {
    const [formData, setFormData] = useState({
        name: '',
        shodhanikId: '',
        mobile: '',
        email: '',
        queryComplaint: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!formData.mobile.trim()) {
            newErrors.mobile = 'Mobile number is required';
        } else if (!/^[6-9]\d{9}$/.test(formData.mobile.trim())) {
            newErrors.mobile = 'Please enter a valid 10-digit mobile number';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.queryComplaint.trim()) {
            newErrors.queryComplaint = 'Query / Complaint is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (validateForm()) {
            setIsSubmitting(true);
            try {
                const response = await API.post('/QueryComplaint', {
                    name: formData.name.trim(),
                    shodhanikId: formData.shodhanikId.trim() || null,
                    mobile: formData.mobile.trim(),
                    email: formData.email.trim(),
                    queryComplaintText: formData.queryComplaint.trim()
                });

                if (response.data) {
                    setSubmitSuccess(true);
                    setFormData({
                        name: '',
                        shodhanikId: '',
                        mobile: '',
                        email: '',
                        queryComplaint: ''
                    });
                    
                    // Show success notification
                    notification().success('Your query/complaint has been submitted successfully! We will get back to you soon.');
                    
                    // Reset success message after 5 seconds
                    setTimeout(() => setSubmitSuccess(false), 5000);
                }
            } catch (error) {
                console.error('Error submitting query/complaint:', error);
                setErrors({ submit: 'Failed to submit query/complaint. Please try again.' });
                
                // Show error notification
                notification().error('Failed to submit query/complaint. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />

            <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="max-w-3xl mx-auto">
                    {/* Page Title */}
                    <h1 className="text-xl sm:text-2xl font-bold text-[#003366] mb-6">
                        Query / Complaint
                    </h1>

                    {/* Form Card */}
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                        {/* Form Header */}
                        <div className="bg-[#e6f3ff] px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center">
                                <svg className="w-6 h-6 text-[#003366] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                <div>
                                    <h2 className="text-lg font-semibold text-[#003366]">Submit Your Query or Complaint</h2>
                                    <p className="text-sm text-gray-600">Fields marked with <span className="text-red-500">*</span> are required</p>
                                </div>
                            </div>
                        </div>

                        {/* Success Message */}
                        {submitSuccess && (
                            <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
                                <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-green-700 font-medium">Your query/complaint has been submitted successfully! We will get back to you soon.</span>
                            </div>
                        )}

                        {/* Error Message */}
                        {errors.submit && (
                            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                                <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-700 font-medium">{errors.submit}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Name Field */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Your Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    className={`w-full px-4 py-3 border rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0099cc] focus:border-transparent transition-all duration-200 ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                />
                                {errors.name && (
                                    <p className="mt-1 text-sm text-red-500 flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            {/* Shodhanik ID Field */}
                            <div>
                                <label htmlFor="shodhanikId" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Shodhanik Id <span className="text-gray-400 font-normal">(If Available)</span>
                                </label>
                                <input
                                    type="text"
                                    id="shodhanikId"
                                    name="shodhanikId"
                                    value={formData.shodhanikId}
                                    onChange={handleChange}
                                    placeholder="Enter your Shodhanik ID (optional)"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0099cc] focus:border-transparent hover:border-gray-400 transition-all duration-200"
                                />
                            </div>

                            {/* Mobile and Email Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Mobile Field */}
                                <div>
                                    <label htmlFor="mobile" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Mobile No. <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        id="mobile"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        placeholder="Enter 10-digit mobile number"
                                        maxLength={10}
                                        className={`w-full px-4 py-3 border rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0099cc] focus:border-transparent transition-all duration-200 ${errors.mobile ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    />
                                    {errors.mobile && (
                                        <p className="mt-1 text-sm text-red-500 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {errors.mobile}
                                        </p>
                                    )}
                                </div>

                                {/* Email Field */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Email Id <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Enter your email address"
                                        className={`w-full px-4 py-3 border rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0099cc] focus:border-transparent transition-all duration-200 ${errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-sm text-red-500 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Query/Complaint Field */}
                            <div>
                                <label htmlFor="queryComplaint" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Query / Complaint <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="queryComplaint"
                                    name="queryComplaint"
                                    value={formData.queryComplaint}
                                    onChange={handleChange}
                                    placeholder="Please describe your query or complaint in detail..."
                                    rows={5}
                                    className={`w-full px-4 py-3 border rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0099cc] focus:border-transparent transition-all duration-200 resize-none ${errors.queryComplaint ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                />
                                {errors.queryComplaint && (
                                    <p className="mt-1 text-sm text-red-500 flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {errors.queryComplaint}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4 flex justify-center">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full sm:w-auto px-8 py-3 bg-[#003366] text-white font-semibold rounded-lg shadow-md hover:bg-[#004080] focus:outline-none focus:ring-2 focus:ring-[#0099cc] focus:ring-offset-2 transition-all duration-200 flex items-center justify-center cursor-pointer ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Submit Query
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                       
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Query;
