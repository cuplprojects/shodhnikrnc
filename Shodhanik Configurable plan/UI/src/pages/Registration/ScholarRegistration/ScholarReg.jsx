import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';


//components import
import Steps from './components/Steps';
import UniversityBanner from '../components/UniversityBanner';


const ScholarReg = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Map routes to step IDs
  const routeToStepMap = {
    '/register-scholar/home': 0,
    '/register-scholar/personal-info': 1,
    '/register-scholar/educational-details': 2,
    '/register-scholar/upload-documents': 3,
    '/register-scholar/preview': 4,
    '/register-scholar/payment': 5,
    '/register-scholar/print': 6,
    '/register-scholar/status': 7,
    '/register-scholar/fee-submission': 8,
    '/register-scholar/admission-details': 9,

    //  '/register-scholar/interview-remark': 8,
    // '/register-scholar/upload-documents-counselling': 9,
    // '/register-scholar/counselling-fee': 10,
    // '/register-scholar/admission-fee': 11,
    // '/register-scholar/admission-details': 12,
  };

  // Sync currentStep with current route
  useEffect(() => {
    const stepId = routeToStepMap[location.pathname];
    console.log('Scholar Route changed:', location.pathname, 'Step ID:', stepId);
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

export default ScholarReg;