/**
 * PhD Admission Service
 * Handles all API calls related to PhD Admission Cell functionality
 */
import API from './API';

/**
 * Fetch PhD applications with pagination, search, filter, and sort
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.pageSize - Items per page
 * @param {string} params.search - Search query
 * @param {Array|string} params.status - Filter by status (array or comma-separated string)
 * @param {Array|string} params.regType - Filter by registration type (array or comma-separated string)
 * @param {string} params.primaryFilter - Filter by primary application type
 * @param {string} params.sortField - Field to sort by
 * @param {string} params.sortOrder - Sort order (ascend/descend)
 * @param {boolean} params.onlyCompletedStep5 - Filter to show only applications with completed step 5
 * @returns {Promise} API response
 */
export const fetchPhdApplications = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add pagination params
    queryParams.append('page', params.page || 1);
    queryParams.append('pageSize', params.pageSize || 10);
    
    // Add search param
    if (params.search) {
      queryParams.append('search', params.search);
    }
    
    // Add primary filter
    if (params.primaryFilter && params.primaryFilter !== 'all') {
      queryParams.append('primaryFilter', params.primaryFilter);
    }
    
    // Add status filter (take first status if array)
    if (Array.isArray(params.status) && params.status.length > 0) {
      queryParams.append('status', params.status[0]);
    } else if (typeof params.status === 'string' && params.status !== 'all') {
      queryParams.append('status', params.status);
    }
    
    // Add registration type filter (take first regType if array)
    if (Array.isArray(params.regType) && params.regType.length > 0) {
      queryParams.append('regType', params.regType[0]);
    } else if (typeof params.regType === 'string' && params.regType !== 'all') {
      queryParams.append('regType', params.regType);
    }
    
    // Add step completion filter - always true for PhD admission cell
    queryParams.append('onlyCompletedStep5', 'true');
    
    // Add sorting params
    if (params.sortField) {
      queryParams.append('sortField', params.sortField);
    }
    if (params.sortOrder) {
      queryParams.append('sortOrder', params.sortOrder);
    }
    
    const response = await API.get(`Scholars/PhdApplications?${queryParams.toString()}`);
    
    console.log('=== Raw API Response ===');
    console.log('Full response object:', response);
    console.log('Response data:', response.data);
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('NOTE: Only showing applications with completed steps 1-5 (ready for review)');
    
    // Handle both Data and data property names
    const dataArray = response.data.Data || response.data.data || [];
    console.log('=== Extracted Data Array ===');
    console.log('Data array:', dataArray);
    console.log('Data array length:', dataArray.length);
    console.log('Data array type:', typeof dataArray);
    console.log('Is array?', Array.isArray(dataArray));
    
    // Log raw API data before mapping
    if (Array.isArray(dataArray)) {
      console.log('=== Raw API Records ===');
      dataArray.forEach((item, index) => {
        console.log(`Raw Record ${index + 1}:`, item);
      });
    }
    
    // Map the API response to match the expected format
    const mappedData = dataArray.map(item => ({
      key: item.SID || item.sid, // This is the SID used for API calls
      sid: item.SID || item.sid, // Explicit SID field
      scholarId: item.ScholarId || item.scholarId, // Application number
      name: item.Name || item.name,
      email: item.Email || item.email,
      regType: item.RegType || item.regType,
      exemptCategory: item.ExemptCategory || item.exemptCategory,
      department: item.Department || item.department,
      phone: item.Phone || item.phone,
      status: item.Status || item.status,
      decisionStatus: item.DecisionStatus || item.decisionStatus,
      year: item.Year || item.year,
      isPartTime: item.IsPartTime || item.isPartTime,
      // Application Steps
      step1Completed: item.Step1Completed || false,
      step2Completed: item.Step2Completed || false,
      step3Completed: item.Step3Completed || false,
      step4Completed: item.Step4Completed || false,
      step5Completed: item.Step5Completed || false,
      allStepsUpTo5Completed: item.AllStepsUpTo5Completed || false,
      canSendForReview: item.CanSendForReview || false,
      originalData: item
    }));
    
    console.log('=== Mapped Data ===');
    console.log('Mapped data array:', mappedData);
    console.log('Mapped data length:', mappedData.length);
    
    // Log mapped data
    if (Array.isArray(mappedData)) {
      console.log('=== Mapped Records ===');
      mappedData.forEach((item, index) => {
        console.log(`Mapped Record ${index + 1}:`, {
          key: item.key,
          scholarId: item.scholarId,
          name: item.name,
          regType: item.regType,
          exemptCategory: item.exemptCategory
        });
      });
    }
    
    const finalResult = {
      data: mappedData,
      total: response.data.Total || response.data.total || 0,
      page: response.data.Page || response.data.page || 1,
      pageSize: response.data.PageSize || response.data.pageSize || 10
    };
    
    console.log('=== Final Service Result ===');
    console.log('Final result:', finalResult);
    
    return finalResult;
  } catch (error) {
    console.error('Error fetching PhD applications:', error);
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    };
  }
};

