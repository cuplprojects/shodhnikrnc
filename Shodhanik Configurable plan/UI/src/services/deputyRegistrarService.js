/**
 * Deputy Registrar Service (Level 2)
 * Handles all API calls related to Deputy Registrar functionality
 */
import API from './API';

/**
 * Fetch all supervisors for Deputy Registrar screening (Level 2)
 * GET /SupervisorScreening/level2
 * @param {Object} params - Query parameters (optional)
 * @returns {Promise} API response
 */
export const getDeputyRegistrarSupervisorScreenings = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add pagination and other params
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== 'statsOnly' && key !== 'status') queryParams.append(key, value);
    });
    
    // Use Level 2 endpoint for Deputy Registrar
    const response = await API.get(`/SupervisorScreening/stage2-eligible`);
    
    // Map the response to match expected format
    let mappedData = response.data.map(item => ({
      key: item.supId,
      supId: item.supId,
      applicationNo: item.applicationNo,
      name: item.name,
      designation: item.designation,
      subject: item.subject,
      mobileNo: item.mobileNo,
      status: getStatusFromScreening(item),
      form: 'Level 2', // Deputy Registrar screening level
      deptEst: item.deptEst,
      screening1Status: item.screening1Status,
      screening1Count: item.screening1Count,
      screening2Status: item.screening2Status,
      screening2Count: item.screening2Count,
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
    console.error('Error fetching Deputy Registrar supervisor screenings:', error);
    throw error;
  }
};

/**
 * Get status string from screening data for Deputy Registrar (Level 2)
 * @param {Object} supervisor - Supervisor data with screening info
 * @returns {string} Status string
 */
const getStatusFromScreening = (supervisor) => {
  const screening2Status = supervisor.screening2Status || 0;
  
  // For Deputy Registrar (Level 2), focus on screening2Status
  if (screening2Status === 1) return 'Eligible';
  if (screening2Status === 2) return 'Not Eligible';
  return 'Unscreened';
};

/**
 * Get statistics from data
 * @param {Array} data - Supervisor data
 * @returns {Object} Statistics
 */
const getStatsFromData = (data) => {
  const total = data.length;
  const eligible = data.filter(item => item.status === 'Eligible').length;
  const not_eligible = data.filter(item => item.status === 'Not Eligible').length;
  const unscreened = data.filter(item => item.status === 'Unscreened').length;
  
  return {
    total,
    eligible,
    not_eligible,
    unscreened
  };
};

/**
 * Fetch supervisor personal details for Deputy Registrar view
 * @param {string|number} id - Supervisor ID
 * @returns {Promise} API response
 */
export const fetchDeputyRegistrarSupervisorDetails = async (id) => {
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
export const fetchDeputyRegistrarScreeningData = async (id) => {
  try {
    const response = await API.get(`/SupervisorApplicationStatus/ScreeningData/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching screening data:', error);
    throw error;
  }
};

/**
 * Create or update screening for Deputy Registrar (Level 2)
 * @param {Object} data - Screening data
 * @returns {Promise} API response
 */
export const createOrUpdateDeputyRegistrarScreening = async (data) => {
  try {
    const response = await API.post('/SupervisorApplicationStatus/Level2Screening', data);
    return response.data;
  } catch (error) {
    console.error('Error updating Deputy Registrar screening:', error);
    throw error;
  }
};

const DeputyRegistrarService = {
  getDeputyRegistrarSupervisorScreenings,
  fetchDeputyRegistrarSupervisorDetails,
  fetchDeputyRegistrarScreeningData,
  createOrUpdateDeputyRegistrarScreening
};

export default DeputyRegistrarService;
