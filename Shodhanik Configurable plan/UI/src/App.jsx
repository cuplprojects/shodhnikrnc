/**
 * Main App Component
 *
 * This is the root component that handles routing for the entire application.
 * It manages three different authentication systems:
 * - Staff Authentication (for internal staff/Users)
 * - Scholar Authentication (for scholar registration process)
 * - Supervisor Authentication (for supervisor registration process)
 *
 * The app uses different routers based on environment (HashRouter for dev, BrowserRouter for production)
 * and implements permission-based access control for route protection.
 */

import { useEffect } from "react";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// css import
import './App.css'

// Debug utilities (development only)
if (import.meta.env.DEV) {
  import('./utils/debugSteps.js');
}

// wrapper imports
import GuestRoutes from '@/routes/GuestRoutes'
import ProtectedRoutes from '@/routes/ProtectedRoutes'
import RegRoutes from '@/routes/RegRoutes'
import AuthGuard from '@/routes/AuthGuard'
import AllowedUser from '@/routes/AllowedUser'
import AutoRoutes from '@/routes/AutoRoutes'

// Global Service Components
import NotificationContainer from "@/components/NotificationContainer"; // Global notification system
import ConfirmationProvider from "@/components/ConfirmationProvider"; // Global confirmation modals

// auth stores
import useStaffAuthStore from '@/store/staffAuthStore';
import useScholarAuthStore from '@/store/scholarAuthStore';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';

//guest pages imports
import StaffLogin from "@/pages/auth/staffAuth/StaffLogin"

// Scholar Authentication Pages - For scholar registration process
import ScholarLogin from "@/pages/auth/scholarRegAuth/ScholarRegLogin";
import ScholarRegister from "@/pages/auth/scholarRegAuth/ScholarRegReg";
import ScholarForgotPass from "@/pages/auth/scholarRegAuth/ScholarRegForgotPass";
import ScholarTnC from "@/pages/auth/scholarRegAuth/ScholarRegTnC";

//supervisor auth pages imports
import SupLogin from '@/pages/auth/supRegAuth/SupLogin'
import SupRegister from '@/pages/auth/supRegAuth/SupReg'
import SupForgotPass from '@/pages/auth/supRegAuth/SupForgotPass'
import SupTnC from '@/pages/auth/supRegAuth/SupTnC'
import SupChangePassword from '@/pages/auth/supRegAuth/SupChangePassword'

// Scholar Registration Pages - Multi-step registration process for scholars
import ScholarReg from "@/pages/registration/ScholarRegistration/ScholarReg";
import Home from "@/pages/registration/ScholarRegistration/components/Home";
import PersonalInfo from "@/pages/registration/ScholarRegistration/forms/PersonalInfo";
import EducationalDetails from "@/pages/registration/ScholarRegistration/forms/EducationalDetails";
import UploadDocuments from "@/pages/registration/ScholarRegistration/forms/UploadDocuments";
import PreviewApplication from "@/pages/registration/ScholarRegistration/forms/PreviewApplication";
import Payment from "@/pages/registration/ScholarRegistration/forms/Payment";
import PrintFinalApplication from "@/pages/registration/ScholarRegistration/forms/PrintFinalApplication";
import StatusOfApplication from "@/pages/registration/ScholarRegistration/forms/StatusOfApplication";
import VerificationAndAdmiFee from '@/pages/registration/ScholarRegistration/forms/VerificationAndAdmiFee'
import AdmissionDetails from '@/pages/registration/ScholarRegistration/forms/AdmissionDetails'

// Supervisor Registration Pages - Multi-step registration process for supervisors
import SupervisorReg from "@/pages/registration/SupervisorRegistration/SupervisorReg";
import SHome from "@/pages/registration/SupervisorRegistration/components/Home";
import SPersonalInfo from "@/pages/registration/SupervisorRegistration/forms/PersonalInfo";
import SEducationalDetails from "@/pages/registration/SupervisorRegistration/forms/EducationalDetails";
import SExperienceDetails from "./pages/Registration/SupervisorRegistration/forms/ExperienceDetails.jsx";
import SResearchPapers from "@/pages/registration/SupervisorRegistration/forms/ResearchPapers";
import SUploadDocuments from "@/pages/registration/SupervisorRegistration/forms/UploadDocuments";
import SPreviewApplication from "@/pages/registration/SupervisorRegistration/forms/PreviewApplication";
import SPayment from "@/pages/registration/SupervisorRegistration/forms/Payment";
import SPrintFinalApplication from "@/pages/registration/SupervisorRegistration/forms/PrintFinalApplication";
import SStatusOfApplication from "@/pages/registration/SupervisorRegistration/forms/StatusOfApplication";