/**
 * Get primary filter counts for PhD applications dashboard
 * @returns {Promise} API response with primary filter counts
 */
export const getPhdPrimaryFilterCounts = async () => {
  try {
    const response = await API.get('Scholars/PhdApplications/PrimaryFilterCounts');
    return response.data;
  } catch (error) {
    console.error('Error fetching PhD primary filter counts:', error);
    return { total: 0 };
  }
};

export const getPhdStatusCounts = async (regTypeFilter = null, primaryFilter = null) => {
  try {
    const queryParams = new URLSearchParams();
    if (regTypeFilter && regTypeFilter !== 'all') {
      queryParams.append('regType', regTypeFilter);
    }
    if (primaryFilter && primaryFilter !== 'all') {
      queryParams.append('primaryFilter', primaryFilter);
    }
    
    const response = await API.get(`Scholars/PhdApplications/StatusCounts?${queryParams.toString()}`);
    const data = response.data;
    
    const statusMapping = {
      0: data.applicationScreeningPending || 0,
      1: data.applicationScreeningHold || 0,
      2: data.applicationScreeningRejected || 0,
      3: data.applicationScreeningPassed_Cumulative || 0,
      4: data.interviewScheduled || 0,
      5: data.interviewRejected || 0,
      6: data.interviewApproved_Cumulative || 0,
      7: data.counsellingScheduled || 0,
      8: data.counsellingUnderReview || 0,
      9: data.counsellingRejectedFinal || 0,
      10: data.counsellingApprovedFinal_Cumulative || 0,
      11: data.courseworkRejected || 0,
      12: data.courseworkApproved_Cumulative || 0,
    };

    return {
      total: data.total || 0,
      ...statusMapping
    };
  } catch (error) {
    console.error('Error fetching PhD status counts:', error);
    return {
      total: 0,
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
    };
  }
};

/**
 * Get registration type counts for PhD applications dashboard
 * @param {string} primaryFilter - Optional primary filter
 * @returns {Promise} API response with registration type counts
 */
export const getPhdRegTypeCounts = async (primaryFilter = null) => {
  try {
    const queryParams = new URLSearchParams();
    if (primaryFilter && primaryFilter !== 'all') {
      queryParams.append('primaryFilter', primaryFilter);
    }
    
    const response = await API.get(`Scholars/PhdApplications/RegTypeCounts?${queryParams.toString()}`);
    console.log('Raw API response for RegTypeCounts:', response.data);
    
    // Transform array response to object for easier handling
    const regTypes = {};
    
    if (Array.isArray(response.data)) {
      response.data.forEach(item => {
        console.log('Processing API item:', item);
        regTypes[item.id] = {
          id: item.id,
          name: item.name,
          count: item.count
        };
      });
    } else {
      console.error('API response is not an array:', response.data);
    }
    
    console.log('Transformed regTypes:', regTypes);
    
    // Ensure we always have all 6 expected filters, even if API doesn't return them
    const expectedFilters = [
      { id: 'all', name: 'All Applications' },
      { id: 'ret_regular', name: 'Research Entrance Test (RET)' },
      { id: 'ret_exemption', name: 'Exemption from Entrance Test (RET)' },
      { id: 'foreign_students', name: 'Ph.D. Admission for Foreign Students' },
      { id: 'part_time', name: 'Part Time Ph.D' },
      { id: 'phd_direct', name: 'Ph.D. Direct Admission' }
    ];
    
    // Add missing filters with 0 count
    expectedFilters.forEach(filter => {
      if (!regTypes[filter.id]) {
        console.log(`Adding missing filter: ${filter.id}`);
        regTypes[filter.id] = {
          id: filter.id,
          name: filter.name,
          count: 0
        };
      }
    });
    
    console.log('Final regTypes with all filters:', regTypes);
    return regTypes;
  } catch (error) {
    console.error('Error fetching PhD registration type counts:', error);
    
    // Return default structure with all 6 filters
    return {
      all: { id: 'all', name: 'All Applications', count: 0 },
      ret_regular: { id: 'ret_regular', name: 'Research Entrance Test (RET)', count: 0 },
      ret_exemption: { id: 'ret_exemption', name: 'Exemption from Entrance Test (RET)', count: 0 },
      foreign_students: { id: 'foreign_students', name: 'Ph.D. Admission for Foreign Students', count: 0 },
      part_time: { id: 'part_time', name: 'Part Time Ph.D', count: 0 },
      phd_direct: { id: 'phd_direct', name: 'Ph.D. Direct Admission', count: 0 }
    };
  }
};

