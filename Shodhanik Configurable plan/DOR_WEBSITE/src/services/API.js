/**
 * @fileOverview Simplified API service for DOR Website
 * This is a public-facing website so no authentication is required
 */
import axios from 'axios';

/**
 * Get the appropriate base URL based on the application stage
 * @returns {string} The base URL for API calls
 */
const getBaseApiURL = () => {
  const stage = import.meta.env.VITE_APP_STAGE || 'development';
  const localURL = import.meta.env.VITE_API_DOR_LOCAL || 'https://localhost:7290/api';
  const livetestURL = import.meta.env.VITE_API_DOR_LIVETEST;
  const productionURL = import.meta.env.VITE_API_DOR_PRODUCTION;

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
    baseURL = localURL || 'https://localhost:7290/api';
  }

  // Validate that we have a URL
  if (!baseURL) {
    console.error('No base URL found. Check your environment variables.');
    baseURL = 'https://localhost:7290/api'; // Fallback
  }

  // Remove trailing slash if present for consistency
  baseURL = baseURL.replace(/\/$/, '');

  return baseURL;
};

const baseURL = getBaseApiURL();

// Request deduplication cache
const pendingRequests = new Map();

const API = axios.create({
  baseURL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for deduplication
API.interceptors.request.use(
  (config) => {
    const requestKey = `${config.method}:${config.url}`;
    
    // If the same request is already pending, return the existing promise
    if (pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey);
    }
    
    // Store the request promise
    const requestPromise = Promise.resolve(config);
    pendingRequests.set(requestKey, requestPromise);
    
    // Clean up after request completes
    requestPromise.finally(() => {
      pendingRequests.delete(requestKey);
    });
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
API.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Enhanced error logging
    if (error.response) {
      // Server responded with error status
      console.error(`API Error ${error.response.status}:`, {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data,
        message: error.message
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Network Error:', {
        url: error.config?.url,
        message: 'No response received from server',
        timeout: error.code === 'ECONNABORTED'
      });
    } else {
      // Something else happened
      console.error('API Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Get the server base URL (without /api) for file uploads and static content
 * @returns {string} The base server URL
 */
export const getBaseServerURL = () => {
  const apiURL = getBaseApiURL();
  // Remove /api suffix to get server base URL
  return apiURL.replace(/\/api$/, '');
};

export default API;