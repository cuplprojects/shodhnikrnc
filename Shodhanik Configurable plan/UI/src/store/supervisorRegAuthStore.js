// store/supervisorRegAuthStore.js - For registration supervisors
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

const useSupervisorRegAuthStore = create((set, get) => ({
  // Auth state
  isAuthenticated: false,
  user: null,
  isLoading: true,
  isInitialized: false,

  // Initialize auth from localStorage
  initializeAuth: () => {
    set({ isLoading: true });

    const token = StorageService.get('supervisorRegAuthToken');
    const user = StorageService.get('supervisorRegUser');

    if (token && user) {
      try {
        // Check if token is expired
        if (user.tokenExp) {
          const currentTime = Math.floor(Date.now() / 1000);
          if (currentTime >= user.tokenExp) {
            console.log('Supervisor registration token expired during initialization');
            StorageService.remove('supervisorRegAuthToken');
            StorageService.remove('supervisorRegUser');
            StorageService.remove('supervisorSteps');
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
        
        // Initialize step store and fetch from API if needed
        import('@/pages/registration/SupervisorRegistration/components/stepStore').then(async ({ default: useStepStore }) => {
          const stepStore = useStepStore.getState();
          
          // Try to fetch from API first
          if (user.supId) {
            try {
              const { supervisorAuthService } = await import('@/services/authService');
              const existingSteps = await supervisorAuthService.getApplicationStatus(parseInt(user.supId));
              stepStore.setSteps(existingSteps);
            } catch (error) {
              // No existing steps found, use localStorage or defaults
              stepStore.initSteps();
            }
          } else {
            stepStore.initSteps();
          }
        }).catch(() => {
          // If step store doesn't exist yet, that's okay
          console.log('Supervisor step store not found - will be created when needed');
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        StorageService.remove('supervisorRegAuthToken');
        StorageService.remove('supervisorRegUser');
        StorageService.remove('supervisorSteps');
        set({ 
          isAuthenticated: false, 
          user: null, 
          isLoading: false,
          isInitialized: true
        });
      }
    } else {
      StorageService.remove('supervisorSteps');
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
      
      // Decode JWT to extract Supervisor ID
      const decodedToken = decodeJWT(token);
      if (decodedToken) {
        // Extract Supervisor ID from the JWT claim
        const supId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
        
        // Enhanced user data with decoded JWT info
        const enhancedUserData = {
          ...userData,
          supId: supId,
          tempAutogen: decodedToken.TempAutogen === "True",
          permAutogen: decodedToken.PermAutogen,
          tokenExp: decodedToken.exp,
          userType: 'SUP_REG' // Registration supervisor type
        };

        // Store user data directly without encryption
        StorageService.set('supervisorRegAuthToken', token);
        StorageService.set('supervisorRegUser', enhancedUserData);
        set({ isAuthenticated: true, user: enhancedUserData });
      } else {
        throw new Error('Failed to decode JWT token');
      }
    } catch (error) {
      console.error('Login error:', error);
      // Clear storage on error too
      StorageService.clear();
      // Fallback to original behavior
      const fallbackUserData = {
        ...userData,
        userType: 'SUP_REG'
      };
      StorageService.set('supervisorRegAuthToken', token);
      StorageService.set('supervisorRegUser', fallbackUserData);
      set({ isAuthenticated: true, user: fallbackUserData });
    }
  },

  // Logout action
  logout: () => {
    StorageService.clear();
    
    // Clear step store if it exists
    import('@/pages/registration/SupervisorRegistration/components/stepStore').then(({ default: useStepStore }) => {
      useStepStore.getState().clearSteps();
    }).catch(() => {
      // Step store doesn't exist yet, that's okay
    });
    
    set({ isAuthenticated: false, user: null });
  },

  // Set loading state
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // Get Supervisor ID from user data
  getSupId: () => {
    const { user } = get();
    return user?.supId || null;
  },

  // Check if token is expired
  isTokenExpired: () => {
    const { user } = get();
    if (!user?.tokenExp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= user.tokenExp;
  }

}));

export default useSupervisorRegAuthStore;