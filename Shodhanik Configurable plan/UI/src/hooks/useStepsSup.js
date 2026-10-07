import { useCallback } from 'react';
import notification from '@/services/NotificationService';
import useStepSupStore from '../pages/Registration/SupervisorRegistration/components/stepStore';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';
import API from '@/services/API';

export const useStepsSup = () => {
  const { steps, completeStep, canEditSteps, fetchSteps, initSteps} = useStepSupStore();
  const notify = notification();
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();

  const saveStep = useCallback(async (stepNumber) => {
    try {
      const updatedSteps = completeStep(stepNumber);
      console.log(updatedSteps);
      // Prepare API payload
      const payload = stepNumber
      console.log(payload);
let response;
      // Call API
      if (updatedSteps.supId && updatedSteps.supId > 0) {
        await API.put(`/SupervisorApplicationStatus/${supId}`, payload);
      } else {
        response = await API.post("/SupervisorApplicationStatus", payload);
        const responseData = response?.data || response;
        if (responseData?.supId) {
          // Update supId in steps
          const stepsWithsupId = { ...updatedSteps, supId: responseData.supId };
          useStepSupStore.getState().setSteps(stepsWithsupId);
        }
      }

      notify.success(`Step ${stepNumber} completed!`);
      return true;
    } catch (error) {
      console.error('Error saving step:', error);
      notify.error('Failed to save progress');
      return false;
    }
  }, [completeStep, supId, notify]);

  const loadSteps = useCallback(async (supId) => {
    try {
      // Always fetch from API first (API is source of truth)
      if (supId) {
        const steps = await fetchSteps(supId);
        if (steps) {
          return steps;
        }
      }
      
      // Only use localStorage as fallback if API fails
      const localSteps = initSteps();
      return localSteps;
    } catch (error) {
      console.error('Error loading steps:', error);
      return null;
    }
  }, [fetchSteps, initSteps]);


  return {
    steps,
    canEditSteps,
    saveStep,
    loadSteps,
    isReadOnly: !canEditSteps()
  };
};

export default useStepsSup;