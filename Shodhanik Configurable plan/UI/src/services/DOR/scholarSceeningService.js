/**
 * Director of Research Service (Level 5)
 * Handles all API calls related to Supervisor Screening functionality for Director of Research
 */
import API from '../API';

/**
 * Create a new supervisor screening record
 * POST /SupervisorScreening
 * @param {Object} data - Supervisor screening data
 * @returns {Promise} API response
 * 
 * Expected Request Body:
 * {
 *   "applicationNo": "25000001",
 *   "name": "Madhavi Tripathi",
 *   "designation": "string",
 *   "subject": "Ancient History and Culture / History",
 *   "mobileNo": "9415212679",
 *   "status": "Eligible",
 *   "form": "Stage 1"
 * }
 */
export const createSupervisorScreening = async (data) => {
  try {
    const response = await API.post('/SupervisorScreening', data);
    return response.data;
  } catch (error) {
    console.error('Error creating supervisor screening:', error);
    throw error;
  }
};

/**
 * Fetch all supervisor screening records for DOR (Level 5)
 * GET /SupervisorScreening/level5
 * @param {Object} params - Query parameters (optional)
 * @returns {Promise} API response
 * 
 * Expected Response Format:
 * [
 *   {
 *     "supId": 1,
 *     "name": "Ms. Madhavi Tripathi",
 *     "applicationNumber": "25000001",
 *     "mobileNo": "9415212679",
 *     "screening1Status": 1,
 *     "screening1Count": 1,
 *     "screening2Status": 0,
 *     "screening2Count": 0,
 *     "isAccepted": 1,
 *     "designation": "string",
 *     "deptEst": "2023",
 *     "subject": "Ancient History and Culture / History"
 *   }
 * ]
 */
export const getSupervisorScreenings = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination and other params (exclude status since we'll filter client-side)
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== 'statsOnly' && key !== 'status') queryParams.append(key, value);
    });

    // Use existing endpoint for Director of Research
    const response = await API.get(`/SupervisorScreening/stage5-eligible`);

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
      form: 'Level 5', // Director of Research screening level
      deptEst: item.deptEst,
      screening1Status: item.screening1Status,
      screening1Count: item.screening1Count,
      screening2Status: item.screening2Status,
      screening2Count: item.screening2Count,
      screening3Status: item.screening3Status,
      screening3Count: item.screening3Count,
      screening4Status: item.screening4Status || 0,
      screening4Count: item.screening4Count || 0,
      screening5Status: item.screening5Status || 0,
      screening5Count: item.screening5Count || 0,
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
    console.error('Error fetching supervisor screenings:', error);
    throw error;
  }
};

/**
 * Get status string from screening data for DOR (Level 5)
 * @param {Object} supervisor - Supervisor data with screening info
 * @returns {string} Status string
 */
const getStatusFromScreening = (supervisor) => {
  const screening5Status = supervisor.screening5Status || 0;

  // For Director of Research (Level 5), focus on screening5Status
  if (screening5Status === 1) return 'Eligible';
  if (screening5Status === 2) return 'Not Eligible';
  return 'Unscreened';
};

/**
 * Get statistics from data
 * @param {Array} data - Supervisor data (should be full dataset before filtering)
 * @returns {Object} Statistics
 */
const getStatsFromData = (data) => {
  const total = data.length;
  const eligible = data.filter(item => item.status === 'Eligible').length;
  const notEligible = data.filter(item => item.status === 'Not Eligible').length;
  const unscreened = data.filter(item => item.status === 'Unscreened').length;

  return {
    total,
    eligible,
    not_eligible: notEligible,
    unscreened,
    review: 0 // No review status in this context
  };
};

/**
 * Update a supervisor screening record
 * PATCH /SupervisorScreening/{id}
 * @param {string|number} id - Supervisor screening ID (supId)
 * @param {Object} data - Updated supervisor screening data
 * @returns {Promise} API response
 * 
 * Expected Request Body:
 * {
 *   "status": "Eligible" | "Not Eligible" | "Unscreened" | "For Review",
 *   "form": "Stage 1" | "Stage 2" | etc.
 * }
 */
export const updateSupervisorScreening = async (id, data) => {
  try {
    const response = await API.patch(`/SupervisorScreening/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating supervisor screening:', error);
    throw error;
  }
};

/**
 * Create or update screening for Director of Research (Level 5)
 * @param {Object} data - Screening data
 * @returns {Promise} API response
 */
export const createOrUpdateDORScreening = async (data) => {
  try {
    const response = await API.post('/SupervisorApplicationStatus/DORScreening', data);
    return response.data;
  } catch (error) {
    console.error('Error updating DOR screening:', error);
    throw error;
  }
};

/**
 * Fetch supervisor personal details for DOR view
 * @param {string|number} id - Supervisor ID
 * @returns {Promise} API response
 */
export const fetchDORSupervisorDetails = async (id) => {
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
export const fetchDORScreeningData = async (id) => {
  try {
    const response = await API.get(`/SupervisorApplicationStatus/ScreeningData/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching screening data:', error);
    throw error;
  }
};

const scholarScreeningService = {
  createSupervisorScreening,
  getSupervisorScreenings,
  updateSupervisorScreening,
  createOrUpdateDORScreening,
  fetchDORSupervisorDetails,
  fetchDORScreeningData
};

export default scholarScreeningService;