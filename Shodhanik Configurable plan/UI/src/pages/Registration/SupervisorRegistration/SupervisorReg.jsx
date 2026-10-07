import { useState, useEffect, use } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import API from '@/services/API';
import useStepSupStore from './components/stepStore';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';

//components import
import Steps from './components/Steps';
import UniversityBanner from '../components/UniversityBanner';


const SupervisorReg = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fetchSteps = useStepSupStore(state => state.fetchSteps);
  const initSteps = useStepSupStore(state => state.initSteps);
  const { user, getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();

  useEffect(() => {
    // Always fetch from API first if supId exists (API is source of truth)
    if (supId) {
      fetchSteps(supId);
    } else {
      // Only use localStorage as fallback if no supId
      initSteps();
    }
  }, [supId, initSteps, fetchSteps]);

  // Map routes to step IDs
  const routeToStepMap = {
    '/register-supervisor/home': 0,
    '/register-supervisor/personal-info': 1,
    '/register-supervisor/educational-details': 2,
    '/register-supervisor/experience-details' : 3,
    '/register-supervisor/research-paper': 4,
    '/register-supervisor/upload-documents': 5,
    '/register-supervisor/preview': 6,
    '/register-supervisor/payment': 7,
    '/register-supervisor/print': 8,
    '/register-supervisor/status': 9,
  };

  // Sync currentStep with current route
  useEffect(() => {
    const stepId = routeToStepMap[location.pathname];
    console.log('Supervisor Route changed:', location.pathname, 'Step ID:', stepId);
    if (stepId !== undefined) {
      setCurrentStep(stepId);
    }
  }, [location.pathname]);


  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleStepClick = (stepId) => {
    setCurrentStep(stepId);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Bar */}


      {/* University Banner */}
      <UniversityBanner
        isSidebarOpen={isSidebarOpen}
        handleHomeClick={handleHomeClick}
        toggleSidebar={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 bg-[#f9fafb]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4">

          <div className="lg:grid lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Steps */}
            <Steps
              handleStepClick={handleStepClick}
              currentStep={currentStep}
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
            />

            {/* Right Content Area - Outlet */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm min-h-[600px]">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default SupervisorReg;