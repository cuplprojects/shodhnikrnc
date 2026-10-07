/**
 * Office Dashboard Page
 * Main dashboard that adapts to user permissions and shows relevant modules
 */
import React, { useState } from 'react';
import { Card, Tabs, Button, Space, Tooltip, Alert, Spin } from 'antd';
import { Settings, RefreshCw, BarChart3, Shield } from 'lucide-react';
import FlexibleDashboard from '@/components/dashboard/FlexibleDashboard';
import DashboardDetailsModal from '@/components/dashboard/DashboardDetailsModal';
import useDashboardPermissions from '@/hooks/useDashboardPermissions';

const { TabPane } = Tabs;

const OfficeDashboard = () => {
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedCardData, setSelectedCardData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  // Get user permissions and dashboard configuration
  const {
    permissions,
    loading: permissionsLoading,
    getDashboardConfig,
    canAccess,
    user
  } = useDashboardPermissions();

  const dashboardConfig = getDashboardConfig();

  // Handle dashboard card click
  const handleCardClick = (cardData) => {
    if (canAccess.viewDetails()) {
      setSelectedCardData(cardData);
      setDetailsModalVisible(true);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setDetailsModalVisible(false);
    setSelectedCardData(null);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Dashboard configurations for different views
  const dashboardConfigs = {
    overview: {
      title: "Multi-Module Dashboard",
      subtitle: `Welcome ${user.userName}! Here's an overview of all accessible modules.`,
      showRegTypeFilter: canAccess.regTypeFilter(),
      permissions: permissions
    },
    admission_cell: {
      title: "Admission Cell Dashboard", 
      subtitle: "Manage PhD applications and admission processes",
      showRegTypeFilter: true,
      permissions: permissions.filter(p => 
        p.includes('phd_applications') || p.includes('admission_cell')
      )
    },
    office: {
      title: "Office Dashboard",
      subtitle: "Administrative overview and office management",
      showRegTypeFilter: canAccess.regTypeFilter(),
      permissions: permissions.filter(p => 
        p.includes('scholar_synopsis') || 
        p.includes('pending_course_work') || 
        p.includes('supervisor_consent') ||
        p.includes('upcoming_rdc') ||
        p.includes('rdc_proceedings_office')
      )
    },
    director: {
      title: "Director Dashboard",
      subtitle: "Director of Research overview and supervision",
      showRegTypeFilter: false,
      permissions: permissions.filter(p => 
        p.includes('director') || 
        p.includes('departments') || 
        p.includes('provisional_supervisors')
      )
    },
    vc_office: {
      title: "VC Office Dashboard",
      subtitle: "Vice Chancellor office management and proceedings",
      showRegTypeFilter: false,
      permissions: permissions.filter(p => 
        p.includes('rdc_proceedings') || 
        p.includes('vc_examiners') || 
        p.includes('vc_thesis')
      )
    },
    supervisor_cell: {
      title: "Supervisor Recognition Cell",
      subtitle: "Supervisor applications and recognition processes",
      showRegTypeFilter: false,
      permissions: permissions.filter(p => 
        p.includes('supervisor_applications')
      )
    }
  };

  // Loading state
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="Loading dashboard permissions..." />
      </div>
    );
  }

  // No access state
  if (!dashboardConfig.canAccessDashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <Shield size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access the dashboard. Please contact your administrator.
            </p>
            <Button type="primary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Get current dashboard config
  const currentConfig = dashboardConfigs[activeTab] || dashboardConfigs.overview;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Role: <span className="font-medium">{dashboardConfig.userRole}</span>
                <span className="mx-2">•</span>
                Modules: <span className="font-medium">{dashboardConfig.modules.length}</span>
              </p>
            </div>
            
            <Space>
              <Tooltip title="Refresh Dashboard">
                <Button 
                  icon={<RefreshCw size={16} />} 
                  onClick={handleRefresh}
                >
                  Refresh
                </Button>
              </Tooltip>
              
              <Tooltip title="Dashboard Settings">
                <Button 
                  icon={<Settings size={16} />}
                  type="default"
                >
                  Settings
                </Button>
              </Tooltip>
            </Space>
          </div>
        </div>

        {/* Permissions Alert */}
        {dashboardConfig.modules.length === 0 && (
          <Alert
            message="Limited Access"
            description="You have basic dashboard access but no specific module permissions. Contact your administrator to request additional access."
            type="warning"
            showIcon
            className="mb-6"
          />
        )}

        {/* Dashboard Tabs */}
        <Card className="shadow-sm">
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            type="card"
            tabBarExtraContent={
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BarChart3 size={16} />
                <span>Analytics</span>
              </div>
            }
          >
            {/* Overview Tab - Always available */}
            <TabPane tab="Overview" key="overview">
              <FlexibleDashboard
                key={`overview-${refreshKey}`}
                title={currentConfig.title}
                subtitle={currentConfig.subtitle}
                onCardClick={handleCardClick}
                userPermissions={currentConfig.permissions}
                showRegTypeFilter={currentConfig.showRegTypeFilter}
              />
            </TabPane>

            {/* Dynamic Module Tabs */}
            {dashboardConfig.modules.map(module => (
              <TabPane tab={module.name} key={module.key}>
                <FlexibleDashboard
                  key={`${module.key}-${refreshKey}`}
                  title={dashboardConfigs[module.key]?.title || module.name}
                  subtitle={dashboardConfigs[module.key]?.subtitle || `${module.name} management and overview`}
                  onCardClick={handleCardClick}
                  userPermissions={module.permissions}
                  showRegTypeFilter={dashboardConfigs[module.key]?.showRegTypeFilter || false}
                />
              </TabPane>
            ))}
          </Tabs>
        </Card>

        {/* User Info Card */}
        <Card className="mt-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">User:</span>
              <span className="ml-2 font-medium">{user.userName}</span>
            </div>
            <div>
              <span className="text-gray-600">Role:</span>
              <span className="ml-2 font-medium">{dashboardConfig.userRole}</span>
            </div>
            <div>
              <span className="text-gray-600">Permissions:</span>
              <span className="ml-2 font-medium">{permissions.length} total</span>
            </div>
            <div>
              <span className="text-gray-600">Accessible Modules:</span>
              <span className="ml-2 font-medium">{dashboardConfig.modules.length}</span>
            </div>
          </div>
        </Card>

        {/* Module Access Summary */}
        {dashboardConfig.modules.length > 0 && (
          <Card className="mt-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-3">Module Access Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dashboardConfig.modules.map(module => (
                <div key={module.key} className="bg-gray-50 rounded-lg p-3">
                  <div className="font-medium text-gray-900">{module.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {module.permissions.length} permissions
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Details Modal */}
      <DashboardDetailsModal
        visible={detailsModalVisible}
        onClose={handleModalClose}
        cardData={selectedCardData}
      />
    </div>
  );
};

export default OfficeDashboard;