/**
 * File path utilities for handling static file paths
 */
import getBaseFileURL from './getBaseFileUrl.js';

/**
 * Get the full image URL with fallback support
 * @param {string} imagePath - The image path from API
 * @param {string} fallback - Fallback image path (default: '')
 * @returns {string} Full image URL or fallback
 */
export const getImageUrl = (imagePath, fallback = '') => {
  if (!imagePath) return fallback;

  // Check if it's already a full URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Check if it's a local static file
  if (imagePath.startsWith('/')) {
    return imagePath;
  }

  // Check if it's base64 data
  if (imagePath.startsWith('data:image/')) {
    return imagePath;
  }

  // Use the proper base URL for uploaded files
  const baseURL = getBaseFileURL();
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${baseURL}${cleanPath}`;
};

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