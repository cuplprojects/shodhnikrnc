/**
 * Office Dashboard Service
 * Handles all API calls for the flexible dashboard system
 * Supports multiple modules and user permissions
 */
import API from './API';

/**
 * Get dashboard statistics based on user permissions and module access
 * @param {Object} params - Dashboard parameters
 * @param {number} params.regType - Optional registration type filter
 * @returns {Promise} API response with dashboard stats
 */
export const getDashboardStats = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add regType filter if provided
    if (params.regType) {
      queryParams.append('regType', params.regType);
    }
    
    const response = await API.get(`/OfficeDashboard/PHD-Admission-Dashboard?${queryParams.toString()}`);
    
    console.log('Dashboard Stats Response:', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      success: false,
      data: {
        totalApplicants: 0,
        screening: 0,
        rejectScreening: 0,
        interviewScheduled: 0,
        interviewPassed: 0,
        interviewFail: 0,
        counsellingScheduled: 0,
        counsellingDone: 0
      },
      error: error.message
    };
  }
};

/**
 * Get detailed data for a specific dashboard card/metric
 * @param {Object} params - Query parameters
 * @param {string} params.type - Type of data to fetch (all, screening, interview-scheduled, etc.)
 * @param {number} params.regType - Optional registration type filter
 * @returns {Promise} API response with detailed data
 */
export const getDashboardDetails = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add required type parameter
    if (params.type) {
      queryParams.append('type', params.type);
    }
    
    // Add regType filter if provided
    if (params.regType) {
      queryParams.append('regType', params.regType);
    }
    
    const response = await API.get(`/OfficeDashboard/PHD-Admission?${queryParams.toString()}`);
    
    console.log('Dashboard Details Response:', response.data);
    
    return {
      success: true,
      data: response.data || []
    };
  } catch (error) {
    console.error('Error fetching dashboard details:', error);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
};

/**
 * Dashboard configuration based on user permissions
 * This defines what modules/cards each role can see
 */
export const getDashboardConfig = (userPermissions = []) => {
  // Base dashboard cards configuration
  const allCards = [
    {
      id: 'total_applicants',
      title: 'Total Applicants',
      key: 'totalApplicants',
      color: 'blue',
      icon: 'users',
      permission: 'phd_applications.read',
      apiType: 'all',
      description: 'Total number of PhD applications'
    },
    {
      id: 'screening',
      title: 'Screening',
      key: 'screening',
      color: 'orange',
      icon: 'search',
      permission: 'phd_applications.read',
      apiType: 'screening',
      description: 'Applications in screening process'
    },
    {
      id: 'reject_screening',
      title: 'Rejected Screening',
      key: 'rejectScreening',
      color: 'red',
      icon: 'x-circle',
      permission: 'phd_applications.read',
      apiType: 'reject-screening',
      description: 'Applications rejected in screening'
    },
    {
      id: 'interview_scheduled',
      title: 'Interview Scheduled',
      key: 'interviewScheduled',
      color: 'purple',
      icon: 'calendar',
      permission: 'phd_applications.read',
      apiType: 'interview-scheduled',
      description: 'Interviews scheduled'
    },
    {
      id: 'interview_passed',
      title: 'Interview Passed',
      key: 'interviewPassed',
      color: 'green',
      icon: 'check-circle',
      permission: 'phd_applications.read',
      apiType: 'interview-passed',
      description: 'Candidates who passed interview'
    },
    {
      id: 'interview_failed',
      title: 'Interview Failed',
      key: 'interviewFail',
      color: 'red',
      icon: 'x-circle',
      permission: 'phd_applications.read',
      apiType: 'interview-failed',
      description: 'Candidates who failed interview'
    },
    {
      id: 'counselling_scheduled',
      title: 'Counselling Scheduled',
      key: 'counsellingScheduled',
      color: 'cyan',
      icon: 'message-circle',
      permission: 'phd_applications.read',
      apiType: 'counselling-scheduled',
      description: 'Counselling sessions scheduled'
    },
    {
      id: 'counselling_done',
      title: 'Counselling Done',
      key: 'counsellingDone',
      color: 'green',
      icon: 'check-circle-2',
      permission: 'phd_applications.read',
      apiType: 'counselling-done',
      description: 'Completed counselling sessions'
    }
  ];

  // Filter cards based on user permissions
  const availableCards = allCards.filter(card => {
    // If no permissions provided, show all cards (for backward compatibility)
    if (!userPermissions || userPermissions.length === 0) {
      return true;
    }
    
    // Check if user has the required permission for this card
    return userPermissions.some(permission => 
      permission === card.permission || 
      permission.startsWith(card.permission.split('.')[0])
    );
  });

  return {
    cards: availableCards,
    layout: {
      columns: 4, // Number of columns in the grid
      responsive: {
        xs: 1,
        sm: 2,
        md: 3,
        lg: 4,
        xl: 4
      }
    }
  };
};

/**
 * Registration type filters configuration
 */
export const getRegTypeFilters = () => {
  return [
    { value: null, label: 'All Registration Types', color: 'default' },
    { value: 1, label: 'Research Entrance Test (RET)', color: 'blue' },
    { value: 2, label: 'RET Exemption - NET/JRF', color: 'green' },
    { value: 3, label: 'RET Exemption - M.Phil', color: 'purple' },
    { value: 4, label: 'RET Exemption - Other', color: 'orange' },
    { value: 5, label: 'RET Exemption - Faculty', color: 'cyan' },
    { value: 6, label: 'Foreign Students - Regular', color: 'red' },
    { value: 7, label: 'Foreign Students - ICCR', color: 'pink' },
    { value: 8, label: 'Foreign Students - Self Finance', color: 'yellow' },
    { value: 9, label: 'Foreign Students - Other', color: 'lime' }
  ];
};

/**
 * Get user permissions from context/auth
 * This should be integrated with your auth system
 */
export const getUserPermissions = () => {
  // This should come from your auth context or JWT token
  // For now, returning a default set
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.permissions || [];
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (permission, userPermissions = null) => {
  const permissions = userPermissions || getUserPermissions();
  return permissions.includes(permission) || 
         permissions.some(p => p.startsWith(permission.split('.')[0]));
};

export default {
  getDashboardStats,
  getDashboardDetails,
  getDashboardConfig,
  getRegTypeFilters,
  getUserPermissions,
  hasPermission
};