/**
 * Fetch PhD applications that have completed step 5 (ready for review)
 * @param {Object} params - Query parameters (same as fetchPhdApplications)
 * @returns {Promise} API response with only step-5 completed applications
 */
export const fetchPhdApplicationsReadyForReview = async (params = {}) => {
  console.log('=== Fetching Applications Ready for Review (Step 5 Completed) ===');
  return await fetchPhdApplications({
    ...params,
    onlyCompletedStep5: true
  });
};

/**
 * Send PhD application for review (only if steps 1-5 are completed)
 * @param {string} scholarId - Scholar ID (SID)
 * @returns {Promise} API response
 */
export const sendPhdApplicationForReview = async (scholarId) => {
  try {
    console.log('=== Sending Application for Review ===');
    console.log('Scholar ID:', scholarId);
    console.log('API Endpoint:', `Scholars/SendForReview/${scholarId}`);
    
    const response = await API.post(`Scholars/SendForReview/${scholarId}`);
    
    console.log('Send for Review Response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error sending application for review:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
};

/**
 * Update PhD application status
 * @param {string} scholarId - Scholar ID (SID)
 * @param {Object} data - Status update data
 * @param {number} data.DecisionStatus - New DecisionStatus enum value
 * @param {string} data.RejectReason - Remarks for the status change
 * @returns {Promise} API response
 */
export const updatePhdApplicationStatus = async (scholarId, data) => {
  try {
    const response = await API.patch(`Scholars/${scholarId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating PhD application status:', error);
    throw error;
  }
};

/**
 * Fetch PhD application details
 * @param {string} scholarId - Scholar ID (SID)
 * @returns {Promise} API response with application details
 */
export const fetchPhdApplicationDetails = async (scholarId) => {
  try {
    console.log('=== PhD Application Details Service ===');
    console.log('Scholar ID:', scholarId);
    console.log('API Endpoint:', `Scholars/PreviewAllDetails/${scholarId}`);
    
    const response = await API.get(`Scholars/PreviewAllDetails/${scholarId}`);
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching PhD application details:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    throw error;
  }
};

/**
 * Fetch registration types
 * @returns {Promise} API response with registration types
 */
export const fetchRegistrationTypes = async () => {
  try {
    const response = await API.get('RegTypes/Distinct');
    return response.data;
  } catch (error) {
    console.error('Error fetching registration types:', error);
    return [];
  }
};

/**
 * Export PhD applications data
 * @param {Object} filters - Export filters
 * @returns {Promise} API response with export data
 */
export const exportPhdApplications = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams(filters);
    const response = await API.get(`Scholars/export?${queryParams}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting PhD applications:', error);
    throw error;
  }
};


/**
 * ============================================================================
 * SCHEDULE INTERVIEW FUNCTIONS - Separate functions for interview scheduling
 * ============================================================================
 */

/**
 * Fetch interview status counts for Schedule Interview page
 * Returns counts for: Interview Pending (3), Interview Scheduled (4), Interview Rejected (5)
 * @returns {Promise} API response with interview status counts
 */
export const getInterviewStatusCounts = async () => {
  try {
    const response = await API.get('Scholars/PhdApplications/StatusCounts');
    const data = response.data;
    
    return {
      total: data.total || 0,
      interviewPending: data.applicationScreeningPassed_Cumulative || 0,      // Status 3
      interviewScheduled: data.interviewScheduled || 0,                        // Status 4
      interviewRejected: data.interviewRejected || 0,                          // Status 5
    };
  } catch (error) {
    console.error('Error fetching interview status counts:', error);
    return {
      total: 0,
      interviewPending: 0,
      interviewScheduled: 0,
      interviewRejected: 0,
    };
  }
};

/**
 * Fetch PhD applications for interview scheduling
 * Filters by interview-related statuses (3, 4, 5)
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.pageSize - Items per page
 * @param {string} params.status - Filter by status (3, 4, or 5)
 * @param {string} params.search - Search query
 * @param {string} params.department - Department filter
 * @param {string} params.sortField - Field to sort by
 * @param {string} params.sortOrder - Sort order (ascend/descend)
 * @returns {Promise} API response with applications
 */
export const fetchInterviewApplications = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add pagination params
    queryParams.append('page', params.page || 1);
    queryParams.append('pageSize', params.pageSize || 10);
    
    // Add search param
    if (params.search) {
      queryParams.append('search', params.search);
    }
    
    // Add status filter - only interview-related statuses (3, 4, 5)
    if (params.status && ['3', '4', '5'].includes(String(params.status))) {
      queryParams.append('status', params.status);
    }
    
    // Add step completion filter - always true for interview scheduling
    queryParams.append('onlyCompletedStep5', 'true');
    
    // Add sorting params
    if (params.sortField) {
      queryParams.append('sortField', params.sortField);
    }
    if (params.sortOrder) {
      queryParams.append('sortOrder', params.sortOrder);
    }
    
    const response = await API.get(`Scholars/PhdApplications?${queryParams.toString()}`);
    
    // Handle both Data and data property names
    const dataArray = response.data.Data || response.data.data || [];
    
    // Map the API response to match the expected format
    const mappedData = dataArray.map(item => ({
      key: item.SID || item.sid,
      sid: item.SID || item.sid,
      scholarId: item.ScholarId || item.scholarId,
      name: item.Name || item.name,
      email: item.Email || item.email,
      regType: item.RegType || item.regType,
      exemptCategory: item.ExemptCategory || item.exemptCategory,
      department: item.Department || item.department,
      phone: item.Phone || item.phone || item.phoneNumber,
      status: item.Status || item.status,
      decisionStatus: item.DecisionStatus || item.decisionStatus,
      statusText: item.StatusText || item.statusText,
      year: item.Year || item.year,
      isPartTime: item.IsPartTime || item.isPartTime,
      originalData: item
    }));
    
    return {
      data: mappedData,
      total: response.data.Total || response.data.total || 0,
      page: response.data.Page || response.data.page || 1,
      pageSize: response.data.PageSize || response.data.pageSize || 10
    };
  } catch (error) {
    console.error('Error fetching interview applications:', error);
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    };
  }
};


