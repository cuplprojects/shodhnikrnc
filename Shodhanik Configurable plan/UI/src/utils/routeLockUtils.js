/**
 * Route Lock Utilities
 * Handles dynamic route locking based on various conditions
 */
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';

/**
 * Check if a route should be locked for scholar based on progressive unlocking
 * @param {Object} route - Route configuration object
 * @returns {boolean} True if route should be locked
 */
export const isRouteLockedForScholar = (route) => {
  // If route doesn't have isLocked property, it's not locked
  if (route.isLocked === undefined || route.isLocked === false) {
    return false;
  }

  // Get progress status from store
  const { isCourseWorkCompleted, isCourseWorkFeePaid, isSynopsisApproved } = useSelectedScholarAuthStore.getState();
  const courseWorkCompleted = isCourseWorkCompleted();
  const courseWorkFeePaid = isCourseWorkFeePaid();
  const synopsisApproved = isSynopsisApproved();

  // Progressive unlocking logic based on route path
  switch (route.path) {
    case "": // Dashboard
    case "research-supervisor": // Research Supervisor  
    case "course-work": // Course Work
      // These three are always unlocked
      return false;

    case "synopsis": // Synopsis
      // Unlock synopsis when courseWorkResult === 1 AND coursework fee is paid
      return !(courseWorkCompleted && courseWorkFeePaid);

    case "progress-reports": // Progress Reports
    case "progress-reports/progressreportformat":
    case "research-papers": // Research Papers
    case "conference-and-seminar": // Conference & Seminar
    case "thesis-submission": // Thesis Submission
    case "fee-payments": // Fee Payments
      // Unlock these when synopsis is approved
      return !synopsisApproved;

    case "thesis-submission/uploads":
      // Special case: Block thesis uploads route if all documents are uploaded
      // This will be checked dynamically in the component itself
      // The route guard will redirect if needed
      return !synopsisApproved; // Still need synopsis approval to access

    case "my-settings": // Change Password
    case "my-settings/photo": // Change Photo
      // Settings are always available
      return false;

    default:
      // For any other locked routes, follow the synopsis approval rule
      return route.isLocked === true ? !synopsisApproved : false;
  }
};

/**
 * Get lock reason message for a route
 * @param {Object} route - Route configuration object
 * @returns {string|null} Lock reason message or null if not locked
 */
export const getRouteLockReason = (route) => {
  if (!isRouteLockedForScholar(route)) {
    return null;
  }

  const { isCourseWorkCompleted, isCourseWorkFeePaid, isSynopsisApproved } = useSelectedScholarAuthStore.getState();
  const courseWorkCompleted = isCourseWorkCompleted();
  const courseWorkFeePaid = isCourseWorkFeePaid();
  const synopsisApproved = isSynopsisApproved();

  switch (route.path) {
    case "synopsis":
      if (!courseWorkCompleted) {
        return "Complete and get approval for Course Work to unlock Synopsis";
      }
      if (!courseWorkFeePaid) {
        return "Please pay the Coursework Fee to unlock Synopsis";
      }
      return "Synopsis is locked";

    case "progress-reports":
    case "progress-reports/progressreportformat":
    case "research-papers":
    case "conference-and-seminar":
    case "thesis-submission":
    case "thesis-submission/uploads":
    case "fee-payments":
      return "Get Synopsis approved by RDC to unlock this section";

    default:
      return "This section is currently locked";
  }
};

/**
 * Check if any route in a section should be unlocked
 * @param {Array} routes - Array of route objects
 * @returns {boolean} True if at least one route in section is unlocked
 */
export const isSectionUnlocked = (routes) => {
  return routes.some(route => !isRouteLockedForScholar(route));
};

/**
 * Get the current unlock stage for debugging/display purposes
 * @returns {string} Current unlock stage
 */
export const getCurrentUnlockStage = () => {
  const { isCourseWorkCompleted, isCourseWorkFeePaid, isSynopsisApproved } = useSelectedScholarAuthStore.getState();
  const courseWorkCompleted = isCourseWorkCompleted();
  const courseWorkFeePaid = isCourseWorkFeePaid();
  const synopsisApproved = isSynopsisApproved();

  if (synopsisApproved) {
    return 'all_unlocked'; // All routes unlocked
  } else if (courseWorkCompleted && courseWorkFeePaid) {
    return 'synopsis_unlocked'; // Synopsis unlocked, waiting for approval
  } else if (courseWorkCompleted && !courseWorkFeePaid) {
    return 'fee_payment_required'; // Course work approved, but fee not paid
  } else {
    return 'basic_only'; // Only first 3 routes unlocked
  }
};

export default {
  isRouteLockedForScholar,
  getRouteLockReason,
  isSectionUnlocked,
  getCurrentUnlockStage
};