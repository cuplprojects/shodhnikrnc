import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Bell, Eye, EyeOff, Lock } from 'lucide-react';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import { supervisorAuthService } from '@/services/authService';
import notification from '@/services/NotificationService';
import { getPasswordAutoGenFlags } from '@/utils/jwtUtils';

const SupChangePassword = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useSupervisorRegAuthStore();
  const notify = notification();
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isForceChange, setIsForceChange] = useState(false);

  // Check authentication and password requirements
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      notify.error('Please login to access this page.');
      navigate('/register-supervisor/login');
      return;
    }

    // Check if supervisor needs to change password based on auto-generated flags
    if (user?.isTempAutoGen || user?.isPermAutoGen) {
      setIsForceChange(true);
      console.log('Supervisor change password - Auto-generated password detected, forcing change');
    } else {
      setIsForceChange(false);
      console.log('Supervisor change password - Manual password change');
    }
  }, [user, isAuthenticated, navigate, notify]);

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

  const validateForm = () => {
    if (!formData.oldPassword) {
      notify.error('Please enter your current password.');
      return false;
    }
    if (!formData.newPassword) {
      notify.error('Please enter a new password.');
      return false;
    }
    if (formData.newPassword.length < 6) {
      notify.error('New password must be at least 6 characters long.');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      notify.error('New password and confirm password do not match.');
      return false;
    }
    if (formData.oldPassword === formData.newPassword) {
      notify.error('New password must be different from current password.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Get user ID from user object
      const userId = user?.supId || user?.SupId || user?.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Determine if supervisor is accepted based on login flow
      // If they have auto-generated passwords, they might not be accepted yet
      const isAccepted = !(user?.isTempAutoGen || user?.isPermAutoGen);

      // Try to change password
      await supervisorAuthService.changePassword({
        userId: userId,
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
        isAccepted: isAccepted
      });
      
      // Show success notification
      notify.success('Password changed successfully! Please login with your new password.');
      
      // Logout user and redirect to login
      logout();
      navigate('/register-supervisor/login');
    } catch (error) {
      console.error('Password change failed:', error);
      
      // Show error notification
      if (error.response?.status === 400) {
        notify.error('Current password is incorrect.');
      } else {
        notify.error('Failed to change password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isForceChange) {
      // If it's a forced change, logout and go to login
      logout();
      navigate('/register-supervisor/login');
    } else {
      // Otherwise, go back to home
      navigate('/register-supervisor/home');
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Change Password Form - Shows first on mobile */}
          <div className="lg:col-span-1 lg:order-2 order-1">
            <div className="bg-white p-6 rounded-lg shadow-lg sticky top-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Lock className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Change Password
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {isForceChange 
                    ? 'You must change your password to continue' 
                    : 'Update your account password'
                  }
                </p>
                {isForceChange && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">
                      Your current password was auto-generated. Please set a new secure password.
                    </p>
                  </div>
                )}
              </div>

              {/* Change Password Form */}
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-3">
                  {/* Current Password Field */}
                  <div>
                    <label
                      htmlFor="oldPassword"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? "text" : "password"}
                        id="oldPassword"
                        name="oldPassword"
                        value={formData.oldPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter your current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showOldPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password Field */}
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        id="newPassword"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter your new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 6 characters long
                    </p>
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Confirm your new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 mt-6">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isLoading ? 'Changing Password...' : 'Change Password'}
                  </button>

                  {!isForceChange && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/* Back to Login Link */}
                <div className="text-center pt-3">
                  <Link
                    to="/register-supervisor/login"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    Back to Login
                  </Link>
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

export default SupChangePassword;