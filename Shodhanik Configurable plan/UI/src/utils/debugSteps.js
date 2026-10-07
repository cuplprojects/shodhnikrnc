import { decryptData, encryptData } from './encryptionUtils';
import StorageService from './storage';

// Debug utility for supervisor steps storage
export const debugSupervisorSteps = () => {
  console.log('=== Supervisor Steps Debug ===');
  
  const encrypted = StorageService.get('supervisorSteps');
  console.log('1. Raw storage data exists:', !!encrypted);
  console.log('2. Raw storage data length:', encrypted?.length || 0);
  
  if (encrypted) {
    try {
      const decrypted = decryptData(encrypted);
      console.log('3. Decrypted data:', decrypted);
      console.log('4. Decrypted data type:', typeof decrypted);
      console.log('5. Is array:', Array.isArray(decrypted));
      
      if (decrypted && typeof decrypted === 'object') {
        console.log('6. Object keys:', Object.keys(decrypted));
        console.log('7. Has supId:', 'supId' in decrypted);
        console.log('8. Step statuses:', {
          step_1: decrypted.step_1,
          step_2: decrypted.step_2,
          step_3: decrypted.step_3,
          step_4: decrypted.step_4,
          step_5: decrypted.step_5,
          step_6: decrypted.step_6,
          step_7: decrypted.step_7,
          step_8: decrypted.step_8,
        });
      }
    } catch (error) {
      console.error('3. Decryption error:', error);
    }
  }
  
  console.log('=== End Debug ===');
};

// Test encryption/decryption with sample data
export const testStepsEncryption = () => {
  const sampleSteps = {
    id: 5,
    supId: 1,
    regAt: "0001-01-01T00:00:00",
    step_1: true,
    step_2: false,
    step_3: false,
    step_4: false,
    step_5: false,
    step_6: false,
    step_7: false,
    step_8: false,
    step_1At: "2025-12-12T07:34:11.078",
    step_2At: null,
    step_3At: null,
    step_4At: null,
    step_5At: null,
    step_6At: null,
    step_7At: null,
    step_8At: null
  };
  
  console.log('=== Testing Steps Encryption ===');
  console.log('1. Original data:', sampleSteps);
  
  const encrypted = encryptData(sampleSteps);
  console.log('2. Encrypted:', !!encrypted);
  
  if (encrypted) {
    const decrypted = decryptData(encrypted);
    console.log('3. Decrypted:', decrypted);
    console.log('4. Match original:', JSON.stringify(sampleSteps) === JSON.stringify(decrypted));
  }
  
  console.log('=== End Test ===');
};

// Clear and reset storage for testing
export const clearSupervisorSteps = () => {
  StorageService.remove('supervisorSteps');
  console.log('Supervisor steps cleared from storage');
};

// Force refresh from API (for debugging)
export const forceRefreshStepsFromAPI = async (supId) => {
  if (!supId) {
    console.error('supId is required for force refresh');
    return;
  }
  
  console.log('=== Force Refreshing Steps from API ===');
  const { forceRefreshFromAPI } = await import('../pages/Registration/SupervisorRegistration/components/stepStore');
  const useStepSupStore = (await import('../pages/Registration/SupervisorRegistration/components/stepStore')).default;
  
  const result = await useStepSupStore.getState().forceRefreshFromAPI(supId);
  console.log('Force refresh result:', result);
  console.log('=== End Force Refresh ===');
  return result;
};

// Make functions available globally for browser console testing
if (typeof window !== 'undefined') {
  window.debugSupervisorSteps = debugSupervisorSteps;
  window.testStepsEncryption = testStepsEncryption;
  window.clearSupervisorSteps = clearSupervisorSteps;
  window.forceRefreshStepsFromAPI = forceRefreshStepsFromAPI;
}