/**
 * @fileOverview This file provides a utility for making HTTP requests to the backend API.
 * It uses axios to handle requests and provides a centralized configuration for the API.
 *
 * @uses axios - For making HTTP requests.
 */
import axios from 'axios';
import getBaseURL from '@/utils/getBaseApiURL';
import { encryptData, decryptData, encryptionConfig } from '@/utils/encryptionUtils';
import StorageService from '@/utils/storage';
// import { isTokenExpired } from './authService';

const baseURL = getBaseURL();
// console.log('API Base URL:', baseURL)

const API = axios.create({
  baseURL,
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple logout calls
let isLoggingOut = false;

// Function to handle logout
const handleTokenExpiration = () => {
  if (isLoggingOut) return;
  isLoggingOut = true;

  console.warn('Token expired or invalid - logging out user');
  
  // Use the centralized logout utility
  // import('@/utils/logoutUtils').then(({ handleTokenExpiration }) => {
  //   handleTokenExpiration();
  //   // Reset flag after logout completes
  //   setTimeout(() => {
  //     isLoggingOut = false;
  //   }, 2000);
  // }).catch((error) => {
  //   console.error('Error during token expiration handling:', error);
  //   // Fallback: direct navigation
  //   window.location.href = '/login';
  //   isLoggingOut = false;
  // });
};

// Request interceptor to add auth token and encrypt payload
API.interceptors.request.use(
  (config) => {
    // Skip token checks for login and public endpoints
    const isLoginEndpoint = config.url && (
      config.url === '/Login' || 
      config.url === '/login' ||
      config.url.includes('/Forgotpassword')
    );
    
    if (isLoginEndpoint) {
      // Don't add token or check expiration for login endpoints
      return config;
    }
    
    // Get token from storage - check all possible auth types
    const token = StorageService.get('staffAuthToken') || 
                  StorageService.get('scholarAuthToken') || 
                  StorageService.get('selectedScholarAuthToken') || 
                  StorageService.get('supervisorAuthToken') || 
                  StorageService.get('scholarRegAuthToken') || 
                  StorageService.get('supervisorRegAuthToken');
    
    const userStr = StorageService.get('staffUser') || 
                    StorageService.get('scholarUser') || 
                    StorageService.get('selectedScholarUser') || 
                    StorageService.get('supervisorUser') || 
                    StorageService.get('scholarRegUser') || 
                    StorageService.get('supervisorRegUser');
    
    if (token && userStr) {
      try {
        let user;
        
        // Try to decrypt first (for encrypted auth stores like supervisorUser, scholarRegUser, etc.)
        try {
          user = decryptData(userStr);
        } catch (decryptError) {
          // If decryption fails, userStr is already parsed by StorageService.get()
          user = userStr;
        }
        
        // If user is still null/undefined, use userStr directly (already parsed by StorageService)
        if (!user) {
          user = userStr;
        }
        
        // Check if token is expired before making request
        // if (user.exp && isTokenExpired(user.exp)) { // <--- disabled for now
        //   console.warn('Token expired before request - logging out');
        //   handleTokenExpiration();
        //   return Promise.reject(new Error('Token expired'));
        // }
        
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error parsing user data:', error);
        handleTokenExpiration();
        return Promise.reject(new Error('Invalid user data'));
      }
    }
    
    // Handle multipart form data - let browser set Content-Type with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (config.data && typeof config.data === 'object' && config.method !== 'get' && 
               encryptionConfig.encryptRequests) {
      // Encrypt payload for non-GET requests (except FormData) only if encryption is enabled
      try {
        console.log('🔒 Original payload:', config.data);
        const encryptedPayload = encryptData(config.data);
        if (encryptedPayload) {
          console.log('🔐 Encrypted payload:', { encryptedData: encryptedPayload });
          config.data = { encryptedData: encryptedPayload };
          config.headers['X-Encrypted'] = 'true'; // Flag for API to know data is encrypted
          console.log('✅ Payload encryption successful');
        }
      } catch (error) {
        console.error('❌ Payload encryption error:', error);
        // Continue with unencrypted data if encryption fails
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration and decrypt responses
API.interceptors.response.use(
  (response) => {
    // Check if response has encrypted data (regardless of headers)
    if (encryptionConfig.encryptResponses && response.data?.encryptedData) {
      try {
        console.log('🔐 Encrypted response detected, decrypting...');
        const decryptedData = decryptData(response.data.encryptedData);
        if (decryptedData) {
          console.log('🔓 Response decrypted successfully');
          response.data = decryptedData;
        } else {
          console.error('❌ Decryption failed, keeping encrypted data');
        }
      } catch (error) {
        console.error('❌ Response decryption error:', error);
        // Continue with encrypted data if decryption fails
      }
    }
    return response;
  },
  (error) => {
    // Skip logout for login endpoints - let them handle their own errors
    const isLoginEndpoint = error.config?.url && (
      error.config.url === '/Login' || 
      error.config.url === '/login' ||
      error.config.url.includes('/Forgotpassword')
    );
    
    if (isLoginEndpoint) {
      return Promise.reject(error);
    }
    
    // Handle 401 Unauthorized or 403 Forbidden responses for authenticated endpoints
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn('Received 401/403 response - token may be expired');
      handleTokenExpiration();
    }
    
    return Promise.reject(error);
  }
);

// Helper functions for manual encryption/decryption
export const encryptPayload = (data) => {
  return encryptData(data);
};

export const decryptPayload = (encryptedData) => {
  return decryptData(encryptedData);
};

// API instance with automatic encryption
export default API;
