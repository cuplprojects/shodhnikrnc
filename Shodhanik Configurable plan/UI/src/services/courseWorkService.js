/**
 * Course Work Service
 * Handles API calls related to course work status
 */
import API from './API';

// Coursework fee payment category ID (matches PaymentCategory.CourseworkAdmissionPayment in API)
const COURSEWORK_FEE_PAYMENT_CATEGORY = 4;

/**
 * Fetch course work status by Scholar ID
 * @param {number} sId - Scholar ID
 * @returns {Promise} Course work data
 */
export const fetchCourseWorkStatus = async (sId) => {
  try {
    const response = await API.get(`/CourseWork/BySid/${sId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching course work status:', error);
    throw error;
  }
};

/**
 * Check if scholar has completed course work (courseWorkResult = 1)
 * @param {number} sId - Scholar ID
 * @returns {Promise<boolean>} True if course work result is 1
 */
export const isCourseWorkCompleted = async (sId) => {
  try {
    const courseWorkData = await fetchCourseWorkStatus(sId);
    return courseWorkData?.courseWork?.courseWorkResult === 1;
  } catch (error) {
    console.error('Error checking course work completion:', error);
    return false; // Default to locked if API fails
  }
};

/**
 * Check if coursework fee is paid
 * @param {number} sId - Scholar ID
 * @returns {Promise<boolean>} True if coursework fee payment is completed (paymentStatus = 1)
 */
export const isCourseWorkFeePaid = async (sId) => {
  try {
    const response = await API.get(`/ScholarPayments/by-sid/${sId}`);
    const payments = response.data || [];
    
    // Check if there's a payment with coursework fee category and status 1 (completed)
    const courseWorkFeePayment = payments.find(
      payment => payment.paymentCategory === COURSEWORK_FEE_PAYMENT_CATEGORY && payment.paymentStatus === 2
    );
    
    return !!courseWorkFeePayment;
  } catch (error) {
    console.error('Error checking coursework fee payment status:', error);
    return false; // Default to locked if API fails
  }
};

/**
 * Check if synopsis is approved by RDC
 * @param {number} sId - Scholar ID
 * @returns {Promise<boolean>} True if synopsis is approved
 */
export const isSynopsisApproved = async (sId) => {
  try {
    const response = await API.get(`/SynopsisRDC/isSynopsisApproved/${sId}`);
    return response.data?.result === true;
  } catch (error) {
    console.error('Error checking synopsis approval status:', error);
    return false; // Default to locked if API fails
  }
};

export default {
  fetchCourseWorkStatus,
  isCourseWorkCompleted,
  isCourseWorkFeePaid,
  isSynopsisApproved
};