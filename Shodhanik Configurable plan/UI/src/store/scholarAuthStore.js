// store/scholarAuthStore.js
import { create } from 'zustand';
import StorageService from '@/utils/storage';

// Helper function to decode JWT token
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
};

const useScholarAuthStore = create((set, get) => ({
  // Auth state
  isAuthenticated: false,
  user: null,
  isLoading: true,
  isInitialized: false,

  // Initialize auth from localStorage
  initializeAuth: () => {
    set({ isLoading: true });

    const token = StorageService.get('scholarAuthToken');
    const user = StorageService.get('scholarUser');

    if (token && user) {
      try {
        // Check token expiration
        if (user.tokenExp) {
          const currentTime = Math.floor(Date.now() / 1000);
          if (currentTime >= user.tokenExp) {
            console.log('Scholar token expired during initialization');
            StorageService.remove('scholarAuthToken');
            StorageService.remove('scholarUser');
            StorageService.remove('scholarSteps');
            set({ 
              isAuthenticated: false, 
              user: null, 
              isLoading: false,
              isInitialized: true
            });
            return;
          }
        }

        set({ 
          isAuthenticated: true, 
          user, 
          isLoading: false,
          isInitialized: true
        });
        
        // Initialize step store and fetch from API
        import('@/pages/registration/ScholarRegistration/components/stepStore').then(async ({ default: useStepStore }) => {
          const stepStore = useStepStore.getState();
          
          // Try to fetch from API first
          if (user.sId) {
            try {
              const { scholarAuthService } = await import('@/services/authService');
              const existingSteps = await scholarAuthService.getApplicationStatus(parseInt(user.sId));
              stepStore.setSteps(existingSteps);
            } catch (error) {
              // No existing steps found, use localStorage or defaults
              stepStore.initSteps();
            }
          } else {
            stepStore.initSteps();
          }
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        StorageService.remove('scholarAuthToken');
        StorageService.remove('scholarUser');
        StorageService.remove('scholarSteps');
        set({ 
          isAuthenticated: false, 
          user: null, 
          isLoading: false,
          isInitialized: true
        });
      }
    } else {
      StorageService.remove('scholarSteps');
      set({ 
        isAuthenticated: false,
        user: null, 
        isLoading: false,
        isInitialized: true
      });
    }
  },

  // Login action
  login: (userData, token) => {
    try {
      // Clear all storage first to prevent conflicts
      StorageService.clear();
      
      // Decode JWT to extract SID
      const decodedToken = decodeJWT(token);
      if (decodedToken) {
        // Extract SID from the JWT claim
        const sId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
        
        // Enhanced user data with decoded JWT info
        const enhancedUserData = {
          ...userData,
          sId: sId,
          tempAutogen: decodedToken.TempAutogen === "True",
          permAutogen: decodedToken.PermAutogen,
          tokenExp: decodedToken.exp
        };

        // Store user data directly without encryption
        StorageService.set('scholarAuthToken', token);
        StorageService.set('scholarUser', enhancedUserData);
        set({ isAuthenticated: true, user: enhancedUserData });
      } else {
        throw new Error('Failed to decode JWT token');
      }
    } catch (error) {
      console.error('Login error:', error);
      // Clear storage on error too
      StorageService.clear();
      // Fallback to original behavior
      StorageService.set('scholarAuthToken', token);
      StorageService.set('scholarUser', userData);
      set({ isAuthenticated: true, user: userData });
    }
  },

  // Logout action
  logout: () => {
    StorageService.clear();
    
    // Clear step store
    import('@/pages/registration/ScholarRegistration/components/stepStore').then(({ default: useStepStore }) => {
      useStepStore.getState().clearSteps();
    });
    
    set({ isAuthenticated: false, user: null });
  },

  // Set loading state
  setLoading: (loading) => {
    set({ isLoading: loading });
  },


}));

export default useScholarAuthStore;