import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import Captcha from '@/services/Captcha';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const SupReg = () => {
  const notify = notification();
  const navigate = useNavigate();
  const captchaRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    fullName: '',
    fatherName: '',
    email: '',
    phone: '',
  });

  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [showOtpField, setShowOtpField] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  const isValidPhone = (phone) => /^\d{10}$/.test(phone);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // For phone input, only allow numeric characters
    if (name === 'phone') {
      const numericValue = value.replace(/\D/g, '').slice(0, 10);
      setFormData({
        ...formData,
        [name]: numericValue,
      });
    } 
    // For fullName and fatherName, only allow alphabets and dots
    else if (name === 'fullName' || name === 'fatherName') {
      const filteredValue = value.replace(/[^a-zA-Z. ]/g, '');
      setFormData({
        ...formData,
        [name]: filteredValue,
      });
    } 
    else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleChangeEmailPhone = () => {
    setShowOtpField(false);
    setEmailOtp('');
    setPhoneOtp('');
    setIsOtpVerified(false);
  };

  const clearForm = () => {
    setFormData({
      title: '',
      fullName: '',
      fatherName: '',
      email: '',
      phone: '',
    });
    setIsOtpVerified(false);
    setShowOtpField(false);
    setEmailOtp('');
    setPhoneOtp('');
    captchaRef.current?.refreshCaptcha();
  };


  const handleSendOtp = async () => {
    if (!formData.email || !formData.phone) {
      notify.error('Please enter both email and phone number');
      return;
    }

    if (!isValidEmail(formData.email)) {
      notify.error('Please enter a valid email address');
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      notify.error('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSendingOtp(true);

    try {
      await API.post('/EmailValidation/send-otp', {
        email: formData.email,
        mobileNo: formData.phone,
        name: formData.fullName || '',
      });

      setShowOtpField(true);
      notify.success('OTPs sent to email and phone successfully!');
    } catch (error) {
      console.error('Failed to send OTPs:', error);
      
      // Better error handling for different scenarios
      if (error.response?.status === 400) {
        notify.error(error.response.data?.message || 'Invalid email or phone number format');
      } else if (error.response?.status === 429) {
        notify.error('Too many OTP requests. Please wait before trying again');
      } else if (error.response?.status === 500) {
        notify.error('Server error. Please try again later');
      } else {
        notify.error(error.response?.data?.message || 'Failed to send OTPs. Please try again');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify both email and phone OTPs
  const handleVerifyOtp = async () => {
    if (emailOtp.length !== 6 || phoneOtp.length !== 6) {
      notify.error('Please enter valid 6-digit OTPs for both email and phone');
      return;
    }

    setIsVerifyingOtp(true);

    try {
      await API.post('/EmailValidation/validate', {
        email: formData.email,
        phone: formData.phone,
        emailOtp,
        phoneOtp,
      });

      setIsOtpVerified(true);
      setShowOtpField(false);
      notify.success('Email and Phone verified successfully!');
    } catch (error) {
      console.error('OTP verification failed:', error);
      
      // Better error handling for different scenarios
      if (error.response?.status === 400) {
        const message = error.response.data?.message || 'Invalid OTPs';
        if (message.toLowerCase().includes('expired')) {
          notify.error('OTPs have expired. Please request new OTPs');
          setShowOtpField(false);
          setEmailOtp('');
          setPhoneOtp('');
        } else {
          notify.error(message);
        }
      } else if (error.response?.status === 429) {
        notify.error('Too many verification attempts. Please wait before trying again');
      } else {
        notify.error(error.response?.data?.message || 'Invalid OTPs. Please try again');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOtpVerified) {
      notify.error('Please verify your email address first');
      return;
    }

    if (!captchaRef.current?.verifyCaptcha()) {
      notify.error('Please enter the correct captcha code');
      return;
    }

    setIsLoading(true);

    const dataToSubmit =  formData;

    const payload = {
      supId: 0, // This should remain 0 for new registrations
      applicationNumber: "",
      title: dataToSubmit.title,
      fullName: dataToSubmit.fullName,
      fatherName: dataToSubmit.fatherName,
      mobileNo: dataToSubmit.phone,
      email: dataToSubmit.email,
      year: ""
    };

    try {
      await API.post("/SupervisorRegistration", payload);

      notify.success("Registration successful!");
      navigate("/register-supervisor/login");

    } catch (error) {
      console.error("Registration failed:", error);
      notify.error("Registration failed. Try again.");
      captchaRef.current?.refreshCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-lg">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <GraduationCap className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Supervisor Registration</h2>
          <p className="mt-1 text-sm text-gray-600">
            Create your account to start registration
          </p>
        </div>

        {/* Form */}
        <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
          {/* Hidden honeypot fields to confuse browser autocomplete */}
          <div style={{ display: 'none' }}>
            <input type="text" name="username" tabIndex="-1" autoComplete="username" />
            <input type="password" name="password" tabIndex="-1" autoComplete="current-password" />
            <input type="email" name="fake_email" tabIndex="-1" autoComplete="email" />
            <input type="tel" name="fake_phone" tabIndex="-1" autoComplete="tel" />
          </div>
          <div className="space-y-3">
            {/* Row 1: Salutation, Full Name, Father's Name */}
            <div className="grid grid-cols-3 gap-3">
              {/* Salutation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salutation <span className="text-red-600">*</span>
                </label>
                <select
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                >
                  <option value="">Select</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  autoComplete="nope"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  readOnly={isOtpVerified}
                  disabled={isOtpVerified}
                  required
                />
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Father's Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleInputChange}
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  autoComplete="nope"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  readOnly={isOtpVerified}
                  disabled={isOtpVerified}
                  required
                />
              </div>
            </div>

            {/* Row 2: Mobile, Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No. <span className="text-red-600">*</span>
                  {isOtpVerified && <span className="text-green-600 text-xs ml-2">✓ Verified</span>}
                  {!isOtpVerified && formData.phone && (
                    <span className={`text-xs ml-2 ${isValidPhone(formData.phone) ? 'text-green-600' : 'text-red-600'}`}>
                      {isValidPhone(formData.phone) ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  maxLength="10"
                  inputMode="numeric"
                  pattern="\d{10}"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    isOtpVerified 
                      ? 'bg-green-50 border-green-300' 
                      : formData.phone 
                        ? isValidPhone(formData.phone) 
                          ? 'border-green-300' 
                          : 'border-red-300'
                        : 'border-gray-300'
                  }`}
                  autoComplete="nope"
                  readOnly={isOtpVerified}
                  disabled={isOtpVerified}
                  placeholder="Enter 10-digit mobile number"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email ID <span className="text-red-600">*</span>
                  {isOtpVerified && <span className="text-green-600 text-xs ml-2">✓ Verified</span>}
                  {!isOtpVerified && formData.email && (
                    <span className={`text-xs ml-2 ${isValidEmail(formData.email) ? 'text-green-600' : 'text-red-600'}`}>
                      {isValidEmail(formData.email) ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    isOtpVerified 
                      ? 'bg-green-50 border-green-300' 
                      : formData.email 
                        ? isValidEmail(formData.email) 
                          ? 'border-green-300' 
                          : 'border-red-300'
                        : 'border-gray-300'
                  }`}
                  autoComplete="nope"
                  readOnly={isOtpVerified}
                  disabled={isOtpVerified}
                  placeholder="Enter valid email address"
                  required
                />
              </div>
            </div>

            {/* OTP Verification Section */}
            {!isOtpVerified && (
              <>
                {!showOtpField && isValidEmail(formData.email) && isValidPhone(formData.phone) && (
                  <div className="flex justify-center mt-2">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                      {isSendingOtp ? 'Sending OTPs...' : 'Send OTPs'}
                    </button>
                  </div>
                )}

                {showOtpField && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-2">
                    <div className="text-center mb-3 text-sm text-blue-800">
                      OTPs sent to <strong>{formData?.email}</strong> and <strong>{formData?.phone}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone OTP *</label>
                        <input
                          type="text"
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-center font-mono tracking-wider"
                          placeholder="000000"
                          maxLength="6"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email OTP *</label>
                        <input
                          type="text"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-center font-mono tracking-wider"
                          placeholder="000000"
                          maxLength="6"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <div className="flex justify-center mt-3">
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || emailOtp.length !== 6 || phoneOtp.length !== 6}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
                      >
                        {isVerifyingOtp ? 'Verifying...' : 'Verify OTPs'}
                      </button>
                    </div>
                    <div className="text-center mt-2">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp}
                        className="text-sm text-blue-600 hover:text-blue-800 underline mr-4"
                      >
                        Resend OTPs
                      </button>
                      <button
                        type="button"
                        onClick={handleChangeEmailPhone}
                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        Change Email/Phone
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Row 3: Captcha */}
            <Captcha ref={captchaRef} />
          </div>

          {/* Buttons Row */}
          <div className="flex gap-3 mt-4">


            <button
              type="button"
              onClick={clearForm}
              className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg shadow text-sm"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={isLoading || !isOtpVerified}
              className={`w-full py-2.5 rounded-lg shadow text-sm font-medium transition-colors ${isOtpVerified
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              {isLoading ? "Creating..." : isOtpVerified ? "Create Account" : "Verify Email First"}
            </button>
          </div>

          {/* Login Link */}
          <div className="text-center pt-3">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/register-supervisor/login" className="text-blue-600">
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupReg;
