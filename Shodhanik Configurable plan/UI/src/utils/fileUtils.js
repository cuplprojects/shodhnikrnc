/**
 * File path utilities for handling static file paths
 */
import getBaseFileURL from './getBaseFileUrl.js';

/**
 * Get the full file path by combining base URL with file path
 * @param {string} filePath - The file path from API (e.g., "Supervisor/2/Photos/file.jpg")
 * @returns {string} Full file URL (e.g., "https://localhost:7290/Supervisor/2/Photos/file.jpg")
 */
export const getFilePath = (filePath) => {
  if (!filePath || filePath === '--') {
    return '';
  }

  // Check if it's already a full URL
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  const baseURL = getBaseFileURL();
  
  // Ensure proper path separation
  const separator = filePath.startsWith('/') ? '' : '/';
  
  return `${baseURL}${separator}${filePath}`;
};