// store/selectedScholarAuthStore.js - For selected/dashboard scholars
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

const useSelectedScholarAuthStore = create((set, get) => ({
  // Auth state
  isAuthenticated: false,
  user: null,
  isLoading: true,
  isInitialized: false,
  courseWorkCompleted: false,
  courseWorkFeePaid: false,
  synopsisApproved: false,
  pendingPaymentsCount: 0,

  // Initialize auth from localStorage
  initializeAuth: () => {
    set({ isLoading: true });

    const token = StorageService.get('selectedScholarAuthToken');
    const user = StorageService.get('selectedScholarUser');

    if (token && user) {
      try {
        // Check if token is expired
        if (user.tokenExp) {
          const currentTime = Math.floor(Date.now() / 1000);
          if (currentTime >= user.tokenExp) {
            console.log('Selected scholar token expired during initialization');
            StorageService.remove('selectedScholarAuthToken');
            StorageService.remove('selectedScholarUser');
            set({ 
              isAuthenticated: false, 
              user: null, 
              isLoading: false,
              isInitialized: true
            });
            return;
          }

          set({ 
            isAuthenticated: true, 
            user, 
            isLoading: false,
            isInitialized: true
          });
          
          // Fetch both course work and synopsis status after initialization
          get().fetchProgressStatus();
        } else {
          throw new Error('Failed to decrypt user data');
        }

        set({ 
          isAuthenticated: true, 
          user, 
          isLoading: false,
          isInitialized: true
        });
      } catch (error) {
        console.error('Selected scholar auth initialization error:', error);
        StorageService.remove('selectedScholarAuthToken');
        StorageService.remove('selectedScholarUser');
        set({ 
          isAuthenticated: false, 
          user: null, 
          isLoading: false,
          isInitialized: true
        });
      }
    } else {
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
          tokenExp: decodedToken.exp,
          userType: 'SH_SELECTED' // Selected scholar type
        };

        // Encrypt user data before storing
        const encryptedUser = enhancedUserData;
        
        if (encryptedUser) {
          StorageService.set('selectedScholarAuthToken', token);
          StorageService.set('selectedScholarUser', encryptedUser);
          set({ isAuthenticated: true, user: enhancedUserData });
          
          // Fetch both course work and synopsis status after login
          get().fetchProgressStatus();
        } else {
          throw new Error('Failed to encrypt user data');
        }
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
        userType: 'SH_SELECTED'
      };
      StorageService.set('selectedScholarAuthToken', token);
      StorageService.set('selectedScholarUser', fallbackUserData);
      set({ isAuthenticated: true, user: fallbackUserData });
      
      // Fetch both course work and synopsis status after login
      get().fetchProgressStatus();
    }
  },

  // Logout action
  logout: () => {
    StorageService.clear();
    set({ isAuthenticated: false, user: null, courseWorkCompleted: false, courseWorkFeePaid: false, synopsisApproved: false, pendingPaymentsCount: 0 });
  },

  // Set loading state
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // Get SID from user data
  getSId: () => {
    const { user } = get();
    return user?.sId || null;
  },

  // Check if token is expired
  isTokenExpired: () => {
    const { user } = get();
    if (!user?.tokenExp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= user.tokenExp;
  },

  // Fetch both course work and synopsis status
  fetchProgressStatus: async () => {
    const { user } = get();
    if (!user?.sId) return;

    try {
      // Dynamic import to avoid circular dependency
      const { isCourseWorkCompleted, isCourseWorkFeePaid, isSynopsisApproved } = await import('@/services/courseWorkService');
      
      // Fetch course work status
      const courseWorkCompleted = await isCourseWorkCompleted(user.sId);
      set({ courseWorkCompleted });

      // Fetch coursework fee payment status
      const courseWorkFeePaid = await isCourseWorkFeePaid(user.sId);
      set({ courseWorkFeePaid });

      // Only check synopsis if course work is completed AND fee is paid
      if (courseWorkCompleted && courseWorkFeePaid) {
        const synopsisApproved = await isSynopsisApproved(user.sId);
        set({ synopsisApproved });
      } else {
        set({ synopsisApproved: false });
      }

      // Fetch pending payments count
      await get().fetchPendingPaymentsCount();
    } catch (error) {
      console.error('Error fetching progress status:', error);
      set({ courseWorkCompleted: false, courseWorkFeePaid: false, synopsisApproved: false }); // Default to locked
    }
  },

  // Fetch course work status (kept for backward compatibility)
  fetchCourseWorkStatus: async () => {
    await get().fetchProgressStatus();
  },

  // Get course work completion status
  isCourseWorkCompleted: () => {
    const { courseWorkCompleted } = get();
    return courseWorkCompleted;
  },

  // Get coursework fee payment status
  isCourseWorkFeePaid: () => {
    const { courseWorkFeePaid } = get();
    return courseWorkFeePaid;
  },

  // Get synopsis approval status
  isSynopsisApproved: () => {
    const { synopsisApproved } = get();
    return synopsisApproved;
  },

  // Fetch pending payments count
  fetchPendingPaymentsCount: async () => {
    const { user } = get();
    if (!user?.sId) return;

    try {
      const API = (await import('@/services/API')).default;
      const response = await API.get(`/ScholarPayments/by-sid/${user.sId}`);
      const payments = response.data || [];
      
      // Count payments with status 0 (pending)
      const pendingCount = payments.filter(payment => payment.paymentStatus === 0).length;
      set({ pendingPaymentsCount: pendingCount });
    } catch (error) {
      console.error('Error fetching pending payments count:', error);
      set({ pendingPaymentsCount: 0 });
    }
  },

  // Get pending payments count
  getPendingPaymentsCount: () => {
    const { pendingPaymentsCount } = get();
    return pendingPaymentsCount;
  },

  // Check if all thesis documents are uploaded
  checkThesisUploadStatus: async () => {
    const { user } = get();
    if (!user?.sId) return false;

    try {
      // Dynamic import to avoid circular dependency
      const API = (await import('@/services/API')).default;
      const response = await API.get(`/Thesis/check-all-upload/${user.sId}`);
      return response.data.isAllUploaded;
    } catch (error) {
      console.error('Error checking thesis upload status:', error);
      return false;
    }
  }

}));

export default useSelectedScholarAuthStore;