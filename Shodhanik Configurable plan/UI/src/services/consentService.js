/**
 * @fileOverview Service for handling consent-related API calls
 * Provides methods for validating consent tokens and submitting consent decisions
 */
import API from './API';

const consentService = {
  /**
   * Validate consent token and get consent details
   * @param {string} token - The consent token to validate
   * @returns {Promise} API response with consent details
   */
  validateConsentToken: async (token) => {
    try {
      const response = await API.post('/Confidential/consent-details', {"token": token});
      return response.data;
    } catch (error) {
      console.error('Error validating consent token:', error);
      throw error;
    }
  },

  /**
   * Submit consent decision
   * @param {Object} consentData - The consent submission data
   * @param {string} consentData.token - The consent token
   * @param {number} consentData.decision - Decision (0 for accept, 1 for reject)
   * @param {string} consentData.remarks - Optional remarks
   * @returns {Promise} API response
   */
  submitConsent: async (consentData) => {
    try {
      const response = await API.post('/Confidential/submit-consent', consentData);
      return response.data;
    } catch (error) {
      console.error('Error submitting consent:', error);
      throw error;
    }
  }
};

export default consentService;