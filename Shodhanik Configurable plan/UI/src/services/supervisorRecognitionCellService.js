/**
 * Supervisor Recognition Cell Service
 * Handles all API calls related to Supervisor Recognition Cell functionality
 */
import API from './API';

/**
 * Map supervisor data to table format
 * @param {Array} supervisors - Raw supervisor data from API
 * @returns {Array} Mapped data for table
 */
const mapSupervisorDataToTable = (supervisors) => {
  return supervisors.map((supervisor, index) => ({
    key: supervisor.supId, // Unique key for React table
    applicationId: supervisor.applicationNumber,
    applicantName: supervisor.name,
    designation: supervisor.designation,
    subject: supervisor.subject,
    phone: supervisor.mobileNo,
    deptEst: supervisor.deptEst,
    supId: supervisor.supId,
    // Include screening data
    screening1Status: supervisor.screening1Status || 0,
    screening1Count: supervisor.screening1Count || 0,
    screening2Status: supervisor.screening2Status || 0,
    screening2Count: supervisor.screening2Count || 0,
    isAccepted: supervisor.isAccepted || 0,
    // Keep original data for reference
    originalData: supervisor
  }));
};

/**
 * Fetch applications with pagination, search, filter, and sort
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.pageSize - Items per page
 * @param {string} params.search - Search query
 * @param {Array|string} params.status - Filter by status (array or comma-separated string)
 * @param {string} params.sortField - Field to sort by
 * @param {string} params.sortOrder - Sort order (ascend/descend)
 * @param {boolean} params.screening1Only - If true, only return screening1Status = 1
 * @returns {Promise} API response
 */
export const fetchApplications = async (params = {}) => {
  // Build query params with status filter
  const statusParam = Array.isArray(params.status) && params.status.length > 0
    ? params.status.join(',')
    : '';

  const queryParams = new URLSearchParams({
    page: params.page || 1,
    pageSize: params.pageSize || 10,
    ...(params.search && { search: params.search }),
    ...(statusParam && { status: statusParam }),
    ...(params.sortField && { sortField: params.sortField }),
    ...(params.sortOrder && { sortOrder: params.sortOrder }),
  });

  const response = await API.get(`SupervisorApplicationStatus/CompletedSupervisorsWithDetails?${queryParams}`);

  // Map the response data to table format
  const mappedData = mapSupervisorDataToTable(response.data.data || []);

  return {
    data: mappedData,
    total: response.data.total || 0,
    page: response.data.page || params.page || 1,
    pageSize: response.data.pageSize || params.pageSize || 10
  };
};

/**
 * Update application screening status
 * @param {string} id - Application ID
 * @param {Object} data - Screening data
 * @param {number} data.isAccepted - Acceptance status (0 for unscreened, 1 for accepted, 2 for rejected, 3 for re-verification rejection)
 * @param {string} data.rejectReason - Rejection reason (required if rejected)
 * @returns {Promise} API response
 */
export const updateApplicationScreening = async (id, data) => {
  const response = await API.put(`SupervisorRegistration/Acceptance/${id}`, data);
  return response.data;
};


/**
 * Get status counts for dashboard
 * @returns {Promise} API response with status counts
 */
export const getStatusCounts = async () => {
  const response = await API.get(`SupervisorApplicationStatus/stats`);
  return response.data;
};

/**
 * Fetch supervisor personal details
 * @param {number} id - Supervisor ID
 * @returns {Promise} Raw API response with supervisor details
 */
export const fetchSupervisorPersonalDetails = async (id) => {
  const response = await API.get(`SupervisorPersonals/AllDetail?id=${id}`);
  return response.data;
};

/**
 * Fetch screening data for a supervisor
 * @param {number} supId - Supervisor ID
 * @returns {Promise} Screening data
 */
