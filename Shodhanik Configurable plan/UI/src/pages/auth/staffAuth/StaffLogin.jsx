import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User } from 'lucide-react';
import useStaffAuthStore from '@/store/staffAuthStore';
import { staffAuthService } from '@/services/authService';
import notification from '@/services/NotificationService';

const StaffLogin = () => {
  const navigate = useNavigate();
  const staffAuthStore = useStaffAuthStore();
  const login = staffAuthStore.login;
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

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
      const response = await staffAuthService.login(formData);
      
      if (response.success && response.token) {
        console.log('📦 Login API Response:', response);
        
        // Extract permissions directly from API response
        const permissions = response.permissions || [];
        
        // Ensure we have user data
        if (!response.user) {
          throw new Error('No user data in response');
        }
        
        // Extract ONLY user data (not the entire API response)
        const userData = {
          id: response.user.id,
          username: response.user.username || formData.username,
          email: response.user.email,
          name: response.user.name,
          phone: response.user.phone,
          department: response.user.department,
          roleId: response.user.roleId,
          roleName: response.user.roleName,
          tokenExp: response.user.tokenExp
        };
        

        
        // Login with user data and permissions
        login(userData, response.token, permissions);
        
        // notification().success('Login successful!');
        navigate('/dashboard');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
      notification().error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <User className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Staff Login
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Sign in to access the dashboard
            </p>
          </div>

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3">
              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Username / Employee ID
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Enter your username"
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
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  to="/forgot-password"
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
                  to="/register"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Contact Administrator
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};

export default StaffLogin;