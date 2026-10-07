import { create } from 'zustand';
import { encryptData, decryptData } from '@/utils/encryptionUtils';
import { scholarAuthService } from '@/services/authService';
import StorageService from '@/utils/storage';

const useStepStore = create((set, get) => ({
  // Step state
  steps: null,
  currentStep: 1,

  // Initialize steps from storage
  initSteps: () => {
    const encrypted = StorageService.get('scholarSteps');
    if (encrypted) {
      try {
        const steps = decryptData(encrypted);
        if (steps) {
          const current = get().calculateCurrentStep(steps);
          set({ steps, currentStep: current });
        }
      } catch (error) {
        console.error('Error loading steps:', error);
      }
    }
  },

  // Set steps and save encrypted
  setSteps: (steps) => {
    try {
      const encrypted = encryptData(steps);
      if (encrypted) {
        StorageService.set('scholarSteps', encrypted);
        const current = get().calculateCurrentStep(steps);
        set({ steps, currentStep: current });
      }
    } catch (error) {
      console.error('Error saving steps:', error);
    }
  },

  // Calculate current step (first incomplete step)
  calculateCurrentStep: (steps) => {
    if (!steps) return 1;
    for (let i = 1; i <= 9; i++) {
      if (!steps[`step_${i}`]) return i;
    }
    return 9; // All completed
  },

  // Complete a step
  completeStep: (stepNumber) => {
    const { steps } = get();
    const updatedSteps = {
      ...steps,
      [`step_${stepNumber}`]: true,
      [`step_${stepNumber}At`]: new Date().toISOString()
    };
    get().setSteps(updatedSteps);
    return updatedSteps;
  },

  // Check if steps 1-5 are editable (only if step 5 not completed)
  canEditSteps: () => {
    const { steps } = get();
    return !steps?.step_5;
  },

  // Check if a specific step is editable
  canEditStep: (stepNumber) => {
    const { steps } = get();
    // Steps 1-5: editable only if step 5 is not completed
    if (stepNumber >= 1 && stepNumber <= 5) {
      return !steps?.step_5;
    }
    // Steps 6 and beyond: always editable (not affected by payment completion)
    return true;
  },

  // Check if step is completed
  isStepCompleted: (stepNumber) => {
    const { steps } = get();
    // Step is completed only if it's explicitly true in the database
    return steps?.[`step_${stepNumber}`] === true;
    // return true; // <--- temp true for developement
  },

  // Fetch steps from API by sasid
  fetchSteps: async (sasid) => {
    try {
      const steps = await scholarAuthService.getApplicationStatus(sasid);
      if (steps) {
        get().setSteps(steps);
        return steps;
      }
    } catch (error) {
      console.error('Error fetching steps:', error);
      return null;
    }
  },



  // Clear steps
  clearSteps: () => {
    StorageService.remove('scholarSteps');
    set({ steps: null, currentStep: 1 });
  }
}));

export default useStepStore;