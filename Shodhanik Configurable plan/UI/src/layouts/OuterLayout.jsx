// layouts/OuterLayout.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

// component imports
import TopBar from "@/components/TopBar";
import MenuBar from "@/components/MenuBar";
import OuterFooter from "@/components/OuterFooter";

// services
import { scholarAuthService, staffAuthService, supervisorAuthService } from "@/services/authService";
import useSelectedScholarAuthStore from "@/store/selectedScholarAuthStore";
import useStaffAuthStore from "@/store/staffAuthStore";
import useSupervisorAuthStore from "@/store/supervisorAuthStore";
import notification from "@/services/NotificationService";



const OuterLayout = () => {
  const [activeTab, setActiveTab] = useState("staff");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Sample notices
  const notices = [
    {
      id: 1,
      date: "Dec 5, 2025",
      title: "Winter Semester Registration Open",
      category: "Academic",
    }
  ];

  // Detect user type from username
  const getUserType = (username) => {
    if (/^SH\d+/.test(username)) return 'SH';
    if (/^SUP\d+/.test(username)) return 'SUP';
    return 'STAFF';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userType = getUserType(formData.username);

      // Validate tab and user type match
      if (activeTab === 'scholar' && userType !== 'SH') {
        notification().error('Please use Scholar ID (SH...) for Scholar login');
        return;
      }
      if (activeTab === 'supervisor' && userType !== 'SUP') {
        notification().error('Please use Supervisor ID (SUP...) for Supervisor login');
        return;
      }
      if (activeTab === 'staff' && userType !== 'STAFF') {
        notification().error('Please use staff credentials for University Staff login');
        return;
      }

      let response, authStore, redirectPath;

      // Handle different login types
      if (userType === 'SH' && activeTab === 'scholar') {
        response = await scholarAuthService.login(formData);
        authStore = useSelectedScholarAuthStore.getState();
        redirectPath = '/scholar-dashboard';
      } else if (userType === 'SUP' && activeTab === 'supervisor') {
        response = await supervisorAuthService.login({ username: formData.username, password: formData.password });
        authStore = useSupervisorAuthStore.getState();
        redirectPath = '/supervisor-dashboard';
      } else if (userType === 'STAFF' && activeTab === 'staff') {
        response = await staffAuthService.login(formData);
        authStore = useStaffAuthStore.getState();
        redirectPath = '/dashboard';
      } else {
        notification().error('Please select the correct login tab for your account type');
        return;
      }

      if (response.token) {
        // Create user data object with response information
        const userData = {
          ...response,
          username: formData.username,
          // Include the user's single role
          selectedRole: response.role || null
        };

        authStore.login(userData, response.token);
        // notification().success('Login successful!');

        // Check if supervisor needs to change password
        if (activeTab === 'supervisor' && (response.isTempAutoGen || response.isPermAutoGen)) {
          navigate('/register-supervisor/change-password');
        } else {
          navigate(redirectPath);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      notification().error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };





  return (
    <div className="min-h-screen flex flex-col bg-white">


      <TopBar />
      <MenuBar />

      <div
        className="flex-1 relative bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/university/ccsu/banner.png')",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 "></div>

        {/* Content Container */}
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 ">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
            {/* Left Side - CMS Content (60% on desktop) */}
            <div className="lg:col-span-3 space-y-6">

              {/* Notices Board */}
              <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-lg">
                <div className="p-2 md:p-3 border-b border-[#e5e7eb] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={20} className="text-[#1e40af]" />
                    <h2 className="text-lg md:text-xl font-semibold text-[#111827] font-inter">
                      Latest Notices
                    </h2>
                  </div>
                  <a
                    href="#"
                    className="text-sm text-[#1e40af] hover:text-[#1e3a8a] font-medium font-inter flex items-center gap-1"
                  >
                    View All
                    <ChevronRight size={16} />
                  </a>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notices.map((notice, index) => (
                    <div key={notice.id}>
                      <button className="w-full p-4 md:p-5 hover:bg-[#f9fafb] transition-colors duration-150 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-[#111827] mb-1 font-inter">
                              {notice.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
                              <span className="font-inter">{notice.date}</span>
                              <span>•</span>
                              <span className="px-2 py-0.5 bg-[#dbeafe] text-[#1e40af] rounded-full font-medium font-inter">
                                {notice.category}
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            size={18}
                            className="text-[#9ca3af] flex-shrink-0 mt-1"
                          />
                        </div>
                      </button>
                      {index < notices.length - 1 && (
                        <div className="border-b border-[#f3f4f6]"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side - Login Box (40% on desktop) */}
            <div className="lg:col-span-2 shadow-lg">
              <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-lg sticky top-8">
                {/* Tab Headers */}
                <div className="border-b border-[#e5e7eb]">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("staff")}
                      className={`flex-1 px-4 py-4 text-sm font-medium font-inter transition-all duration-200 border-b-2 ${activeTab === "staff"
                        ? "text-[#1e40af] border-[#1e40af] bg-[#eff6ff]"
                        : "text-[#6b7280] border-transparent hover:text-[#1e40af] hover:bg-[#f9fafb]"
                        }`}
                    >
                      University Staff
                    </button>
                    <button
                      onClick={() => setActiveTab("scholar")}
                      className={`flex-1 px-4 py-4 text-sm font-medium font-inter transition-all duration-200 border-b-2 ${activeTab === "scholar"
                        ? "text-[#1e40af] border-[#1e40af] bg-[#eff6ff]"
                        : "text-[#6b7280] border-transparent hover:text-[#1e40af] hover:bg-[#f9fafb]"
                        }`}
                    >
                      Scholar Login
                    </button>
                    <button
                      onClick={() => setActiveTab("supervisor")}
                      className={`flex-1 px-4 py-4 text-sm font-medium font-inter transition-all duration-200 border-b-2 ${activeTab === "supervisor"
                        ? "text-[#1e40af] border-[#1e40af] bg-[#eff6ff]"
                        : "text-[#6b7280] border-transparent hover:text-[#1e40af] hover:bg-[#f9fafb]"
                        }`}
                    >
                      Supervisor Login
                    </button>
                  </div>
                </div>

                {/* Login Form */}
                <div className="p-6 md:p-8">
                  <h3 className="text-xl font-semibold text-[#111827] mb-6 font-inter">
                    {activeTab === "staff" && "Staff Login"}
                    {activeTab === "scholar" && "Scholar Login"}
                    {activeTab === "supervisor" && "Supervisor Login"}
                  </h3>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Username Field */}
                    <div>
                      <label
                        htmlFor="username"
                        className="block text-sm font-medium text-[#374151] mb-2 font-inter"
                      >
                        {activeTab === "scholar"
                          ? "Scholar ID"
                          : activeTab === "supervisor"
                            ? "Supervisor ID"
                            : "Username / Employee ID"}
                      </label>
                      <input
                        type="text"
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent transition-all duration-200 font-inter"
                        placeholder={
                          activeTab === "scholar"
                            ? "Enter your Scholar ID (SH...)"
                            : activeTab === "supervisor"
                              ? "Enter your Supervisor ID (SUP...)"
                              : "Enter your username"
                        }
                        required
                      />
                    </div>

                    {/* Password Field */}
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-[#374151] mb-2 font-inter"
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
                          className="w-full px-4 py-3 border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent transition-all duration-200 font-inter pr-10"
                          placeholder="Enter your password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6b7280] hover:text-[#1e40af] transition-colors duration-200"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Forgot Password Link */}
                    <div className="text-right">
                      <a
                        href="#"
                        className="text-sm text-[#1e40af] hover:text-[#1e3a8a] font-medium font-inter"
                      >
                        Forgot Password?
                      </a>
                    </div>

                    {/* Login Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white py-3 px-4 rounded-lg font-semibold font-inter transition-all duration-200 hover:from-[#1e3a8a] hover:to-[#2563eb] active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Signing In...
                        </div>
                      ) : (
                        'Sign In'
                      )}
                    </button>
                  </form>

                  {/* Additional Links */}
                  <div className="mt-6 pt-6 border-t border-[#e5e7eb]">
                    <p className="text-sm text-[#6b7280] text-center font-inter">
                      Need help accessing your account?{" "}
                      <a
                        href="#"
                        className="text-[#1e40af] hover:text-[#1e3a8a] font-medium"
                      >
                        Contact Support
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <OuterFooter />
    </div>
  );
};

export default OuterLayout;
