/**
 * Utility function to get the base API URL from environment variables
 */
export const getBaseServerURL = () => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7290/api';
  // Remove /api suffix to get server URL
  return baseURL.replace('/api', '');
};

export default function getBaseURL() {
  return import.meta.env.VITE_API_BASE_URL || 'https://localhost:7290/api';
}