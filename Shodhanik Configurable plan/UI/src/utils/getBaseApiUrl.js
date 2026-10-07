// src/utils/getBaseURL.js

/**
 * Get the appropriate base URL based on the application stage
 * @returns {string} The base URL for API calls
 */
const getBaseApiURL = () => {

  const stage = import.meta.env.VITE_APP_STAGE;
  const localURL = import.meta.env.VITE_API_BASE_URL_LOCAL;

  const livetestURL = import.meta.env.VITE_API_BASE_URL_LIVETEST;
  const productionURL = import.meta.env.VITE_API_BASE_URL_PRODUCTION;


  // Determine base URL based on stage
  let baseURL;

if (stage === 'development') {
    baseURL = localURL;
  } else if (stage === 'livetest') {
    baseURL = livetestURL;
  } else if (stage === 'production') {
    baseURL = productionURL;

  } else {
    console.warn(`Unknown VITE_APP_STAGE: ${stage}. Falling back to local URL.`);
    baseURL = localURL;
  }
  // Validate that we have a URL
  if (!baseURL) {
    console.error('No base URL found. Check your environment variables.');
    throw new Error('API base URL is not configured properly.');
  }

  // Remove trailing slash if present for consistency
  baseURL = baseURL.replace(/\/$/, '');

  // Log current configuration (only in development)
  // if (import.meta.env.DEV) {
  //   console.log(`🌐 API Base URL (${stage}):`, baseURL);
  // }

  return baseURL;
};

/**
 * Get the server base URL (without /api) for file uploads and static content
 * @returns {string} The base server URL
 */
export const getBaseServerURL = () => {
  const apiURL = getBaseApiURL();
  // Remove /api suffix to get server base URL
  return apiURL.replace(/\/api$/, '');
};

export default getBaseApiURL;