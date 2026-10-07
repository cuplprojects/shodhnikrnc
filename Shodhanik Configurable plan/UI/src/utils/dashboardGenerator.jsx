import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCard from "@/components/StatsCard.";
import { getIconComponent } from '@/utils/iconMapper';
import dashboardDataJson from '@/data/dashboardData.json';
import useStaffAuthStore from '@/store/staffAuthStore';

export const createRoleDashboard = (roleName, displayName) => {
  return () => {
    const navigate = useNavigate();
    const { user } = useStaffAuthStore();
    const [dashboardData, setDashboardData] = useState(null);

    useEffect(() => {
      // Load dashboard data for the specific role
      const roleData = dashboardDataJson[roleName] || dashboardDataJson['Super Admin'];
      setDashboardData(roleData);
    }, [user]);

    const handleViewClick = (title, navigateTo, status) => {
      console.log(`Viewing: ${title}, Navigate to: ${navigateTo}`);
      
      // Handle special routing for different roles
      if (navigateTo && navigateTo.includes('/screening/')) {
        const { screeningRoutes, screeningConfig } = dashboardDataJson;
        const statusParam = screeningRoutes[navigateTo] || screeningConfig.defaultStatus;
        navigate(`${screeningConfig.baseRoute}?status=${statusParam}`);
      } else if (navigateTo) {
        navigate(navigateTo);
      }
    };

    if (!dashboardData) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
          <div className="text-gray-600">Loading {displayName} dashboard...</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer transition-colors">Home</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-800 text-sm font-semibold">{displayName} Dashboard</span>
        </div>

        {/* Page Title */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{dashboardData.title || `${displayName} Dashboard`}</h1>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${dashboardData.stats?.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6`}>
          {dashboardData.stats?.map((item, index) => {
            const IconComponent = getIconComponent(item.icon);
            return (
              <StatsCard
                key={index}
                title={item.title}
                subtitle={item.subtitle}
                value={item.value}
                icon={IconComponent ? <IconComponent className="w-6 h-6" /> : null}
                buttonText={item.buttonText}
                buttonColor={item.buttonColor}
                navigateTo={item.navigateTo}
                status={item.status || 'neutral'}
                onClick={() => handleViewClick(item.title, item.navigateTo)}
              />
            );
          })}
        </div>
      </div>
    );
  };
};