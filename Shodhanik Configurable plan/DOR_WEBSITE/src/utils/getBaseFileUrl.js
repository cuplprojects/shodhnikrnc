/**
 * Get the appropriate base URL for file access (excluding `/api`)
 * @returns {string} The base URL for file paths
 */
const getBaseFileURL = () => {
  const stage = import.meta.env.VITE_APP_STAGE || 'development';
  const localURL = import.meta.env.VITE_API_DOR_LOCAL || 'https://localhost:7290/api';
  const livetestURL = import.meta.env.VITE_API_DOR_LIVETEST;
  const productionURL = import.meta.env.VITE_API_DOR_PRODUCTION;

  let rawURL;

  if (stage === 'development') {
    rawURL = localURL;
  } else if (stage === 'livetest') {
    rawURL = livetestURL;
  } else if (stage === 'production') {
    rawURL = productionURL;
  } else {
    if (stage) {
      console.warn(`Unknown VITE_APP_STAGE: ${stage}. Falling back to local URL.`);
    }
    rawURL = localURL;
  }

  // Ensure rawURL is defined with fallback
  if (!rawURL) {
    rawURL = 'https://localhost:7290/api';
  }

  // Remove trailing '/api' if present in either environment
  let baseURL = rawURL.replace(/\/api\/?$/, '');

  // Remove trailing slash for consistency
  baseURL = baseURL.replace(/\/$/, '');

  // if (import.meta.env.DEV) {
  //   console.log(`📁 File Base URL (${stage}):`, baseURL);
  // }

  return baseURL;
};

export default getBaseFileURL;
