import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './auth/LoginPage';
import ProtectedRoute from './auth/ProtectedRoute';
import AppLayout from './layout/AppLayout';

// Existing Project Pages
import ProjectListPage from './pages/projects/ProjectPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import GrantReceiptFormPage from './pages/projects/components/GrantReceiptFormPage';
import GrantReceiptHodQueuePage from './pages/projects/GrantReceiptHodQueuePage';
import GrantReceiptRncQueuePage from './pages/projects/GrantReceiptRncQueuePage';
import GrantReceiptDaQueuePage from './pages/projects/GrantReceiptDaQueuePage';
import GrantReceiptSuperintendentQueuePage from './pages/projects/GrantReceiptSuperintendentQueuePage';
import GrantReceiptDeputyRegistrarQueuePage from './pages/projects/GrantReceiptDeputyRegistrarQueuePage';
import GrantReceiptDeanQueuePage from './pages/projects/GrantReceiptDeanQueuePage';
import ReappropriationQueuePage from './pages/projects/ReappropriationQueuePage';
import HistoricalEntriesPage from './pages/projects/HistoricalEntriesPage';
import IndentDetailPage from './pages/procurement/IndentDetailPage';
import DynamicIndentDetailPage from './pages/procurement/DynamicIndentDetailPage';
import TravelDetailPage from './pages/travel/TravelDetailPage';
import RecruitmentDetailPage from './pages/recruitment/RecruitmentDetailPage';
import CandidateApplicationsPage from './pages/recruitment/CandidateApplicationsPage';
import AdvertisementTemplatesPage from './pages/recruitment/AdvertisementTemplatesPage';
import RncOfficeAdvertisementsPage from './pages/recruitment/RncOfficeAdvertisementsPage';
import ComputerCentreAdvertisementApprovalsPage from './pages/recruitment/ComputerCentreAdvertisementApprovalsPage';
import MyApplicationsPage from './pages/recruitment/MyApplicationsPage';
import VerifyEmailPage from './pages/recruitment/VerifyEmailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ManualPickerPage from './pages/manual/ManualPickerPage';
import HodManualPage from './pages/manual/HodManualPage';
import FacultyManualPage from './pages/manual/FacultyManualPage';
import ProposalsPage from './pages/proposals/ProposalsPage';
import ProposalCreatePage from './pages/proposals/ProposalCreatePage';
import ProposalDetailPage from './pages/proposals/ProposalDetailPage';
import HodProposalsPage from './pages/proposals/HodProposalsPage';
import RncOfficeProposalsPage from './pages/proposals/RncOfficeProposalsPage';
import ReportsPage from './pages/reports/ReportsPage';

// New Pages
import DashboardPage from './pages/DashboardPage';
import FacultyExpenditureDetailsPage from './pages/FacultyExpenditureDetailsPage';
import AddGrantReceivedPage from './pages/AddGrantReceivedPage';
import ProposalCreationPage from './pages/projects/ProposalCreationPage';
import RecruitmentPage from './pages/RecruitmentPage';
import FellowshipsPage from './pages/FellowshipsPage';
import ProcurementPage from './pages/ProcurementPage';
import LeavesPage from './pages/LeavesPage';
import FellowTravelsPage from './pages/FellowTravelsPage';
import NocPage from './pages/NocPage';
import ExperienceCertificatePage from './pages/ExperienceCertificatePage';
import MedicalFacilityPage from './pages/MedicalFacilityPage';
import IdCardRequestPage from './pages/IdCardRequestPage';
import ProfilePage from './pages/ProfilePage';
import CreateFacultyUser from './pages/CreateFacultyUser';
import ManageNewsEvents from './pages/ManageNewsEvents';
import ManageAnnouncements from './pages/ManageAnnouncements';
import ManageFundingAgencies from './pages/ManageFundingAgencies';
import ManageDepartments from './pages/ManageDepartments';
import ManageEmailTemplatesPage from './pages/ManageEmailTemplatesPage';
import EmailLogPage from './pages/EmailLogPage';
import GenerateManpowerOfferLetter from './pages/GenerateManpowerOfferLetter';
import ViewExpenditure from './pages/ViewExpenditure';
import ViewGeneratedOfferLetter from './pages/ViewGeneratedOfferLetter';
import PaymentVoucherPage from './pages/PaymentVoucherPage';
import NotingPage from './pages/NotingPage';
import ProcessBillPage from './pages/ProcessBillPage';
import ProcessBillFormPage from './pages/ProcessBillFormPage';
import TravelBillFormPage from './pages/TravelBillFormPage';



// Office Pages (Deputy Registrar)
import ProcessedRequestsPage from './pages/office/ProcessedRequestsPage';
import ApprovedRequestsPage from './pages/office/ApprovedRequestsPage';
import ForwardedForActionPage from './pages/office/ForwardedForActionPage';
import ManageWorkflowsPage from './pages/admin/ManageWorkflowsPage';
import ManageRolesPage from './pages/admin/ManageRolesPage';
import ManageUsersPage from './pages/admin/ManageUsersPage';
import UpdatePaymentPage from './pages/office/UpdatePaymentPage';
import GenerateOfferLetterPage from './pages/office/GenerateOfferLetterPage';
import ViewOfferLettersPage from './pages/office/ViewOfferLettersPage';
import AssignedRequestsPage from './pages/office/AssignedRequestsPage';

