/**
 * Scholar Service - API calls related to scholar operations
 */
import API from './API';

export const scholarService = {
  /**
   * Get scholar profile by sId
   * @param {string} sId - Scholar ID
   * @returns {Promise} API response with scholar profile data
   */
  getProfile: async (sId) => {
    try {
      const response = await API.get(`/Scholars/Profile/${sId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching scholar profile:', error);
      throw error;
    }
  }
};

export default scholarService;