// components/RegRoutes.jsx
import { Navigate } from "react-router-dom";
import useScholarRegAuthStore from "@/store/scholarRegAuthStore";
import useSupervisorRegAuthStore from "@/store/supervisorRegAuthStore";
import useSelectedScholarAuthStore from "@/store/selectedScholarAuthStore";
import useSupervisorAuthStore from "@/store/supervisorAuthStore";
import useStaffAuthStore from "@/store/staffAuthStore";

const RegRoutes = ({ children, type, mode }) => {
  // Get all auth stores
  const scholarRegAuth = useScholarRegAuthStore();
  const supervisorRegAuth = useSupervisorRegAuthStore();
  const selectedScholarAuth = useSelectedScholarAuthStore();
  const selectedSupervisorAuth = useSupervisorAuthStore();
  const staffAuth = useStaffAuthStore();
  
  // Select the appropriate auth store for this route
  const authStore = type === 'scholar' ? scholarRegAuth : supervisorRegAuth;
  const { isAuthenticated, isInitialized } = authStore;
  
  // Check if all auth stores are initialized before making decisions
  const allStoresInitialized = scholarRegAuth.isInitialized && supervisorRegAuth.isInitialized && 
                              selectedScholarAuth.isInitialized && selectedSupervisorAuth.isInitialized && 
                              staffAuth.isInitialized;
  const anyStoreLoading = scholarRegAuth.isLoading || supervisorRegAuth.isLoading || 
                         selectedScholarAuth.isLoading || selectedSupervisorAuth.isLoading || 
                         staffAuth.isLoading;

  // Show loading while any auth store is initializing
  if (anyStoreLoading || !allStoresInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }
  
  // Check if user is authenticated in any other auth store (conflicting auth)
  const hasConflictingAuth = () => {
    if (type === 'scholar') {
      // For scholar registration routes, check if user is authenticated as selected scholar, supervisor, or staff
      return selectedScholarAuth.isAuthenticated || selectedSupervisorAuth.isAuthenticated || staffAuth.isAuthenticated;
    } else {
      // For supervisor registration routes, check if user is authenticated as selected supervisor, scholar, or staff
      return selectedSupervisorAuth.isAuthenticated || selectedScholarAuth.isAuthenticated || staffAuth.isAuthenticated;
    }
  };

  // Check for conflicting authentication and redirect to appropriate dashboard
  if (hasConflictingAuth()) {
    if (selectedScholarAuth.isAuthenticated) {
      return <Navigate to="/scholar-dashboard" replace />;
    } else if (selectedSupervisorAuth.isAuthenticated) {
      return <Navigate to="/supervisor-dashboard" replace />;
    } else if (staffAuth.isAuthenticated) {
      return <Navigate to="/dashboard" replace />;
    }
  }



  // Handle guest routes
  if (mode === 'guest') {
    // If authenticated in the correct registration store, redirect to appropriate registration route
    if (isAuthenticated) {
      const redirectPath = type === 'scholar' 
        ? "/register-scholar/home" 
        : "/register-supervisor/personal-info";
      return <Navigate to={redirectPath} replace />;
    }
    // If not authenticated, show guest routes
    return children;
  }

  // Handle registration routes
  if (mode === 'reg') {
    // If not authenticated in the correct registration store, redirect to appropriate login
    if (!isAuthenticated) {
      const loginPath = type === 'scholar' 
        ? "/register-scholar/login" 
        : "/register-supervisor/login";
      return <Navigate to={loginPath} replace />;
    }
    // If authenticated in the correct registration store, show registration routes
    return children;
  }

  // Fallback
  return children;
};

export default RegRoutes;