// components/ProtectedRoutes.jsx
import { Navigate } from "react-router-dom";
import useStaffAuthStore from "@/store/staffAuthStore";

const ProtectedRoutes = ({ children }) => {
  const { isAuthenticated, isInitialized } = useStaffAuthStore();

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoutes;
