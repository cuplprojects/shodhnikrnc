// components/AuthGuard.jsx
import { Navigate, useLocation } from "react-router-dom";
import useStaffAuthStore from "@/store/staffAuthStore";
import useScholarRegAuthStore from "@/store/scholarRegAuthStore";
import useSelectedScholarAuthStore from "@/store/selectedScholarAuthStore";
import useSupervisorRegAuthStore from "@/store/supervisorRegAuthStore";
import useSupervisorAuthStore from "@/store/supervisorAuthStore";


const AuthGuard = ({ children, userType }) => {
  const location = useLocation();
  
  // Get full auth state including loading and initialization status
  const staffAuthState = useStaffAuthStore();
  const scholarRegAuthState = useScholarRegAuthStore();
  const selectedScholarAuthState = useSelectedScholarAuthStore();
  const supervisorRegAuthState = useSupervisorRegAuthStore();
  const selectedSupervisorAuthState = useSupervisorAuthStore();

  // Check if any auth store is still loading or not initialized
  const isLoading = staffAuthState.isLoading || scholarRegAuthState.isLoading || selectedScholarAuthState.isLoading || 
                   supervisorRegAuthState.isLoading || selectedSupervisorAuthState.isLoading;
  const isInitialized = staffAuthState.isInitialized && scholarRegAuthState.isInitialized && selectedScholarAuthState.isInitialized && 
                       supervisorRegAuthState.isInitialized && selectedSupervisorAuthState.isInitialized;

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

  // Extract authentication status after initialization
  const staffAuth = staffAuthState.isAuthenticated;
  const scholarRegAuth = scholarRegAuthState.isAuthenticated;
  const selectedScholarAuth = selectedScholarAuthState.isAuthenticated;
  const supervisorRegAuth = supervisorRegAuthState.isAuthenticated;
  const selectedSupervisorAuth = selectedSupervisorAuthState.isAuthenticated;

  // Check if any user is authenticated
  const anyUserAuthenticated = staffAuth || scholarRegAuth || selectedScholarAuth || supervisorRegAuth || selectedSupervisorAuth;

  // If any user is authenticated, redirect them to their respective dashboard/home
  if (anyUserAuthenticated) {
    if (staffAuth) {
      return <Navigate to="/dashboard" replace />;
    } else if (scholarRegAuth) {
      // Check if we're in registration context
      if (location.pathname.startsWith('/register-scholar/')) {
        return <Navigate to="/register-scholar/home" replace />;
      } else {
        return <Navigate to="/register-scholar/home" replace />;
      }
    } else if (selectedScholarAuth) {
      return <Navigate to="/scholar-dashboard" replace />;
    } else if (supervisorRegAuth) {
      // Check if we're in registration context
      if (location.pathname.startsWith('/register-supervisor/')) {
        return <Navigate to="/register-supervisor/home" replace />;
      } else {
        return <Navigate to="/register-supervisor/home" replace />;
      }
    } else if (selectedSupervisorAuth) {
      return <Navigate to="/supervisor-dashboard" replace />;
    }
  }

  // If no user is authenticated, show the guest routes
  return children;
};

export default AuthGuard;