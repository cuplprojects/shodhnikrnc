import { useState, useEffect, useRef } from 'react';
import API from '@/services/API';

// Cache for header settings to avoid repeated API calls
let headerSettingsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useHeaderSettings = (id = 1, options = {}) => {
  const { enableCache = true, maxRetries = 3 } = options;
  
  const [headerSettings, setHeaderSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const fetchAttempted = useRef(false);

  // Check if cached data is still valid
  const isCacheValid = () => {
    return enableCache && headerSettingsCache && cacheTimestamp && 
           (Date.now() - cacheTimestamp) < CACHE_DURATION;
  };

  // Fetch header settings from API with retry logic
  const fetchHeaderSettings = async (attempt = 0) => {
    // Prevent multiple simultaneous calls
    if (fetchAttempted.current && attempt === 0) {
      return;
    }
    
    // Check cache first
    if (isCacheValid()) {
      setHeaderSettings(headerSettingsCache);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      fetchAttempted.current = true;
      setLoading(true);
      setError(null);
      
      const response = await API.get(`/HeaderSettings/${id}`);
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setHeaderSettings(data);
        
        // Cache the successful response
        if (enableCache) {
          headerSettingsCache = data;
          cacheTimestamp = Date.now();
        }
        setRetryCount(0);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching header settings:', err);
      
      // Only retry on network errors or 5xx errors, not on 4xx errors
      const shouldRetry = attempt < maxRetries && 
                         (!err.response || err.response.status >= 500);
      
      if (shouldRetry) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        setTimeout(() => {
          setRetryCount(attempt + 1);
          fetchHeaderSettings(attempt + 1);
        }, delay);
        
        setError(`Connection issue. Retrying... (${attempt + 1}/${maxRetries})`);
      } else {
        setError('Unable to load header settings. Using default layout.');
        fetchAttempted.current = false;
      }
    } finally {
      if (attempt === 0 || !error) {
        setLoading(false);
        fetchAttempted.current = false;
      }
    }
  };

  useEffect(() => {
    fetchHeaderSettings();
  }, [id, enableCache, maxRetries]);

  return {
    headerSettings,
    loading,
    error,
    retryCount,
    refetch: () => {
      fetchAttempted.current = false;
      fetchHeaderSettings();
    }
  };
};