// HOD & Approval Module Pages
import DepartmentDashboardPage from './pages/DepartmentDashboardPage';
import FellowshipApprovalPage from './pages/FellowshipApprovalPage';
import LeaveApprovalPage from './pages/LeaveApprovalPage';
import IndentApprovalPage from './pages/IndentApprovalPage';
import TravelApprovalPage from './pages/TravelApprovalPage';
import JoiningApprovalPage from './pages/JoiningApprovalPage';
import ConsultancyAssignmentPage from './pages/ConsultancyAssignmentPage';
import OverheadDashboardPage from './pages/OverheadDashboardPage';
import NomineeAvailabilityPage from './pages/recruitment/NomineeAvailabilityPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import RegistrationPendingPage from './pages/RegistrationPendingPage';
import ShodhanikSsoLandingPage from './auth/ShodhanikSsoLandingPage';
import PendingFacultyRegistrationsPage from './pages/PendingFacultyRegistrationsPage';

import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes. Registration and verification are necessarily
            anonymous -- an applicant has no account until they finish them. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage defaultIsRegistering={true} />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Where the gateway sends a Shodhanik Supervisor after SSO -- see the
            Shodhanik-x-RNC integration plan. Public: the whole point of this
            route is to establish the RNC session, so it can't require one. */}
        <Route path="/sso/shodhanik" element={<ShodhanikSsoLandingPage />} />

        {/* User manuals -- public, screenshot-based slide decks generated
            from docs/manual/*.pdf, viewable without signing in so a link can
            be shared freely. */}
        <Route path="/manual" element={<ManualPickerPage />} />
        <Route path="/manual/hod" element={<HodManualPage />} />
        <Route path="/manual/faculty" element={<FacultyManualPage />} />

        {/* Protected Routes Wrapper */}
        <Route element={<ProtectedRoute />}>
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/registration-pending" element={<RegistrationPendingPage />} />

          {/* Layout Wrapper */}
          <Route element={<AppLayout />}>

            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Projects Module */}
            <Route path="/projects" element={<ProjectListPage />} />
            <Route path="/projects/new" element={<ProposalCreationPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects/:id/edit" element={<ProposalCreationPage mode="edit" />} />
            <Route path="/projects/:id/grant-receipts/new" element={<GrantReceiptFormPage />} />
            {/* Grant-receipt approval chain (GrantReceiptWorkflowSeeder) queue
                pages -- discovery aids so a reviewer can find receipts awaiting
                their action without already knowing the project/receipt id,
                mirroring /proposals/hod-queue and /proposals/rnc-queue. */}
            <Route path="/projects/grant-receipts/hod-queue" element={<GrantReceiptHodQueuePage />} />
            <Route path="/projects/grant-receipts/rnc-queue" element={<GrantReceiptRncQueuePage />} />
            <Route path="/projects/grant-receipts/da-queue" element={<GrantReceiptDaQueuePage />} />
            <Route path="/projects/grant-receipts/superintendent-queue" element={<GrantReceiptSuperintendentQueuePage />} />
            <Route path="/projects/grant-receipts/dr-queue" element={<GrantReceiptDeputyRegistrarQueuePage />} />
            <Route path="/projects/grant-receipts/dean-queue" element={<GrantReceiptDeanQueuePage />} />
            
            <Route path="/projects/reappropriations/queue" element={<ReappropriationQueuePage />} />
            <Route path="/projects/historical-entries" element={<HistoricalEntriesPage />} />
            <Route path="/procurement/:indentType/:indentId" element={<IndentDetailPage />} />
            <Route path="/procurement/dynamic/:indentId" element={<DynamicIndentDetailPage />} />
            <Route path="/travel/:travelRequestId" element={<TravelDetailPage />} />
            <Route path="/recruitments/:recruitmentId" element={<RecruitmentDetailPage />} />
            <Route path="/recruitments/:recruitmentId/applications" element={<CandidateApplicationsPage />} />
            {/* recruitment.pi-manage's seeded PageCatalogue route (Faculty,
                AccessScope.Own) had no page wired to it yet -- this is that
                page. */}
            <Route path="/recruitment/manage" element={<AdvertisementTemplatesPage />} />
            {/* Advertisement approval chain queue pages (recruitment.
                advertisement-rnc-queue / .advertisement-cc-queue) -- discovery
                aids so reviewers can find advertisements awaiting their action
                without already knowing the recruitment id. */}
            <Route path="/recruitment/advertisement-rnc-queue" element={<RncOfficeAdvertisementsPage />} />
            <Route path="/recruitment/advertisement-cc-queue" element={<ComputerCentreAdvertisementApprovalsPage />} />

            {/* Research Proposals (Phase 9) */}
            <Route path="/proposals" element={<ProposalsPage />} />
            <Route path="/proposals/new" element={<ProposalCreatePage />} />
            <Route path="/proposals/hod-queue" element={<HodProposalsPage />} />
            <Route path="/proposals/rnc-queue" element={<RncOfficeProposalsPage />} />
            <Route path="/proposals/:id" element={<ProposalDetailPage />} />
            {/* Reports (Phase 10) -- one shared page, one route per report key,
                matching PageCatalogue's seeded "reports" module routes exactly */}
            <Route path="/reports/:reportKey" element={<ReportsPage />} />

            <Route path="/my-applications" element={<MyApplicationsPage />} />
            <Route path="/expenditure-details" element={<FacultyExpenditureDetailsPage />} />
            <Route path="/add-grant" element={<AddGrantReceivedPage />} />
            <Route path="/travels" element={<FellowTravelsPage />} />

            {/* Filtered Project Lists */}
            <Route path="/type-1" element={<ProjectListPage key="t1" initialTypeFilter="TypeIResearch" />} />
            <Route path="/type-2" element={<ProjectListPage key="t2" initialTypeFilter="TypeIIIndustrySponsored" />} />
            <Route path="/type-3" element={<ProjectListPage key="t3" initialTypeFilter="TypeIIIConsultancy" />} />
            <Route path="/type-4" element={<ProjectListPage key="t4" initialTypeFilter="TypeIVTesting" />} />
            <Route path="/type-5" element={<ProjectListPage key="t5" initialTypeFilter="TypeVOther" />} />

            {/* BRD Modules & HOD Approval Pages */}
            <Route path="/hod-dashboard" element={<DepartmentDashboardPage />} />
            <Route path="/fellowship-claims" element={<FellowshipApprovalPage />} />
            <Route path="/leave-approvals" element={<LeaveApprovalPage />} />
            <Route path="/indent-approvals" element={<IndentApprovalPage />} />
            <Route path="/travel-approvals" element={<TravelApprovalPage />} />
            <Route path="/joining-reports" element={<JoiningApprovalPage />} />
            <Route path="/recruitments/joining-approvals" element={<JoiningApprovalPage />} />
            <Route path="/faculty-registrations" element={<PendingFacultyRegistrationsPage />} />
            <Route path="/recruitment/nominee-invitations" element={<NomineeAvailabilityPage />} />
            <Route path="/consultancy-requests" element={<ConsultancyAssignmentPage />} />
            <Route path="/overhead-funds" element={<OverheadDashboardPage />} />

            <Route path="/recruitment" element={<RecruitmentPage />} />
            <Route path="/fellowships" element={<FellowshipsPage />} />
            <Route path="/procurement" element={<ProcurementPage />} />
            <Route path="/leaves" element={<LeavesPage />} />
            <Route path="/noc-requests" element={<NocPage />} />
            <Route path="/experience-certificate-requests" element={<ExperienceCertificatePage />} />
            <Route path="/medical-facility-requests" element={<MedicalFacilityPage />} />
            <Route path="/id-card-requests" element={<IdCardRequestPage />} />
            <Route path="/create-faculty-user" element={<CreateFacultyUser />} />
            <Route path="/manage-news-events" element={<ManageNewsEvents />} />
            <Route path="/manage-announcements" element={<ManageAnnouncements />} />
            <Route path="/manage-funding-agencies" element={<ManageFundingAgencies />} />
            <Route path="/manage-departments" element={<ManageDepartments />} />
            <Route path="/manage-email-templates" element={<ManageEmailTemplatesPage />} />
            <Route path="/email-log" element={<EmailLogPage />} />
            <Route path="/generate-manpower-offer-letter" element={<GenerateManpowerOfferLetter />} />
            <Route path="/view-expenditure" element={<ViewExpenditure />} />
            <Route path="/view-generated-offer-letters" element={<ViewGeneratedOfferLetter />} />
            <Route path="/payment-voucher" element={<PaymentVoucherPage />} />
            <Route path="/noting-page" element={<NotingPage />} />
            <Route path="/process-bill" element={<ProcessBillPage />} />
            <Route path="/process-bill/travel/:indentId" element={<TravelBillFormPage />} />
            <Route path="/travel-bill-form/:indentId" element={<TravelBillFormPage />} />
            <Route path="/process-bill/:indentType/:indentId" element={<ProcessBillFormPage />} />


            {/* Office / Deputy Registrar Pages */}
            <Route path="/assigned-requests" element={<AssignedRequestsPage />} />
            <Route path="/processed-requests" element={<ProcessedRequestsPage />} />
            <Route path="/approved-requests" element={<ApprovedRequestsPage />} />
            <Route path="/forwarded-for-action" element={<ForwardedForActionPage />} />
            <Route path="/update-payment" element={<UpdatePaymentPage />} />

            {/* SuperAdmin */}
            <Route path="/admin/workflows" element={<ManageWorkflowsPage />} />
            <Route path="/admin/roles" element={<ManageRolesPage />} />
            <Route path="/admin/users" element={<ManageUsersPage />} />
            <Route path="/generate-offer-letter" element={<GenerateOfferLetterPage />} />
            <Route path="/view-offer-letters" element={<ViewOfferLettersPage />} />

            {/* Catch-all route to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