/**
 * Fetch interview pending departments/subjects
 * Returns list of departments with pending interview counts
 * @returns {Promise} API response with departments
 */
export const getInterviewPendingDepartments = async () => {
  try {
    const response = await API.get('Scholars/InterviewSchedulingPending/Subjects');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching interview pending departments:', error);
    return [];
  }
};

/**
 * Fetch interview pending scholars by department/subject with pagination and status filter
 * @param {number} subjectId - Subject/Department ID (0 for all)
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @param {number} status - Status filter (3=Pending, 4=Scheduled, 5=Rejected)
 * @returns {Promise} API response with scholars for the department
 */
export const getInterviewPendingScholars = async (subjectId, page = 1, pageSize = 10, status = null) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('subjectId', subjectId || 0);
    queryParams.append('page', page);
    queryParams.append('pageSize', pageSize);
    
    if (status) {
      queryParams.append('status', status);
    }
    
    const response = await API.get(`Scholars/InterviewSchedulingPending/Subjects?${queryParams.toString()}`);
    return response.data || {};
  } catch (error) {
    console.error('Error fetching interview pending scholars:', error);
    return { data: [], total: 0, page: 1, pageSize: 10 };
  }
};

/**
 * ============================================================================
 * INTERVIEW EVALUATION FUNCTIONS - Separate functions for interview evaluation
 * ============================================================================
 */

/**
 * Fetch subjects/departments for interview evaluation
 * Returns list of departments with scholars ready for interview evaluation
 * @returns {Promise} API response with departments
 */
export const getInterviewEvaluationSubjects = async () => {
  try {
    const response = await API.get('Scholars/GetScholarsSubjectsforInterview');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching interview evaluation subjects:', error);
    return [];
  }
};

/**
 * Fetch scholars for interview evaluation by subject/department
 * Returns scholars with allocated interview dates ready for evaluation
 * @param {number} subjectId - Subject/Department ID
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @param {number} status - Status filter (4=Scheduled, 6=Approved, 5=Rejected)
 * @returns {Promise} API response with scholars for evaluation
 */
