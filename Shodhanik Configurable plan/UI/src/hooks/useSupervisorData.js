import { useState, useEffect } from 'react';
import { fetchSupervisorDetails, transformApiDataToApplicationFormat } from '../utils/supervisorApi';

export const useSupervisorData = (supervisorId, includeTransaction = false) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!supervisorId) {
        setLoading(false);
        setError('No supervisor ID found. Please login again.');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const apiData = await fetchSupervisorDetails(supervisorId);
        const transformedData = transformApiDataToApplicationFormat(apiData, includeTransaction);
        setData(transformedData);
      } catch (err) {
        setError('Failed to load supervisor data');
        console.error('Error loading supervisor data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supervisorId, includeTransaction]);

  const refetch = async () => {
    if (!supervisorId) {
      setError('No supervisor ID found. Please login again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const apiData = await fetchSupervisorDetails(supervisorId);
      const transformedData = transformApiDataToApplicationFormat(apiData, includeTransaction);
      setData(transformedData);
    } catch (err) {
      setError('Failed to load supervisor data');
      console.error('Error loading supervisor data:', err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
};