export const fetchScreeningData = async (supId) => {
  try {
    const response = await API.get(`SupervisorScreening/${supId}`);
    const apiData = response.data;

    // Extract screening data from nested object
    const data = apiData.screening || {};

    // Ensure all properties have default values
    return {
      id: data.id || 0,
      supId: data.supId || parseInt(supId),
      screening1Status: data.screening1Status || 0,
      screening2Status: data.screening2Status || 0,
      screening3Status: data.screening3Status || 0,
      screening4Status: data.screening4Status || 0,
      screening5Status: data.screening5Status || 0,
      screening6Status: data.screening6Status || 0,
      screening1Count: data.screening1Count || 0,
      screening2Count: data.screening2Count || 0,
      screening3Count: data.screening3Count || 0,
      screening4Count: data.screening4Count || 0,
      screening5Count: data.screening5Count || 0,
      screening6Count: data.screening6Count || 0,
      screening1Remark1: data.screening1Remark1 || "",
      screeningRemark2: data.screeningRemark2 || "",
      screening2Remark1: data.screening2Remark1 || "",
      screening2Remark2: data.screening2Remark2 || "",
      screening3Remark1: data.screening3Remark1 || "",
      screening3Remark2: data.screening3Remark2 || "",
      screening4Remark1: data.screening4Remark1 || "",
      screening4Remark2: data.screening4Remark2 || "",
      screening5Remark1: data.screening5Remark1 || "",
      screening5Remark2: data.screening5Remark2 || "",
      screening6Remark1: data.screening6Remark1 || "",
      screening6Remark2: data.screening6Remark2 || "",
      user1: data.user1 || "",
      user2: data.user2 || "",
      user3: data.user3 || "",
      user4: data.user4 || "",
      user5: data.user5 || "",
      user6: data.user6 || "",
      // Include user names from the API response
      user1Name: apiData.user1Name || "",
      user2Name: apiData.user2Name || "",
      user3Name: apiData.user3Name || "",
      user4Name: apiData.user4Name || "",
      user5Name: apiData.user5Name || "",
      user6Name: apiData.user6Name || "",
      screening1Time: data.screening1Time || null,
      screening2Time: data.screening2Time || null,
      screening3Time: data.screening3Time || null,
      screening4Time: data.screening4Time || null,
      screening5Time: data.screening5Time || null,
      screening6Time: data.screening6Time || null,
    };
  } catch (error) {
    console.error("Error fetching screening data:", error);
    // Return default screening data if error occurs
    return {
      id: 0,
      supId: parseInt(supId),
      screening1Status: 0,
      screening2Status: 0,
      screening3Status: 0,
      screening4Status: 0,
      screening5Status: 0,
      screening6Status: 0,
      screening1Count: 0,
      screening2Count: 0,
      screening3Count: 0,
      screening4Count: 0,
      screening5Count: 0,
      screening6Count: 0,
      screening1Remark1: "",
      screeningRemark2: "",
      screening2Remark1: "",
      screening2Remark2: "",
      screening3Remark1: "",
      screening3Remark2: "",
      screening4Remark1: "",
      screening4Remark2: "",
      screening5Remark1: "",
      screening5Remark2: "",
      screening6Remark1: "",
      screening6Remark2: "",
      user1: "",
      user2: "",
      user3: "",
      user4: "",
      user5: "",
      user6: "",
      user1Name: "",
      user2Name: "",
      user3Name: "",
      user4Name: "",
      user5Name: "",
      user6Name: "",
      screening1Time: null,
      screening2Time: null,
      screening3Time: null,
      screening4Time: null,
      screening5Time: null,
      screening6Time: null,
    };
  }
};

/**
 * Create or update supervisor screening
 * @param {Object} screeningData - Screening data
 * @param {number} screeningData.supId - Supervisor ID
 * @param {string} screeningData.screening1Remark1 - First screening remark
 * @param {string} screeningData.screeningRemark2 - Second screening remark
 * @param {number} screeningData.screening1Status - Screening 1 status (1: provisional accepted, 2: rejected)
 * @param {number} screeningData.screening2Status - Screening 2 status (1: final accepted, 2: final rejected)
 * @param {string} screeningData.user1 - First user
 * @param {string} screeningData.user2 - Second user
 * @returns {Promise} API response
 */
export const createOrUpdateScreening = async (screeningData) => {
  const response = await API.post('SupervisorScreening', screeningData);
  return response.data;
};

/**
 * Fetch Stage 1 screening data (for SupervisorCell)
 * @returns {Promise} API response with Stage 1 data
 */
export const fetchStage1Data = async () => {
  const response = await API.get('SupervisorScreening');
  return response.data;
};

/**
 * Fetch Stage 2 eligible data (for DirectorOfResearch)
 * @returns {Promise} API response with Stage 2 eligible data
 */
export const fetchStage2EligibleData = async () => {
  const response = await API.get('SupervisorScreening/stage2-eligible');
  return response.data;
};

/**
 * Fetch applications for DirectorOfResearch (only screening1Status = 1)
 * @param {Object} params - Query parameters
 * @returns {Promise} API response with filtered data
 */
export const fetchApplicationsForDOR = async (params = {}) => {
  // Use the existing fetchApplications but filter for screening1Status = 1
  const result = await fetchApplications({ ...params, screening1Only: true });
  return result;
};