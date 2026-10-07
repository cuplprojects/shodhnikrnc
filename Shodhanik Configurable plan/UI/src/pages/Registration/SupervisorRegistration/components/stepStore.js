import { create } from 'zustand';
import { encryptData, decryptData } from '@/utils/encryptionUtils';
import API from '@/services/API';
import StorageService from '@/utils/storage';

const useStepSupStore = create((set, get) => ({
  // Step state
  steps: null,
  currentStep: 1,
  isInitialized: false,

  // Initialize steps from storage
  initSteps: () => {
    if (get().isInitialized) {
      console.log('Steps already initialized, returning existing steps:', get().steps);
      return get().steps;
    }
    
    const encrypted = StorageService.get('supervisorSteps');
    // console.log('Initializing steps from storage, encrypted data exists:', !!encrypted);
    
    if (encrypted) {
      try {
        const steps = decryptData(encrypted);
        console.log('Decrypted steps from storage:', steps);
        
        if (steps && typeof steps === 'object' && !Array.isArray(steps)) {
          const current = get().calculateCurrentStep(steps);
          set({ steps, currentStep: current, isInitialized: true });
          console.log('Steps successfully loaded from storage:', steps);
          return steps;
        } else {
          console.warn('Invalid steps data in storage:', steps);
        }
      } catch (error) {
        console.error('Error loading steps from storage:', error);
        // Clear corrupted data
        StorageService.remove('supervisorSteps');
      }
    }
    
    set({ isInitialized: true });
    // console.log('No valid steps found in storage, returning null');
    return null;
  },

  // Set steps and save encrypted
  setSteps: (steps) => {
    try {
      console.log('Setting steps in store:', steps);
      const encrypted = encryptData(steps);
      if (encrypted) {
        StorageService.set('supervisorSteps', encrypted);
        const current = get().calculateCurrentStep(steps);
        set({ steps, currentStep: current, isInitialized: true });
        console.log('Steps saved to storage and store updated');
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
    return 9; // All completed, should be step 8 (Status of Application)
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

  // Check if steps 1-4 are editable (only if step 5 not completed)
  canEditSteps: () => {
    const { steps } = get();
    return !steps?.step_6;
  },

  // Check if step is completed
  isStepCompleted: (stepNumber) => {
    const { steps } = get();
    return steps?.[`step_${stepNumber}`] || false;
  },

  // Check if step is accessible (completed steps + next incomplete step)
  isStepAccessible: (stepNumber) => {
    const { steps } = get();
    if (!steps) return stepNumber === 0 || stepNumber === 1; // Home and first step always accessible
    
    // Home is always accessible
    if (stepNumber === 0) return true;
    
    // Check if this step is completed
    if (steps[`step_${stepNumber}`]) return true;

    // Error 3 fix
    // Special case: If step 6 (Payment) is completed, allow access to both step 7 and step 8
    if ((stepNumber === 8 || stepNumber === 9) && steps.step_7) return true;
    
    // Check if this is the next step (first incomplete step)
    for (let i = 1; i <= 9; i++) {
      if (!steps[`step_${i}`]) {
        return i === stepNumber;
      }
    }
    
    return false;
  },

  // Check screening status for a supervisor
  checkScreeningStatus: async (supId) => {
    try {
      if (!supId) return null;
      
      const response = await API.get(`/SupervisorScreening/Screening?supId=${supId}`);
      const screeningData = response.data;
      
      if (screeningData?.screening) {
        const screening = screeningData.screening;
        const hasRejectedScreening = 
          screening.screening1Status === 2 ||
          screening.screening2Status === 2 ||
          screening.screening3Status === 2 ||
          screening.screening4Status === 2 ||
          screening.screening5Status === 2 ||
          screening.screening6Status === 2;
        
        return {
          hasRejectedScreening,
          screeningData: screening
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching screening data:', error);
      return null;
    }
  },

  // Check if step is in read-only mode (steps 1-5 after step 6 is reached)
  isStepReadOnly: (stepNumber, supervisorData = null) => {
    const { steps } = get();
    if (!steps) return false;
    
    // If isAccepted is 2, allow editing (turn off read-only)
    if (supervisorData && supervisorData.isAccepted === 2) {
      return false;
    }
    
    // Check if supervisor has rejected screening status
    if (supervisorData && supervisorData.hasRejectedScreening) {
      return false;
    }
    
    // Steps 1-5 become read-only after step 6 is reached (payment step)
    if (stepNumber >= 1 && stepNumber <= 6 && steps.step_7) {
      return true;
    }
    return false;
  },

  // Get the current active step (first incomplete step)
  getCurrentActiveStep: () => {
    const { steps } = get();
    if (!steps) return 1;
    
    for (let i = 1; i <= 9; i++) {
      if (!steps[`step_${i}`]) {
        return i;
      }
    }
    
    return 9; // All steps completed
  },

  // Fetch steps from API by supId
  fetchSteps: async (supId) => {
    try {
      if (!supId) {
        console.warn('No supId provided to fetchSteps');
        return null;
      }
      
      console.log('Fetching steps from API for supId:', supId);
      const response = await API.get(`SupervisorApplicationStatus/ByUser?supId=${supId}`);
      let steps = response?.data || response;
      
      // Handle array response - take the first object
      if (Array.isArray(steps) && steps.length > 0) {
        steps = steps[0];
      }
      
      if (steps && typeof steps === 'object' && !Array.isArray(steps)) {
        // Always update store with API data (API is source of truth)
        get().setSteps(steps);
        console.log('Steps fetched from API and updated in store:', steps);
        return steps;
      }
      
      console.warn('Invalid steps data received from API:', steps);
      return null;
    } catch (error) {
      console.error('Error fetching steps from API:', error);
      // If API fails, try to use localStorage as fallback
      const localSteps = get().initSteps();
      if (localSteps) {
        console.log('Using localStorage as fallback after API error');
        return localSteps;
      }
      return null;
    }
  },

  // Force refresh steps from API (ignores localStorage)
  refreshSteps: async (supId) => {
    try {
      const steps = await get().fetchSteps(supId);
      return steps;
    } catch (error) {
      console.error('Error refreshing steps:', error);
      return null;
    }
  },

  // Fetch steps from API by SID

  // Clear steps
  clearSteps: () => {
    StorageService.remove('supervisorSteps');
    set({ steps: null, currentStep: 1, isInitialized: false });
  },

  // Debug method to check storage data
  debugLocalStorage: () => {
    const encrypted = StorageService.get('supervisorSteps');
    console.log('Raw localStorage data:', encrypted);
    
    if (encrypted) {
      try {
        const decrypted = decryptData(encrypted);
        console.log('Decrypted localStorage data:', decrypted);
        return decrypted;
      } catch (error) {
        console.error('Error decrypting localStorage data:', error);
        return null;
      }
    }
    return null;
  },

  // Force refresh from API (clears localStorage first)
  forceRefreshFromAPI: async (supId) => {
    try {
      console.log('Force refreshing steps from API...');
      // Clear storage first
      StorageService.remove('supervisorSteps');
      set({ steps: null, currentStep: 1, isInitialized: false });
      
      // Fetch fresh data from API
      const steps = await get().fetchSteps(supId);
      return steps;
    } catch (error) {
      console.error('Error force refreshing steps:', error);
      return null;
    }
  }
}));

// Auto-initialize on store creation
useStepSupStore.getState().initSteps();

export default useStepSupStore;