export const getInterviewEvaluationScholars = async (subjectId, page = 1, pageSize = 10, status = null) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('page', page);
    queryParams.append('pageSize', pageSize);
    
    if (status) {
      queryParams.append('status', status);
    }
    
    const response = await API.get(`Scholars/GetScholarsforInterview/${subjectId}?${queryParams.toString()}`);
    
    // Handle both array response and object response
    let result;
    if (Array.isArray(response.data)) {
      // If response is directly an array
      result = {
        data: response.data,
        total: response.data.length,
        page: page,
        pageSize: pageSize
      };
    } else {
      // If response is an object with data property
      result = response.data || { data: [], total: 0, page: 1, pageSize: 10 };
    }
    
    console.log('Raw API response:', response.data);
    console.log('Processed result:', result);
    
    // Map the raw scholar data to match component format
    const mappedData = (result.data || []).map(item => ({
      sid: item.sid,
      scholarId: item.scholarId || item.applicationNo,
      name: item.name,
      email: item.email,
      phoneNumber: item.phoneNumber,
      subjectName: item.subject_ID,
      decisionStatus: item.decisionStatus,
      statusText: item.statusText && item.statusText !== 'N/A' && item.statusText !== 'Unknown'
        ? item.statusText
        : getStatusString(item.decisionStatus),
      interviewDate: item.interviewDate
    }));
    
    console.log('Mapped data:', mappedData);
    
    return {
      data: mappedData,
      total: result.total || 0,
      page: result.page || page,
      pageSize: result.pageSize || pageSize
    };
  } catch (error) {
    console.error('Error fetching interview evaluation scholars:', error);
    return { data: [], total: 0, page: 1, pageSize: 10 };
  }
};

/**
 * Helper function to get status string from decision status
 */
const getStatusString = (decisionStatus) => {
  const status = parseInt(decisionStatus);
  switch (status) {
    case 4:
      return 'Interview Scheduled';
    case 5:
      return 'Interview Rejected';
    case 6:
      return 'Marks Uploaded';
    default:
      if (status >= 6) {
        return 'Marks Uploaded';
      }
      return 'Unknown';
  }
};

/**
 * ============================================================================
 * DOCUMENT VERIFICATION FUNCTIONS - Separate functions for document verification
 * ============================================================================
 */

/**
 * Fetch subjects/departments for document verification
 * Returns list of departments with scholars who passed interview
 * @returns {Promise} API response with departments
 */
export const getDocumentVerificationSubjects = async () => {
  try {
    const response = await API.get('Scholars/GetScholarsSubjectsforDocumentVerification');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching document verification subjects:', error);
    return [];
  }
};

/**
 * Fetch scholars for document verification by subject/department
 * Returns scholars who passed interview and need document verification
 * @param {number} subjectId - Subject/Department ID
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @returns {Promise} API response with scholars for document verification
 */
export const getDocumentVerificationScholars = async (subjectId, page = 1, pageSize = 10) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('page', page);
    queryParams.append('pageSize', pageSize);
    
    const response = await API.get(`Scholars/GetScholarsforDocumentVerification/${subjectId}?${queryParams.toString()}`);
    
    let result;
    if (Array.isArray(response.data)) {
      result = {
        data: response.data,
        total: response.data.length,
        page: page,
        pageSize: pageSize
      };
    } else {
      result = response.data || { data: [], total: 0, page: 1, pageSize: 10 };
    }
    
    console.log('Raw API response:', response.data);
    console.log('Processed result:', result);
    
    return {
      data: result.data || [],
      total: result.total || 0,
      page: result.page || page,
      pageSize: result.pageSize || pageSize
    };
  } catch (error) {
    console.error('Error fetching document verification scholars:', error);
    return { data: [], total: 0, page: 1, pageSize: 10 };
  }
};


/**
 * Fetch documents for a scholar
 * Returns list of uploaded documents for verification
 * @param {string} scholarId - Scholar ID (SID)
 * @returns {Promise} API response with documents
 */
export const getScholarDocuments = async (scholarId) => {
  try {
    const response = await API.get(`ScholarUpload/GetBySID?sid=${scholarId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching scholar documents:', error);
    return [];
  }
};

/**
 * Update document verification status
 * @param {number} scholarUploadId - Scholar Upload ID
 * @param {number} decisionStatus - UploadDecisionStatus enum value (0=Pending, 1=Accepted, 2=Rejected)
 * @param {string} remarks - Remarks for the decision
 * @returns {Promise} API response
 */
export const updateDocumentVerificationStatus = async (scholarUploadId, decisionStatus, remarks = '') => {
  try {
    const formData = new FormData();
    formData.append('DecisionStatus', decisionStatus);
    if (remarks) {
      formData.append('Remarks', remarks);
    }
    
    const response = await API.patch(`ScholarUpload/${scholarUploadId}`, formData);
    
    console.log('Document verification status updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating document verification status:', error);
    throw error;
  }
};
