// components/GuestRoutes.jsx
import { Navigate } from "react-router-dom";
import useStaffAuthStore from "@/store/staffAuthStore";

const GuestRoutes = ({ children }) => {
    const { isAuthenticated, isInitialized, isLoading } = useStaffAuthStore();

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

    // If authenticated, redirect to dashboard
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    // If not authenticated, show guest routes
    return children;
};

export default GuestRoutes;
