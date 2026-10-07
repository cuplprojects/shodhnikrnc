import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Bell, Eye, EyeOff } from 'lucide-react';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import { supervisorAuthService } from '@/services/authService';
import notification from '@/services/NotificationService';


const SupLogin = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useSupervisorRegAuthStore();
  const notify = notification();
  const [formData, setFormData] = useState({
    applicationNumber: '',
    password: '',
  });
  const [loginMethod, setLoginMethod] = useState('applicationNumber'); // 'applicationNumber' or 'username'
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/register-supervisor/home');
    }
  }, [isAuthenticated, navigate]);

  // Sample notices
  const notices = [
    {
      id: 1,
      date: "Dec 10, 2025",
      title: "New supervisor applications are invited from 15th September to 30th September 2025. <a href='https://www.ccsuniversity.ac.in' target='_blank' rel='noopener noreferrer' class='text-blue-600 hover:underline font-semibold'>Apply Now</a>",
      category: "Supervisor",
      isImportant: true,
    }
  ];

  // Function to render HTML content safely
  const renderNoticeTitle = (title, isImportant) => {
    return (
      <h4 
        className={`font-medium mb-1 ${isImportant ? 'text-red-600' : 'text-gray-900'}`}
        dangerouslySetInnerHTML={{ __html: title }}
      />
    );
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Prepare credentials based on login method
      const credentials = loginMethod === 'applicationNumber' 
        ? { applicationNumber: formData.applicationNumber, password: formData.password }
        : { username: formData.applicationNumber, password: formData.password }; // Using same field for both

      // Use supervisor auth service
      const response = await supervisorAuthService.login(credentials);

      // Create user object from response
      const userData = {
        ...response,
        applicationNumber: formData.applicationNumber
      };

      // Login with supervisor auth store
      login(userData, response.token);
      
      // Show success notification
      // notify.success('Login successful! Welcome back.');
      
      // Check if supervisor needs to change password
      if (response.isTempAutoGen || response.isPermAutoGen) {
        navigate('/register-supervisor/change-password');
      } else {
        navigate('/register-supervisor/home');
      }
    } catch (error) {
      console.error('Login failed:', error);
      
      // Show error notification
      const errorMessage = error.response?.data?.message || 'Invalid credentials. Please check your application number/username and password.';
      notify.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Login Form - Shows first on mobile */}
          <div className="lg:col-span-1 lg:order-2 order-1">
            <div className="bg-white p-6 rounded-lg shadow-lg sticky top-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <GraduationCap className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Applicant Login
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Sign in to continue your registration
                </p>
              </div>

              {/* Login Method Toggle */}
              <div className="mb-4">
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('applicationNumber')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${
                      loginMethod === 'applicationNumber'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Application Number
                  </button>
                  {/* <button
                    type="button"
                    onClick={() => setLoginMethod('username')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${
                      loginMethod === 'username'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Username
                  </button> */}
                </div>
              </div>

              {/* Login Form */}
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-3">
                  {/* Application Number/Username Field */}
                  <div>
                    <label
                      htmlFor="applicationNumber"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {loginMethod === 'applicationNumber' ? 'Application Number' : 'Username'}
                    </label>
                    <input
                      type="text"
                      id="applicationNumber"
                      name="applicationNumber"
                      value={formData.applicationNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={loginMethod === 'applicationNumber' ? 'Enter your application number' : 'Enter your username'}
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Link
                      to="/register-supervisor/forgot-password"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-4"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                {/* Register Link */}
                <div className="text-center pt-3">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link
                      to="/register-supervisor/terms"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Register here
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    (You'll need to accept terms & conditions first)
                  </p>
                </div>
              </form>
            </div>
          </div>

          {/* Notices Section - Shows second on mobile */}
          <div className="lg:col-span-2 lg:order-1 order-2 space-y-6">
            {/* Notice Board */}
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                <Bell size={20} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Notice Board
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notices.map((notice, index) => (
                  <div key={notice.id}>
                    <div className="p-4 hover:bg-gray-50 transition-colors duration-150">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {renderNoticeTitle(notice.title, notice.isImportant)}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>{notice.date}</span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              notice.category === 'Supervisor' ? 'bg-red-100 text-red-600' :
                              notice.category === 'System' ? 'bg-green-100 text-green-600' :
                              notice.category === 'Academic' ? 'bg-blue-100 text-blue-600' :
                              notice.category === 'Research' ? 'bg-purple-100 text-purple-600' :
                              notice.category === 'Professional' ? 'bg-orange-100 text-orange-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {notice.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < notices.length - 1 && (
                      <div className="border-b border-gray-100"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* About CCSU-DoR */}
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  About CCSU-DoR
                </h3>
              </div>
              <div className="p-4">
                <div className="text-sm text-gray-700 space-y-3">
                  <p>
                    The Directorate of Research (DoR) was established by the Executive Council in its meeting dated 8th December 2020 to create an enabling environment in the University and its affiliated colleges to foster a research culture. It is the vision of our research Vice-Chancellor Prof. K. P. Singh to provide an efficient and effective support system to facilitate faculty members and researchers in their research activities and timely completion of their research degree or externally funded research/consultancy projects.
                  </p>
                  <p>
                    The Directorate of Research (DoR) has started its working from the Nehru Kendra building of the University. Its various sections like Scholarship division, Shodhganga division, Research Project division and Ph. D. division are providing world class facilities for its stake holders.
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="font-semibold text-blue-900 mb-2">
                      All research and innovation scholars are encouraged to contact Directorate of Research (DoR) for further details:
                    </p>
                    <div className="text-sm space-y-1">
                      <p>Director, Directorate of Research, Nehru Kendra</p>
                      <p>Chaudhary Charan Singh University, Meerut (UP) </p>
                      <p>Phone: +91-0121 2604570; Email: registrar@ccsuniversity.ac.in</p>
                      <p>Technical Helpline : +91-0121 2604570, Email : registrar@ccsuniversity.ac.in, Working Days 11 AM to 04 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupLogin;