/**
 * Dean Office Service (Level 4)
 * Handles all API calls related to Dean Office functionality
 */
import API from './API';

/**
 * Fetch all supervisors for Dean Office screening (Level 4)
 * GET /SupervisorScreening/level4
 * @param {Object} params - Query parameters (optional)
 * @returns {Promise} API response
 */
export const getDeanOfficeSupervisorScreenings = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add pagination and other params
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== 'statsOnly' && key !== 'status') queryParams.append(key, value);
    });
    
    // Use Level 4 endpoint for Dean Office
    const response = await API.get(`/SupervisorScreening/stage4-eligible`);
    
    // Map the response to match expected format
    let mappedData = response.data.map(item => ({
      key: item.supId,
      supId: item.supId,
      applicationNo: item.applicationNo || item.applicationNumber,
      name: item.name,
      designation: item.designation,
      subject: item.subject,
      mobileNo: item.mobileNo,
      status: getStatusFromScreening(item),
      form: 'Level 4', // Dean Office screening level
      deptEst: item.deptEst,
      screening1Status: item.screening1Status,
      screening1Count: item.screening1Count,
      screening2Status: item.screening2Status,
      screening2Count: item.screening2Count,
      screening3Status: item.screening3Status,
      screening3Count: item.screening3Count,
      screening4Status: item.screening4Status || 0,
      screening4Count: item.screening4Count || 0,
      originalData: item
    }));
    
    // Calculate stats from full dataset before filtering
    const fullDataStats = params.statsOnly ? getStatsFromData(mappedData) : undefined;
    
    // Apply status filtering client-side
    if (Array.isArray(params.status) && params.status.length > 0) {
      mappedData = mappedData.filter(item => params.status.includes(item.status));
    } else if (typeof params.status === 'string' && params.status !== 'all' && params.status) {
      mappedData = mappedData.filter(item => item.status === params.status);
    }
    
    // Apply search filtering client-side if search term exists
    if (params.search && params.search.trim()) {
      const searchTerm = params.search.toLowerCase().trim();
      mappedData = mappedData.filter(item => 
        item.applicationNo?.toLowerCase().includes(searchTerm) ||
        item.name?.toLowerCase().includes(searchTerm) ||
        item.designation?.toLowerCase().includes(searchTerm) ||
        item.subject?.toLowerCase().includes(searchTerm) ||
        item.mobileNo?.includes(searchTerm)
      );
    }
    
    // Apply pagination client-side
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = mappedData.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      total: mappedData.length,
      page: page,
      pageSize: pageSize,
      stats: fullDataStats
    };
  } catch (error) {
    console.error('Error fetching Dean Office supervisor screenings:', error);
    throw error;
  }
};

/**
 * Get status string from screening data for Dean Office (Level 4)
 * @param {Object} supervisor - Supervisor data with screening info
 * @returns {string} Status string
 */
const getStatusFromScreening = (supervisor) => {
  const screening4Status = supervisor.screening4Status || 0;
  
  // For Dean Office (Level 4), focus on screening4Status
  if (screening4Status === 1) return 'Approved';
  if (screening4Status === 2) return 'Rejected';
  return 'Pending';
};

/**
 * Get statistics from data
 * @param {Array} data - Supervisor data
 * @returns {Object} Statistics
 */
const getStatsFromData = (data) => {
  const total = data.length;
  const approved = data.filter(item => item.status === 'Approved').length;
  const rejected = data.filter(item => item.status === 'Rejected').length;
  const pending = data.filter(item => item.status === 'Pending').length;
  
  return {
    total,
    approved,
    rejected,
    pending
  };
};

/**
 * Fetch supervisor personal details for Dean Office view
 * @param {string|number} id - Supervisor ID
 * @returns {Promise} API response
 */
export const fetchDeanOfficeSupervisorDetails = async (id) => {
  try {
    const response = await API.get(`/SupervisorApplicationStatus/SupervisorDetails/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching supervisor details:', error);
    throw error;
  }
};

/**
 * Fetch screening data for a supervisor
 * @param {string|number} id - Supervisor ID
 * @returns {Promise} API response
 */
export const fetchDeanOfficeScreeningData = async (id) => {
  try {
    const response = await API.get(`/SupervisorApplicationStatus/ScreeningData/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching screening data:', error);
    throw error;
  }
};

/**
 * Create or update screening for Dean Office (Level 4)
 * @param {Object} data - Screening data
 * @returns {Promise} API response
 */
export const createOrUpdateDeanOfficeScreening = async (data) => {
  try {
    const response = await API.post('/SupervisorApplicationStatus/DeanOfficeScreening', data);
    return response.data;
  } catch (error) {
    console.error('Error updating Dean Office screening:', error);
    throw error;
  }
};

const DeanOfficeService = {
  getDeanOfficeSupervisorScreenings,
  fetchDeanOfficeSupervisorDetails,
  fetchDeanOfficeScreeningData,
  createOrUpdateDeanOfficeScreening
};

export default DeanOfficeService;
