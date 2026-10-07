import { useEffect, useRef } from 'react';
import useSteps from './useSteps';

/**
 * Hook to automatically refresh steps from API when component mounts
 * Use this in any form component to ensure latest step status
 */
export const useStepRefresh = () => {
  const { refreshSteps } = useSteps();
  const hasRefreshed = useRef(false);

  useEffect(() => {
    // Only refresh once per component mount
    if (!hasRefreshed.current) {
      const refreshStepsData = async () => {
        try {
          hasRefreshed.current = true;
          await refreshSteps();
        } catch (error) {
          console.error('Error refreshing steps:', error);
        }
      };
      
      refreshStepsData();
    }
  }, []); // Empty dependency array - only run on mount
};

export default useStepRefresh;