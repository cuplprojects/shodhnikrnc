import { Navigate, useLocation } from 'react-router-dom';
import useStepStore from '@/pages/registration/ScholarRegistration/components/stepStore';

const StepGuard = ({ children, requiredStep }) => {
  const location = useLocation();
  const { steps, isStepCompleted } = useStepStore();

  // If steps are not loaded yet, allow access (will be handled by parent components)
  if (!steps) {
    return children;
  }

  // Step mapping for routes
  const stepRoutes = {
    1: '/register-scholar/personal-info',
    2: '/register-scholar/educational-details', 
    3: '/register-scholar/upload-documents',
    4: '/register-scholar/preview',
    5: '/register-scholar/payment',
    6: '/register-scholar/print',
    7: '/register-scholar/status'
  };

  // Home route is always accessible
  if (location.pathname === '/register-scholar/home' || location.pathname === '/register-scholar') {
    return children;
  }

  // Check if user can access this step
  const canAccessStep = (stepNumber) => {
    // Step 1 is always accessible
    if (stepNumber === 1) return true;
    
    // For steps 6 and 7, step 5 must be completed
    if (stepNumber === 6 || stepNumber === 7) {
      return isStepCompleted(5);
    }
    
    // For steps 2-5, previous step must be completed
    return isStepCompleted(stepNumber - 1);
  };

  // If user cannot access this step, redirect to the appropriate step
  if (!canAccessStep(requiredStep)) {
    // Find the first incomplete step
    let redirectStep = 1;
    for (let i = 1; i <= 7; i++) {
      if (!isStepCompleted(i)) {
        redirectStep = i;
        break;
      }
    }
    
    const redirectPath = stepRoutes[redirectStep] || '/register-scholar/home';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default StepGuard;