// Layout imports
import OuterLayout from '@/layouts/OuterLayout';
import InnerLayout from '@/layouts/InnerLayout';
import RegLayout from './layouts/RegLayout.jsx';
import StepGuard from '@/routes/StepGuard';
import ThesisEvaluatioReport from "@/pages/ConsentForms/ThesisEvaluatioReport.jsx";
import ThesisEvaluationConsent from "@/pages/ConsentForms/ThesisEvaluationConsent.jsx";
import ThesisSummary from "@/pages/ConsentForms/ThesisSummary.jsx";

//No Auto Fill Wrapper

function App() {
  // Extract authentication state and methods from all auth stores
  const {
    initializeAuth: initStaffAuth,
    isLoading: staffLoading,
    isInitialized: staffInitialized,
  } = useStaffAuthStore();

  const {
    initializeAuth: initScholarAuth,
    isLoading: scholarLoading,
    isInitialized: scholarInitialized,
  } = useScholarAuthStore();

  const {
    initializeAuth: initScholarRegAuth,
    isLoading: scholarRegLoading,
    isInitialized: scholarRegInitialized,
  } = useScholarRegAuthStore();

  const {
    initializeAuth: initSelectedScholarAuth,
    isLoading: selectedScholarLoading,
    isInitialized: selectedScholarInitialized,
  } = useSelectedScholarAuthStore();

  const {
    initializeAuth: initSupervisorRegAuth,
    isLoading: supervisorRegLoading,
    isInitialized: supervisorRegInitialized,
  } = useSupervisorRegAuthStore();

  const {
    initializeAuth: initSupervisorAuth,
    isLoading: supervisorLoading,
    isInitialized: supervisorInitialized,
  } = useSupervisorAuthStore();

  // Router Selection: Use HashRouter for development, BrowserRouter for production
  // HashRouter is better for development as it doesn't require server configuration
  const stage = import.meta.env.VITE_APP_STAGE;
  const Router = stage === "production" ? BrowserRouter : HashRouter;

  // Initialize all authentication systems when the app loads
  useEffect(() => {
    initStaffAuth();
    initScholarAuth();
    initScholarRegAuth();
    initSelectedScholarAuth();
    initSupervisorRegAuth();
    initSupervisorAuth();
  }, [initStaffAuth, initScholarAuth, initScholarRegAuth, initSelectedScholarAuth, initSupervisorRegAuth, initSupervisorAuth]);

  // Global loading state - show spinner while any auth system is initializing
  const isLoading = staffLoading || scholarLoading || scholarRegLoading || selectedScholarLoading || supervisorRegLoading || supervisorLoading;
  const isInitialized = staffInitialized && scholarInitialized && scholarRegInitialized && selectedScholarInitialized && supervisorRegInitialized && supervisorInitialized;

  // Show loading screen while authentication systems are initializing
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {/* Global Components - Mounted outside Routes to be available everywhere */}
      <NotificationContainer />
      <ConfirmationProvider />
      <Routes>
        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Guest Routes with OuterLayout */}
        <Route element={
          <AuthGuard>
            <GuestRoutes>
              <OuterLayout />
            </GuestRoutes>
          </AuthGuard>
        } />
        {/* Auth routes */}
        {/* =================================================================================== */}
        {/* STAFF AUTHENTICATION ROUTES - For internal staff/Users */}
        {/* =================================================================================== */}
        <Route
          element={
            <AuthGuard>
              <GuestRoutes>
                <OuterLayout />
              </GuestRoutes>
            </AuthGuard>
          }
        >
          <Route path="/login" element={<StaffLogin />} />
        </Route>

        {/* =================================================================================== */}
        {/* SCHOLAR REGISTRATION ROUTES */}
        {/* =================================================================================== */}

        {/* Scholar Auth Routes */}
        <Route element={
          <AuthGuard>
            <RegRoutes mode="guest">
              <RegLayout />
            </RegRoutes>
          </AuthGuard>
        }>
          <Route path="/thesisevaluationreport" element={<ThesisEvaluatioReport />} />
          <Route path="/thesisevaluationconsent" element={<ThesisEvaluationConsent />} />
          <Route path="/thesissummary" element={<ThesisSummary />} />
        </Route>


        {/* Scholar Auth Routes */}
        <Route element={
          <AuthGuard>
            <RegRoutes type="scholar" mode="guest">
              <RegLayout />
            </RegRoutes>
          </AuthGuard>
        }>
          <Route path="/register-scholar/terms" element={<ScholarTnC />} />
          <Route path="/register-scholar/login" element={<ScholarLogin />} />
          <Route path="/register-scholar/register" element={<ScholarRegister />} />
          <Route path="/register-scholar/forgot-password" element={<ScholarForgotPass />} />
        </Route>

        {/* Scholar Registration Steps */}
        <Route element={
          <RegRoutes type="scholar" mode="reg">
            <RegLayout />
          </RegRoutes>
        }>
          <Route path="/register-scholar" element={<ScholarReg />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="personal-info" element={<StepGuard requiredStep={1}><PersonalInfo /></StepGuard>} />
            <Route path="educational-details" element={<StepGuard requiredStep={2}><EducationalDetails /></StepGuard>} />
            <Route path="upload-documents" element={<StepGuard requiredStep={3}><UploadDocuments /></StepGuard>} />
            <Route path="preview" element={<StepGuard requiredStep={4}><PreviewApplication /></StepGuard>} />
            <Route path="payment" element={<StepGuard requiredStep={5}><Payment /></StepGuard>} />
            <Route path="print" element={<StepGuard requiredStep={6}><PrintFinalApplication /></StepGuard>} />
            <Route path="status" element={<StepGuard requiredStep={7}><StatusOfApplication /></StepGuard>} />
            <Route path="fee-submission" element={<StepGuard requiredStep={8}><VerificationAndAdmiFee /></StepGuard>} />
            <Route path="admission-details" element={<StepGuard requiredStep={9}><AdmissionDetails /></StepGuard>} />
          </Route>
        </Route>

        {/* =================================================================================== */}
        {/* SUPERVISOR REGISTRATION ROUTES */}
        {/* =================================================================================== */}

        {/* Supervisor Auth Routes */}
        <Route element={
          <AuthGuard>
            <RegRoutes type="supervisor" mode="guest">
              <RegLayout />
            </RegRoutes>
          </AuthGuard>
        }>
          <Route path="/register-supervisor/terms" element={<SupTnC />} />
          <Route path="/register-supervisor/login" element={<SupLogin />} />
          <Route path="/register-supervisor/register" element={<SupRegister />} />
          <Route path="/register-supervisor/forgot-password" element={<SupForgotPass />} />
          <Route path="/register-supervisor/change-password" element={<SupChangePassword />} />
        </Route>

        {/* Supervisor Registration Steps */}
        <Route element={
          <RegRoutes type="supervisor" mode="reg">
            <RegLayout />
          </RegRoutes>
        }>
          <Route path="/register-supervisor" element={<SupervisorReg />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<SHome />} />
            <Route path="personal-info" element={<SPersonalInfo />} />
            <Route path="educational-details" element={<SEducationalDetails />} />
            <Route path="experience-details" element={<SExperienceDetails />} />
            <Route path="research-paper" element={<SResearchPapers />} />
            <Route path="upload-documents" element={<SUploadDocuments />} />
            <Route path="preview" element={<SPreviewApplication />} />
            <Route path="payment" element={<SPayment />} />
            <Route path="print" element={<SPrintFinalApplication />} />
            <Route path="status" element={<SStatusOfApplication />} />
          </Route>
        </Route>

        {/* =================================================================================== */}
        {/* DASHBOARD ROUTES - AUTO-GENERATED FROM CENTRALIZED CONFIG */}
        {/* =================================================================================== */}

        {/* Scholar Dashboard Routes */}
        <Route path="/scholar-dashboard" element={
          <AllowedUser type="SH">
            <InnerLayout />
          </AllowedUser>
        }>
          {AutoRoutes({ userType: "scholar" })}
        </Route>

        {/* Supervisor Dashboard Routes */}
        <Route path="/supervisor-dashboard" element={
          <AllowedUser type="SUP">
            <InnerLayout />
          </AllowedUser>
        }>
          {AutoRoutes({ userType: "supervisor" })}
        </Route>

        {/* Staff Dashboard Routes */}
        <Route element={
          <ProtectedRoutes>
            <InnerLayout />
          </ProtectedRoutes>
        }>
          <Route path="/dashboard/rbac" element={<Navigate to="/dashboard/rbac/roles" replace />} />
          {AutoRoutes({ userType: "staff" })}
        </Route>

        {/* =================================================================================== */}
        {/* FALLBACK ROUTE */}
        {/* =================================================================================== */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;