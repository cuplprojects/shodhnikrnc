import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Select } from 'antd';
import Captcha from '@/services/Captcha';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const ScholarReg = () => {
  const navigate = useNavigate();
  const captchaRef = useRef(null);
  const [formData, setFormData] = useState({
    fullName: '',
    fatherName: '',
    email: '',
    phone: '',
    subject: '',
    registrationType: '',
    exemptionCategory: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [registrationTypes, setRegistrationTypes] = useState([]);
  const [exemptionCategories, setExemptionCategories] = useState([]);
  const [loadingExemptions, setLoadingExemptions] = useState(false);
  // const [partTimePositions, setPartTimePositions] = useState([]);
  // const [isPartTime, setIsPartTime] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [showOtpField, setShowOtpField] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const notify = notification();
  // Fetch registration types and part-time positions on component mount
  useEffect(() => {
    fetchRegistrationTypes();
    // fetchPartTimePositions();
    fetchSubjects();
  }, []);

  // Fetch exemption categories when registration type changes
  useEffect(() => {
    if (formData.registrationType) {
      const selectedRegType = registrationTypes.find(
        regType => regType.regTypeID === parseInt(formData.registrationType)
      );

      // Only fetch exemption categories if the selected registration type has exemptCategory
      if (selectedRegType && selectedRegType.exemptCategory !== null) {
        fetchExemptionCategories(formData.registrationType);
      } else {
        setExemptionCategories([]);
        setFormData(prev => ({ ...prev, exemptionCategory: '' }));
      }
    } else {
      setExemptionCategories([]);
      setFormData(prev => ({ ...prev, exemptionCategory: '' }));
    }
  }, [formData.registrationType, registrationTypes]);

  // Handle part-time checkbox change
  // useEffect(() => {
  //   if (isPartTime) {
  //     // Set registration type to 2 (Exemption from Entrance Test) for part-time
  //     setFormData(prev => ({
  //       ...prev,
  //       registrationType: '2',
  //       exemptionCategory: '',
  //       ptpid: ''
  //     }));
  //     // Fetch exemption categories for regTypeID 2
  //     fetchExemptionCategories('2');
  //   } else {
  //     // Reset when unchecked
  //     setFormData(prev => ({
  //       ...prev,
  //       registrationType: '',
  //       exemptionCategory: '',
  //       ptpid: ''
  //     }));
  //     setExemptionCategories([]);
  //   }
  // }, [isPartTime]);

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

  const handleChangeEmailPhone = () => {
    setShowOtpField(false);
    setEmailOtp('');
    setPhoneOtp('');
    setIsOtpVerified(false);
  };

  const fetchRegistrationTypes = async () => {
    try {
      const response = await API.get('/RegTypes/Distinct');
      setRegistrationTypes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching registration types:', error);
      notification().error('Failed to load registration types');
      setRegistrationTypes([]);
    }
  };

  const fetchExemptionCategories = async (regTypeID) => {
    setLoadingExemptions(true);
    try {
      const response = await API.get(`/RegTypes/GetExemptCategories/${regTypeID}`);
      setExemptionCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching exemption categories:', error);
      notification().error('Failed to load exemption categories');
      setExemptionCategories([]);
    } finally {
      setLoadingExemptions(false);
    }
  };

  // const fetchPartTimePositions = async () => {
  //   try {
  //     const response = await API.get('/PartTimePosition');
  //     setPartTimePositions(Array.isArray(response.data) ? response.data : []);
  //   } catch (error) {
  //     console.error('Error fetching part-time positions:', error);
  //     notification().error('Failed to load part-time positions');
  //     setPartTimePositions([]);
  //   }
  // };

  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const response = await API.get('/Department/subject-list');
      setSubjects(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      notification().error('Failed to load subjects');
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPhone = (phone) => /^\d{10}$/.test(phone);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Validation for different fields
    if (name === 'fullName') {
      // Allow only letters and spaces
      if (!/^[a-zA-Z\s]*$/.test(value)) {
        return;
      }
    }

    if (name === 'fatherName') {
      // Allow letters, spaces, and dots
      if (!/^[a-zA-Z\s.]*$/.test(value)) {
        return;
      }
    }

    if (name === 'phone') {
      // For phone input, only allow numeric characters and limit to 10 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 10);
      setFormData({
        ...formData,
        [name]: numericValue,
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: value,
    });

    // Reset exemption category when registration type changes
    if (name === 'registrationType') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        exemptionCategory: ''
      }));
    }
  };

  const handlePartTimeChange = (e) => {
    setIsPartTime(e.target.checked);
  };

  // Helper function to check if exemption category is required
  const isExemptionCategoryRequired = () => {
    if (!formData.registrationType) return false;
    const selectedRegType = registrationTypes.find(
      regType => regType.regTypeID === parseInt(formData.registrationType)
    );
    return selectedRegType && selectedRegType.exemptCategory !== null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOtpVerified) {
      notify.error('Please verify your email and phone number first');
      return;
    }

    // Verify captcha first
    if (!captchaRef.current?.verifyCaptcha()) {
      notification().error('Please enter the correct captcha code');
      return;
    }

    setIsLoading(true);

    try {
      // Determine final regType based on exemption selection
      // If an exemption category is selected and it's not "NO", use its regTypeID
      // otherwise use the main registrationType ID
      const finalRegType = (formData.exemptionCategory && formData.exemptionCategory !== 'NO')
        ? parseInt(formData.exemptionCategory)
        : parseInt(formData.registrationType);

      // Prepare payload according to API specification
      const payload = {
        name: formData.fullName,
        fName: formData.fatherName,
        phoneNumber: formData.phone,
        email: formData.email,
        subject_ID: parseInt(formData.subject), // This is actually departmentID from the API
        regType: finalRegType,
        exemptionType: 0,
        isSelected: false,
        applicationNo: "", // Empty string as per API spec
        // year: new Date().getFullYear().toString(), // Current year as string
        // isPartTime: isPartTime,
        // ...(isPartTime && { ptpid: parseInt(formData.ptpid) || 0 })
      };

      console.log('Scholar registration payload:', payload);

      const response = await API.post('/Scholars', payload);

      if (response.status === 200 || response.status === 201) {
        notification().success('Registration successful! Please login with your credentials.');
        navigate('/register-scholar/login');
      }
    } catch (error) {
      console.error('Registration failed:', error);

      // Handle different error scenarios
      if (error.response?.status === 400) {
        notification().error(error.response.data?.message || 'Invalid registration data. Please check your inputs.');
      } else if (error.response?.status === 409) {
        notification().error('An account with this email or phone number already exists.');
      } else if (error.response?.status === 500) {
        notification().error('Server error. Please try again later.');
      } else {
        notification().error('Registration failed. Please try again.');
      }

      captchaRef.current?.refreshCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-3xl w-500 bg-white p-6 rounded-lg shadow-lg">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <GraduationCap className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Scholar Registration
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Create your account to start registration
          </p>
        </div>

        {/* Registration Form */}
        <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
          {/* Hidden honeypot fields to confuse browser autocomplete */}
          <div style={{ display: 'none' }}>
            <input type="text" name="username" tabIndex="-1" autoComplete="username" />
            <input type="password" name="password" tabIndex="-1" autoComplete="current-password" />
            <input type="email" name="fake_email" tabIndex="-1" autoComplete="email" />
            <input type="tel" name="fake_phone" tabIndex="-1" autoComplete="tel" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className='grid grid-cols-2 col-span-2 gap-2'>
              {/* Applicant Name Field */}
              <div className=''>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Applicant Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Your Name"
                  pattern="[a-zA-Z\s]+"
                  title="Only letters and spaces are allowed"
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

              {/* Father's Name Field */}
              <div>
                <label
                  htmlFor="fatherName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Father's Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="fatherName"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleInputChange}
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Father's Name"
                  pattern="[a-zA-Z\s.]+"
                  title="Only letters, spaces, and dots are allowed"
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

              <div className='grid grid-cols-3 col-span-2 gap-2'>

                {/* Mobile Number Field */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Mobile No. <span className="text-red-600">*</span>
                    {isOtpVerified && <span className="text-green-600 text-xs ml-2">✓ Verified</span>}
                    {!isOtpVerified && formData.phone && (
                      <span className={`text-xs ml-2 ${isValidPhone(formData.phone) ? 'text-green-600' : 'text-red-600'}`}>
                        {isValidPhone(formData.phone) ? '✓ Valid' : '✗ Invalid'}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${isOtpVerified
                        ? 'bg-green-50 border-green-300'
                        : formData.phone
                          ? isValidPhone(formData.phone)
                            ? 'border-green-300'
                            : 'border-red-300'
                          : 'border-gray-300'
                      }`}
                    placeholder="Enter 10-digit mobile number"
                    maxLength="10"
                    inputMode="numeric"
                    title="Mobile number must be exactly 10 digits"
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

                {/* Email Field */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${isOtpVerified
                        ? 'bg-green-50 border-green-300'
                        : formData.email
                          ? isValidEmail(formData.email)
                            ? 'border-green-300'
                            : 'border-red-300'
                          : 'border-gray-300'
                      }`}
                    placeholder="Enter valid email address"
                    title="Please enter a valid email address"
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

                {/* Subject Field */}
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Subject <span className="text-red-600">*</span>
                  </label>
                  <Select
                    id="subject"
                    placeholder="--Select--"
                    value={formData.subject || undefined}
                    onChange={(value) => setFormData({ ...formData, subject: value })}
                    className="w-full"
                    loading={loadingSubjects}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={subjects.map((subject) => ({
                      label: subject.subject,
                      value: subject.departmentID.toString(),
                    }))}
                    style={{ fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>

            <div className='grid grid-cols-2 col-span-2 gap-2 flex items-center'>
              {/* Part-Time Checkbox */}
              {/* <div className="mt-2 mb-2 ">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isPartTime}
                    onChange={handlePartTimeChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Part-Time Registration
                    <span className="ml-2 text-sm font-medium text-red-700">
                      (Check this when applying for part-time)
                    </span>
                  </span>
                </label>
              </div> */}

              {/* Part-Time Position Field */}
              {/* {isPartTime && (
                <div className="col-span-1">
                  <label
                    htmlFor="ptpid"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Part-Time Position <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="ptpid"
                    name="ptpid"
                    value={formData.ptpid}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    required={isPartTime}
                  >
                    <option value="">--Select--</option>
                    {partTimePositions.map((position) => (
                      <option key={position.ptpid} value={position.ptpid}>
                        {position.ptpName}
                      </option>
                    ))}
                  </select>
                </div>
              )} */}

            </div>


            <div className='grid grid-cols-2 col-span-2 gap-2'>
              {/* Registration Type Field */}
              <div className="">
                <label
                  htmlFor="registrationType"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Select Registration Type <span className="text-red-600">*</span>
                </label>
                <select
                  id="registrationType"
                  name="registrationType"
                  value={formData.registrationType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                // disabled={isPartTime}
                >
                  <option value="">--Select--</option>
                  {registrationTypes.map((regType) => (
                    <option key={regType.regTypeID} value={regType.regTypeID}>
                      {regType.regTypeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exemption Category Field */}
              <div className="">
                <label
                  htmlFor="exemptionCategory"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Exemption Category {isExemptionCategoryRequired() && <span className="text-red-600">*</span>}
                </label>
                <select
                  id="exemptionCategory"
                  name="exemptionCategory"
                  value={formData.exemptionCategory}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required={isExemptionCategoryRequired()}
                  disabled={!formData.registrationType || loadingExemptions || !isExemptionCategoryRequired()}
                >
                  <option value="">
                    {loadingExemptions ? 'Loading...' :
                      !formData.registrationType ? 'Select Registration Type First' :
                        !isExemptionCategoryRequired() ? 'Not Required for Selected Registration Type' :
                          '--Select--'}
                  </option>
                  {/* {isPartTime && <option value="NO">NO</option>} */}
                  {exemptionCategories.map((category) => (
                    <option key={category.regTypeID} value={category.regTypeID}>
                      {category.exemptCategory}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                      OTPs sent to <strong>{formData.email}</strong> and <strong>{formData.phone}</strong>
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




            {/* Captcha */}
            <div className="col-span-2">
              <Captcha ref={captchaRef} />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isOtpVerified}
            className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium transition-all duration-200 mt-4 ${isOtpVerified
                ? 'text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                : 'text-gray-500 bg-gray-300 cursor-not-allowed'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Creating Account...' : isOtpVerified ? 'Create Account' : 'Verify Email & Phone First'}
          </button>

          {/* Login Link */}
          <div className="text-center pt-3">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/register-scholar/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScholarReg;