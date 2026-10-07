import { useCallback } from 'react';
import useStepStore from '@/pages/registration/ScholarRegistration/components/stepStore';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import { scholarAuthService } from '@/services/authService';
import notification from '@/services/NotificationService';

export const useSteps = () => {
  const { steps, completeStep, canEditSteps, canEditStep, fetchSteps } = useStepStore();
  const { getSId } = useScholarRegAuthStore();
  const notify = notification();

  const saveStep = useCallback(async (stepNumber) => {
    try {
      let updatedSteps = completeStep(stepNumber);
      
      // If step 5 is completed, also complete step 6
      if (stepNumber === 5) {
        updatedSteps = {
          ...updatedSteps,
          step_6: true,
          step_6At: new Date().toISOString()
        };
        // Update the store with both steps completed
        useStepStore.getState().setSteps(updatedSteps);
      }
      
      // Prepare API payload with proper formatting
      const payload = {
        sasid: updatedSteps.sasid || 0,
        sid: getSId(),
        supAppStatus: updatedSteps.supAppStatus || 0, // Required field
        regAt: updatedSteps.regAt || new Date().toISOString(),
        step_1: updatedSteps.step_1 || false,
        step_2: updatedSteps.step_2 || false,
        step_3: updatedSteps.step_3 || false,
        step_4: updatedSteps.step_4 || false,
        step_5: updatedSteps.step_5 || false,
        step_6: updatedSteps.step_6 || false,
        step_7: updatedSteps.step_7 || false,
        step_8: updatedSteps.step_8 || false,
        step_9: updatedSteps.step_9 || false,
        // Only include DateTime fields if they have values, otherwise omit them
        ...(updatedSteps.step_1At && { step_1At: updatedSteps.step_1At }),
        ...(updatedSteps.step_2At && { step_2At: updatedSteps.step_2At }),
        ...(updatedSteps.step_3At && { step_3At: updatedSteps.step_3At }),
        ...(updatedSteps.step_4At && { step_4At: updatedSteps.step_4At }),
        ...(updatedSteps.step_5At && { step_5At: updatedSteps.step_5At }),
        ...(updatedSteps.step_6At && { step_6At: updatedSteps.step_6At }),
        ...(updatedSteps.step_7At && { step_7At: updatedSteps.step_7At }),
        ...(updatedSteps.step_8At && { step_8At: updatedSteps.step_8At }),
        ...(updatedSteps.step_9At && { step_9At: updatedSteps.step_9At })
      };

      // Call API
      if (updatedSteps.sasid && updatedSteps.sasid > 0) {
        await scholarAuthService.updateApplicationStatus(updatedSteps.sasid, payload);
      } else {
        const response = await scholarAuthService.createApplicationStatus(payload);
        if (response.sasid) {
          // Update sasid in steps
          const stepsWithSasid = { ...updatedSteps, sasid: response.sasid };
          useStepStore.getState().setSteps(stepsWithSasid);
        }
      }

      // Show appropriate success message
      if (stepNumber === 5) {
        notify.success(`Step ${stepNumber} and 6 completed! `);
      } else {
        notify.success(`Step ${stepNumber} completed!`);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving step:', error);
      notify.error('Failed to save progress');
      return false;
    }
  }, [completeStep, getSId, notify]);

  const loadSteps = useCallback(async (sasid) => {
    try {
      const steps = await fetchSteps(sasid);
      return steps;
    } catch (error) {
      console.error('Error loading steps:', error);
      return null;
    }
  }, [fetchSteps]);

  const refreshSteps = useCallback(async () => {
    try {
      const sId = getSId();
      if (sId) {
        // Always try with sId first (assuming sasid = sId)
        const updatedSteps = await fetchSteps(parseInt(sId));
        return updatedSteps;
      }
    } catch (error) {
      // Silently handle - no steps found is normal for new users
      return null;
    }
  }, [fetchSteps, getSId]); // Removed 'steps' dependency to prevent loops

  // Custom isReadOnly logic for different step ranges
  const getIsReadOnly = useCallback((stepNumber) => {
    // Steps 1-5: read-only if step 5 is completed
    if (stepNumber >= 1 && stepNumber <= 5) {
      return !canEditSteps();
    }
    // Steps 6 and above: never read-only (always editable)
    return false;
  }, [canEditSteps]);

  return {
    steps,
    canEditSteps,
    canEditStep,
    saveStep,
    loadSteps,
    refreshSteps,
    isReadOnly: !canEditSteps(), // Default for backward compatibility (steps 1-5)
    getIsReadOnly // New function for step-specific read-only logic
  };
};

export default useSteps;