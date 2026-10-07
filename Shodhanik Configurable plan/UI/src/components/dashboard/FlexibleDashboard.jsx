/**
 * Flexible Dashboard Component
 * Renders dashboard cards based on user permissions and module access
 */
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Spin, Alert, Button, Tooltip } from 'antd';
import { 
  Users, 
  Search, 
  XCircle, 
  Calendar, 
  CheckCircle, 
  CheckCircle2, 
  MessageCircle,
  Eye,
  Filter
} from 'lucide-react';
import { getDashboardStats, getDashboardConfig, getRegTypeFilters, getUserPermissions } from '@/services/officeDashboardService';

const { Option } = Select;

// Icon mapping
const iconMap = {
  users: Users,
  search: Search,
  'x-circle': XCircle,
  calendar: Calendar,
  'check-circle': CheckCircle,
  'check-circle-2': CheckCircle2,
  'message-circle': MessageCircle
};

const FlexibleDashboard = ({ 
  title = "Dashboard",
  subtitle = "Overview of applications and processes",
  onCardClick = null,
  userPermissions = null,
  showRegTypeFilter = true,
  customCards = null
}) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [selectedRegType, setSelectedRegType] = useState(null);
  const [error, setError] = useState(null);
  const [dashboardConfig, setDashboardConfig] = useState({ cards: [], layout: {} });

  // Get user permissions
  const permissions = userPermissions || getUserPermissions();
  
  // Get registration type filters
  const regTypeFilters = getRegTypeFilters();

  // Initialize dashboard configuration
  useEffect(() => {
    const config = getDashboardConfig(permissions);
    setDashboardConfig(config);
  }, [permissions]);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedRegType) {
        params.regType = selectedRegType;
      }

      const response = await getDashboardStats(params);
      
      if (response.success) {
        setStats(response.data);
      } else {
        setError(response.error || 'Failed to fetch dashboard data');
        setStats({});
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('An unexpected error occurred');
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [selectedRegType]);

  // Handle registration type filter change
  const handleRegTypeChange = (value) => {
    setSelectedRegType(value);
  };

  // Handle card click
  const handleCardClick = (card) => {
    if (onCardClick) {
      onCardClick({
        cardId: card.id,
        apiType: card.apiType,
        regType: selectedRegType,
        title: card.title,
        count: stats[card.key] || 0
      });
    }
  };

  // Get icon component
  const getIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Users;
    return <IconComponent size={24} />;
  };

  // Get color class for cards
  const getColorClass = (color) => {
    const colorMap = {
      blue: 'text-blue-600 bg-blue-50 border-blue-200',
      green: 'text-green-600 bg-green-50 border-green-200',
      red: 'text-red-600 bg-red-50 border-red-200',
      orange: 'text-orange-600 bg-orange-50 border-orange-200',
      purple: 'text-purple-600 bg-purple-50 border-purple-200',
      cyan: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      pink: 'text-pink-600 bg-pink-50 border-pink-200'
    };
    return colorMap[color] || colorMap.blue;
  };

  // Use custom cards if provided, otherwise use config cards
  const cardsToRender = customCards || dashboardConfig.cards;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-1">{subtitle}</p>
        </div>
        
        {/* Registration Type Filter */}
        {showRegTypeFilter && (
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <Select
              placeholder="Filter by Registration Type"
              value={selectedRegType}
              onChange={handleRegTypeChange}
              allowClear
              style={{ minWidth: 250 }}
            >
              {regTypeFilters.map(filter => (
                <Option key={filter.value} value={filter.value}>
                  {filter.label}
                </Option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message="Error Loading Dashboard"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchDashboardData}>
              Retry
            </Button>
          }
        />
      )}

      {/* Dashboard Cards Grid */}
      <Row gutter={[16, 16]}>
        {cardsToRender.map((card) => {
          const count = stats[card.key] || 0;
          const colorClass = getColorClass(card.color);
          
          return (
            <Col
              key={card.id}
              xs={24}
              sm={12}
              md={8}
              lg={6}
              xl={6}
            >
              <Card
                hoverable={!!onCardClick}
                className={`h-full transition-all duration-200 hover:shadow-lg cursor-pointer border-2 ${colorClass}`}
                onClick={() => handleCardClick(card)}
                bodyStyle={{ padding: '20px' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Statistic
                      title={
                        <Tooltip title={card.description}>
                          <span className="text-sm font-medium text-gray-600">
                            {card.title}
                          </span>
                        </Tooltip>
                      }
                      value={count}
                      valueStyle={{ 
                        fontSize: '28px', 
                        fontWeight: 'bold',
                        color: 'inherit'
                      }}
                    />
                  </div>
                  <div className="ml-4 opacity-80">
                    {getIcon(card.icon)}
                  </div>
                </div>
                
                {/* Action Button */}
                {onCardClick && count > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<Eye size={14} />}
                      className="p-0 h-auto text-current"
                    >
                      View Details
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* No Data Message */}
      {cardsToRender.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <Users size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dashboard Data</h3>
          <p className="text-gray-600">
            {permissions.length === 0 
              ? "You don't have permission to view dashboard data."
              : "No dashboard cards are configured for your role."
            }
          </p>
        </div>
      )}

      {/* Summary Footer */}
      {cardsToRender.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {cardsToRender.length} metrics
              {selectedRegType && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  Filtered by Registration Type
                </span>
              )}
            </span>
            <span>
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlexibleDashboard;