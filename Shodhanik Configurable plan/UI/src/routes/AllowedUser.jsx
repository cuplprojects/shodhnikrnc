// components/AllowedUser.jsx
import { Navigate } from "react-router-dom";
import useStaffAuthStore from "@/store/staffAuthStore";
import useSelectedScholarAuthStore from "@/store/selectedScholarAuthStore";
import useSupervisorAuthStore from "@/store/supervisorAuthStore";

const AllowedUser = ({ children, type }) => {
  const staffAuth = useStaffAuthStore();
  const selectedScholarAuth = useSelectedScholarAuthStore();
  const supervisorAuth = useSupervisorAuthStore();

  // Check if any auth store is still loading or not initialized
  const isLoading = staffAuth.isLoading || selectedScholarAuth.isLoading || supervisorAuth.isLoading;
  const isInitialized = staffAuth.isInitialized && selectedScholarAuth.isInitialized && supervisorAuth.isInitialized;

  // Show loading while authentication is initializing
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Determine current user type and authentication status
  let currentUserType = null;
  let isAuthenticated = false;

  if (staffAuth.isAuthenticated) {
    currentUserType = 'STAFF';
    isAuthenticated = true;
  } else if (selectedScholarAuth.isAuthenticated) {
    currentUserType = 'SH';
    isAuthenticated = true;
  } else if (supervisorAuth.isAuthenticated) {
    currentUserType = 'SUP';
    isAuthenticated = true;
  }

  // If no user is authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if current user type matches required type
  if (currentUserType !== type) {
    // Redirect to appropriate dashboard based on current user type
    switch (currentUserType) {
      case 'SH':
        return <Navigate to="/scholar-dashboard" replace />;
      case 'SUP':
        return <Navigate to="/supervisor-dashboard" replace />;
      case 'STAFF':
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  // User type matches, allow access
  return children;
};

export default AllowedUser;