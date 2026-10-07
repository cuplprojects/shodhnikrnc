/**
 * 🎯 SIMPLE ROUTE CONFIGURATION
 * 
 * ✨ Define your routes here - Everything else is automatic!
 * 
 * 🚀 To add a new page:
 * 1. Import component
 * 2. Add to routes array
 * 3. Done! Navigation, permissions, and routing work automatically
 */

import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserCheck,
  Settings,
  FileText,
  BookOpen,
  TrendingUp,
  Newspaper,
  GraduationCap,
  CreditCard,
  User,
  Lock,
  Camera,
  Microscope,
  Briefcase,
  Award,
  Printer,
  MapPin,
  Calendar,
  Eye,
  UserPlus,
  FileCheck,
  Clock,
  CheckCircle,
  Search,
  FileSearch,
  Sliders,
  Home,
  Info,
  Bell,
  Mail,
  MessageSquare,
  BookMarked,
  Book,
  Handshake,
  ScrollText
} from "lucide-react";

// ============================================================================
// 📦 IMPORT YOUR COMPONENTS
// ============================================================================

//Dashboard Component
import Dashboard from '@/pages/dashboard/Dashboard';

//Supervisor Cell Components
import SupervisorApplicationsTable from '@/pages/admins/SupervisorCell/Applications/ApplicationsTable';
import SupervisorApplicationDetails from '@/pages/admins/SupervisorCell/ApplicationDetails/ApplicationDetails';

//Super Admin Components
import AllUsers from '@/pages/admins/SuperAdmin/rbac/users/AllUsers';
import AddUser from '@/pages/admins/SuperAdmin/rbac/users/components/AddUser';
import UpdateUser from '@/pages/admins/SuperAdmin/rbac/users/components/UpdateUser';
import AllRoles from '@/pages/admins/SuperAdmin/rbac/roles/AllRoles';
import RoleCreation from '@/pages/admins/SuperAdmin/rbac/roles/components/RoleCreation';
import UpdateRole from '@/pages/admins/SuperAdmin/rbac/roles/components/UpdateRole';
import WebsiteSettings from '@/pages/admins/SuperAdmin/WebsiteSettings';

// Website Settings Components
import HeaderSettings from '@/websiteSettings/components/HeaderSettings';
import HomeSettings from '@/websiteSettings/components/HomeSettings';
import AboutusSettings from '@/websiteSettings/components/AboutusSettings';
import CoOrdinatorsSettings from '@/websiteSettings/components/CoOrdinatorsSettings';
import PhdSyllabusSettings from '@/websiteSettings/components/PhdSyllabusSettings';
import NoticeboardSettings from '@/websiteSettings/components/NoticeboardSettings';
import QueryComplaintSettings from '@/websiteSettings/components/QueryComplaintSettings';
import ContactSettings from '@/websiteSettings/components/ContactSettings';
import EmailTemplateSettings from '@/websiteSettings/components/EmailTemplateSettings';
import ResearchProjects from '@/websiteSettings/components/ResearchProjects';
import Ordinance from '@/websiteSettings/components/Ordinance';
import MoUs from '@/websiteSettings/components/MoUs';
import ResearchCompendium from '@/websiteSettings/components/ResearchCompendium';
import SciPapers from '@/websiteSettings/components/Sci-Papers';
import ResearchPolicySettings from '@/websiteSettings/components/ResearchPolicySettings';
import WorkflowConfig from '@/pages/admins/SuperAdmin/WorkflowConfig';

// DOR Components
import {
  DirectorOfResearchProfile,
  Department,
  DepartmentSupervisor,
  DeptSupProfile,
  ProvisionalSupervisors,
  SupervisorDetails
} from '@/pages/admins/DirectorOfResearch';
import AddExaminerDirector from "@/pages/admins/DirectorOfResearch/Viva-voce/AddExaminers";
import ExistingSupervisor from '@/pages/admins/DirectorOfResearch/ExistingSUP/ExistingSupervisor';
import RDC from "@/pages/admins/DirectorOfResearch/RDCCommittee/RDC";
import PrePhD from '@/pages/admins/DirectorOfResearch/PrePhd/PrePhD';
import DirectorOfResearchVivalApprovals from "@/pages/admins/DirectorOfResearch/vivaApprovals/VivaApprovals";
import ThesisListsDirector from "@/pages/admins/DirectorOfResearch/Viva-voce/ThesisLists";
import PhD from '@/pages/admins/DirectorOfResearch/Phd/PhD';
import ExaminersListsDirector from "@/pages/admins/DirectorOfResearch/Viva-voce/ExaminersLists";
import DORRDCProceedings from "@/pages/admins/DirectorOfResearch/rdcProceedings/RDCProceedings"
import VivaDate from "@/pages/admins/DirectorOfResearch/Viva-voce/VivaDate";
import DORProgressReportView from "@/pages/admins/DirectorOfResearch/ProgressReportApproval/ProgressReportView";
import DORProgressReportApproval from "@/pages/admins/DirectorOfResearch/ProgressReportApproval/ProgressReportApproval";
import RDCDorDecision from "@/pages/admins/DirectorOfResearch/rdcDecision/RDCDecision";
// Office Components
import ScholarPendingSynopsis from '@/pages/admins/Office/scholarSynopsis/ScholarSynopsis';
import PendingCourseWork from '@/pages/admins/Office/pendingCourseWork/PendingCourseWork';
import SupervisorConsent from "@/pages/admins/Office/SupervisorConsent/SupervisorConsent";
import UpcomingRDC from "@/pages/admins/Office/upcomingRDC/UpcomingRDC";
import OfficeRDCProceedings from "@/pages/admins/Office/rdcProceedings/RDCProceedings"
import VivaApprovals from "@/pages/admins/Office/vivaApprovals/VivaApprovals";
import ScheduleRDC from '@/pages/admins/Office/scheduleInterview/ScheduleRDC'

// Scholar Components
import ScholarDashboard from '@/pages/Permanent/Scholar/pages/dashboard/ScholarDashboard';
import ScholarResearchSupervisor from '@/pages/Permanent/Scholar/pages/researchSuperVisor/ResearchSupervisor';
import ScholarConferenceAndSeminar from '@/pages/Permanent/Scholar/pages/conferAndSminar/ConferenceAndSeminar';
import ScholarCourseWork from '@/pages/Permanent/Scholar/pages/courseWork/CourseWork';
import ScholarFeePayments from '@/pages/Permanent/Scholar/pages/feePayments/FeePayments';
import ScholarMySettings from '@/pages/Permanent/Scholar/pages/mySettings/MySettings';
import ScholarProgressReports from '@/pages/Permanent/Scholar/pages/progressReports/ProgressReports';
import ScholarResearchPapers from '@/pages/Permanent/Scholar/pages/researchPapers/ResearchPapers';
import ScholarSynopsis from '@/pages/Permanent/Scholar/pages/synopsis/Synopsis';
import ScholarThesisSubmission from '@/pages/Permanent/Scholar/pages/thesisSubmission/ThesisSubmission';
import ScholarAttendance from '@/pages/Permanent/Scholar/pages/attendance/Attendance';
import ProgressReportFormat from "@/pages/Permanent/Scholar/pages/progressReports/components/ProgressReportFormat";
import AdmissionCellDashboard from "@/pages/Permanent/Scholar/pages/admCellDashboard/AdmissionCellDashboard";
import AdmissionForm from "@/pages/Permanent/Scholar/pages/admCellDashboard/components/AdmissionForm";
import ItemDetails from "@/pages/Permanent/Scholar/pages/admCellDashboard/components/ItemDetails";
import ThesisUploads from "@/pages/Permanent/Scholar/pages/thesisSubmission/ThesisUploads";

// Supervisor Components
import SupervisorHome from '@/pages/Permanent/Supervisor/pages/Home';
import SupervisorMyScholars from '@/pages/Permanent/Supervisor/pages/MyScholars';
import SupervisorMyProfile from '@/pages/Permanent/Supervisor/pages/MyProfile';
import SupervisorPersonalDetails from '@/pages/Permanent/Supervisor/pages/PersonalDetails';
import SupervisorEducationalDetails from '@/pages/Permanent/Supervisor/pages/EducationalDetails';
import SupervisorExperienceDetails from '@/pages/Permanent/Supervisor/pages/ExperienceDetails';
import SupervisorResearchDetails from '@/pages/Permanent/Supervisor/pages/ResearchDetails';
import SupervisorAwardsFellowship from '@/pages/Permanent/Supervisor/pages/AwardsFellowship';
import SupervisorPublicationsPapers from '@/pages/Permanent/Supervisor/pages/Component/PublicationsPapers';
import SupervisorPhotographSignature from '@/pages/Permanent/Supervisor/pages/PhotographSignature';
import SupervisorPrintProfile from '@/pages/Permanent/Supervisor/pages/PrintProfile';
import SupervisorSeatAvailability from '@/pages/Permanent/Supervisor/pages/SeatAvailability';
import SupervisorMySettings from '@/pages/Permanent/Supervisor/pages/MySettings';
import AuthoredBooksMonographs from '@/pages/Permanent/Supervisor/pages/Publication&Others/AuthoredBooks&Monographs';
import EditedBooks from '@/pages/Permanent/Supervisor/pages/Publication&Others/EditedBooks';
import UGCPapers from '@/pages/Permanent/Supervisor/pages/Publication&Others/UGCPapers';
import Chapters from '@/pages/Permanent/Supervisor/pages/Publication&Others/Chapters';
import LecturePerson from '@/pages/Permanent/Supervisor/pages/Publication&Others/LecturePerson';
import Seminars from '@/pages/Permanent/Supervisor/pages/Publication&Others/Seminars';
import Projects from '@/pages/Permanent/Supervisor/pages/Publication&Others/Projects';
import AdminPosition from '@/pages/Permanent/Supervisor/pages/Publication&Others/AdminPosition';
import ConferencePPt from '@/pages/Permanent/Supervisor/pages/Publication&Others/ConferencePPt';
import MembershipOfAcademicProff from '@/pages/Permanent/Supervisor/pages/Publication&Others/MembershipOfAcademicProff';
import CommunityService from '@/pages/Permanent/Supervisor/pages/Publication&Others/CommunityService';
import Patent from '@/pages/Permanent/Supervisor/pages/Publication&Others/Patent';
import ConferencesApproval from "@/pages/Permanent/Supervisor/pages/Approvals/ConferenceAprroval/ConferencesApproval";
import ConferenceView from "@/pages/Permanent/Supervisor/pages/Approvals/ConferenceAprroval/ConferenceView";
import ReasearchPaperApproval from "@/pages/Permanent/Supervisor/pages/Approvals/ResearchPaperApproval/ReasearchPaperApproval";
import ResearchPaperView from "@/pages/Permanent/Supervisor/pages/Approvals/ResearchPaperApproval/ResearchPaperView";
import ProgressReportApproval from "@/pages/Permanent/Supervisor/pages/Approvals/ProogressApproval/ProgressReportApproval";
import ProgressReportView from "@/pages/Permanent/Supervisor/pages/Approvals/ProogressApproval/ProgressReportView";
import ThesisSubmittedList from "@/pages/Permanent/Supervisor/VivaVoce/ThesisSubmittedList";
import Examiner from "@/pages/Permanent/Supervisor/VivaVoce/Examiner";
import VivaDateSchedule from "@/pages/Permanent/Supervisor/VivaVoce/VivaDateSchedule";
import AddNewExaminer from "@/pages/Permanent/Supervisor/VivaVoce/AddNewExaminer";

//Assistant Director Components
import AADRDCProceedings from "@/pages/admins/AssistantDirector/rdcProceedings/RDCProceedings"
import RDCDecisionAD from "@/pages/admins/AssistantDirector/rdcDecision/RDCDecision"
import ThesisForPlagCheck from "@/pages/admins/AssistantDirector/ThesisForPlagCheck/ThesisForPlagCheck";
import AAVivalApprovals from "@/pages/admins/AssistantDirector/vivaApprovals/VivaApprovals";

//Admission Cell Components
import ScheduleInterview from '@/pages/admins/AdmissionCell/ScheduleInterview/ScheduleInterview';
import InterviewEvaluation from '@/pages/admins/AdmissionCell/InterviewEvaluation/InterviewEvaluation';
import MeritListUpload from '@/pages/admins/AdmissionCell/MeritListUpload/MeritListUpload';
import InterviewEvaluationDetails from '@/pages/admins/AdmissionCell/InterviewEvaluation/InterviewEvaluationDetails';
import DocumentVerification from '@/pages/admins/AdmissionCell/DocumentVerification/DocumentVerification';
import DocumentVerificationDetails from '@/pages/admins/AdmissionCell/DocumentVerification/DocumentVerificationDetails';
import PhDApplicationDetails from '@/pages/admins/AdmissionCell/PhDApplications/PhDApplicationDetails';
import SupervisorDetailsGlobal from '@/pages/admins/DirectorOfResearch/SupervisorScreening/ApplicationDetails/SupervisorDetails';

//VCOffice Components
import VCOfficeVivalApprovals from "@/pages/admins/VCOffice/vivaApprovals/VivaApprovals";
import SupScreening from "@/pages/admins/VCOffice/SupervisorScreening/SupScreening";
import VCOfficeSupervisorDetails from "@/pages/admins/VCOffice/SupervisorScreening/SupervisorDetails";
import ExaminersListsVC from "@/pages/admins/VCOffice/Vica-voce/ExaminerLists";
import AddExaminerVC from "@/pages/admins/VCOffice/Vica-voce/AddExaminers";
import ThesisListVC from "@/pages/admins/VCOffice/Vica-voce/ThesisLists";
import RDCProceedings from "@/pages/admins/VCOffice/RDCProceedings/RDCProceedings";
import RDCDecisionVC from "@/pages/admins/VCOffice/RDCDecision/RDCDecision";
//Registrat Components 
import RegistrarVivalApprovals from "@/pages/admins/Registrar/vivaApprovals/VivaApprovals";
import SupervisorScreening from "@/pages/admins/Registrar/SupervisorScreeningRegistrar/SupervisorScreening";
import RegistrarSupervisorDetails from "@/pages/admins/Registrar/SupervisorScreeningRegistrar/SupervisorDetails";

//Deputy Registrar Components
import SupervisorDetailsStageII from "@/pages/admins/DeputyRegistrar/SupervisorScreening/SupervisorDetails";
import StageIISupervisors from "@/pages/admins/DeputyRegistrar/SupervisorScreening/SupervisorScreening";

//Dean Components
import SupervisorStageIV from "@/pages/admins/Dean/SupervisorScreening/SupervisorDetails";
import SupervisorScreeningStageIV from "@/pages/admins/Dean/SupervisorScreening/SupervisorScreening";

// ============================================================================
// 🎯 DEFINE YOUR ROUTES - Simple array format
// ============================================================================

export const routes = {
  // 👨‍💼 STAFF ROUTES
  staff: [
    { path: "/dashboard", name: "Dashboard", icon: <LayoutDashboard size={18} />, component: Dashboard, permission: "dashboard.read", nav: "direct" },
    { path: "/dashboard/supervisor-details/:id", component: SupervisorDetailsGlobal, permission: "dashboard.read" },
    { path: "/dashboard/scholar-details/:id", component: PhDApplicationDetails, permission: "dashboard.read" },
    { path: "/admission-cell-dashboard", name: "Admission Cell Dashboard", icon: <LayoutDashboard size={18} />, component: AdmissionCellDashboard, permission: "admission_cell_dashboard.read", nav: "direct" },
    { path: "/admission-cell-dashboard/details", component: ItemDetails, permission: "admission_cell_dashboard.read" },
    { path: "/admission-cell-dashboard/form", component: AdmissionForm, permission: "admission_cell_dashboard.read" },

    // Supervisor Cell
    { path: "/supcell/applications", name: "Supervisor Applications", icon: <ClipboardList size={18} />, component: SupervisorApplicationsTable, permission: "supervisor_applications.read", nav: "item", section: "Supervisor Recognition Cell" },
    { path: "/supcell/applications/:id", component: SupervisorApplicationDetails, permission: "supervisor_applications.read" },
    { path: "/supcell/progressreport-approval", name: "Progress Report", component: DORProgressReportApproval, icon: <FileCheck size={18} />, permission: "dor_progress_report_approval.read", nav: "item", section: "Supervisor Recognition Cell" },
    { path: "/supcell/progressreport-approval/view", component: DORProgressReportView, icon: <FileCheck size={18} />, permission: "dor_progress_report_approval.read", nav: "item", section: "Supervisor Recognition Cell" },
    // Director Panel
    { path: "/director_panel/profile", name: "Director Profile", icon: <UserCheck size={18} />, component: DirectorOfResearchProfile, permission: "director_profile.read" },
    { path: "/director_panel/departments", name: "Departments", icon: <ClipboardList size={18} />, component: Department, permission: "departments.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/departments/:deptid", component: DepartmentSupervisor, permission: "departments.read" },
    { path: "/director_panel/departments/:deptid/:supid", component: DeptSupProfile, permission: "departments.read" },
    { path: "/director_panel/provisional-supervisors", name: "Supervisors Screening", icon: <Search size={18} />, component: ProvisionalSupervisors, permission: "provisional_supervisors.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/supervisor-details/:id", component: SupervisorDetails, permission: "provisional_supervisors.read" },
    { path: "/director_panel/existingsup", name: "Existing Supervisor", icon: <UserCheck size={18} />, component: ExistingSupervisor, permission: "existingsup.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/prephd", name: "Pre PhD", icon: <BookOpen size={18} />, component: PrePhD, permission: "prephd.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/phd", name: "PhD", icon: <GraduationCap size={18} />, component: PhD, permission: "phd.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/rdc-committee", name: "RDC Committee", icon: <Users size={18} />, component: RDC, permission: "rdc_committee.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/examinerslist", name: "Examiners List", icon: <ClipboardList size={18} />, component: ExaminersListsDirector, permission: "thesis.read" },
    { path: "/director_panel/add-examiner", name: "Add Examiner", icon: <UserPlus size={18} />, component: AddExaminerDirector, permission: "thesis.read" },
    { path: "/director_panel/thesis", name: "Thesis", icon: <FileText size={18} />, component: ThesisListsDirector, permission: "thesis.read", nav: "item", section: "Director of Research" },
    { path: "/director_panel/vivaddate", name: "Schedule Viva", icon: <Calendar size={18} />, component: VivaDate, permission: "viva.read", nav: "item", section: "Director of Research" },
    { path: "/dor-proceedings-office", name: "RDC Proceedings", icon: <CheckCircle size={18} />, component: DORRDCProceedings, permission: "rdc_proceedings_dor.read", nav: "item", section: "Director of Research" },
    { path: "/director-panel/viva-approval", name: "Viva Approvals", icon: <FileCheck size={18} />, component: DirectorOfResearchVivalApprovals, permission: "dor_viva_approval.read", nav: "item", section: "Director of Research" },
    //{ path: "/director-panel/progress-report-approval", name: "Progress Report Approval", icon: <FileCheck size={18} />, component: DORProgressReportApproval, permission: "dor_progress_report_approval.read", nav: "item", section: "Director of Research" },
    //   { path: "/director-panel/progress-report-approval", name: "Progress Report Approval", icon: <FileCheck size={18} />, component: ProgressReportView, permission: "dor_progress_report_approval.read", nav: "item", section: "Director of Research" },
    // { path: "/director-panel/progressreport-approval/view", component: DORProgressReportView },
    { path: "/director-panel/rdc-decision", name: "RDC Decision", icon: <FileCheck size={18} />, component: RDCDorDecision, permission: "rdc_decision.read", nav: "item", section: "Director of Research" },
    // Office Routes
    { path: "/scholar-synopsis", name: "Scholar Synopsis", icon: <FileText size={18} />, component: ScholarPendingSynopsis, permission: "scholar_synopsis.read", nav: "item", section: "Office" },
    { path: "/scholar-synopsis/:id", component: ScholarPendingSynopsis, permission: "scholar_synopsis.read" },
    { path: "/pending-course-work", name: "Pending Course Work", icon: <Clock size={18} />, component: PendingCourseWork, permission: "pending_course_work.read", nav: "item", section: "Office" },
    { path: "/supervisor-consent", name: "Supervisor Consent", icon: <CheckCircle size={18} />, component: SupervisorConsent, permission: "supervisor_consent.read", nav: "item", section: "Office" },
    { path: "/upcoming-rdc", name: "Upcoming RDC", icon: <Calendar size={18} />, component: UpcomingRDC, permission: "upcoming_rdc.read", nav: "item", section: "Office" },
    { path: "/schedule-rdc", name: "Schedule RDC", icon: <Calendar size={18} />, component: ScheduleRDC, permission: "schedule_rdc.read", nav: "item", section: "Office" },
    { path: "/rdc-proceedings-office", name: "RDC Proceedings", icon: <FileCheck size={18} />, component: OfficeRDCProceedings, permission: "rdc_proceedings_office.read", nav: "item", section: "Office" },
    { path: "/viva-approval", name: "Viva", icon: <FileCheck size={18} />, component: VivaApprovals, permission: "viva_approval.read", nav: "item", section: "Office" },
    { path: "/attendance", name: "Attendance", icon: <Calendar size={18} />, component: ScholarAttendance, permission: "attendance.read", nav: "item", isLocked: false, section: "Office" },

    // Registrar Routes
    { path: "/registrar-viva-approval", name: "Viva Approvals", icon: <FileCheck size={18} />, component: RegistrarVivalApprovals, permission: "registrar_viva_approval.read", nav: "item", section: "Registrar Office" },
    { path: "/registrar-supervisor-approval", name: "Supervisor Screening", icon: <FileCheck size={18} />, component: SupervisorScreening, permission: "registrar_supervisor_approval.read", nav: "item", section: "Registrar Office" },
    { path: "/registrar-supervisor-approval/:id", component: RegistrarSupervisorDetails, permission: "registrar_supervisor_approval.read" },

    //Dean
    { path: "/dean-supervisor-consent/:id", component: SupervisorStageIV, permission: "dean_supervisor_applications.read" },
    { path: "/dean-supervisor-consent", name: "Supervisor Screening", icon: <FileCheck size={18} />, component: SupervisorScreeningStageIV, permission: "dean_supervisor_applications.read", nav: "item", section: "Dean" },

    //Deputy Registrar
    { path: "/dR-supervisor-consent/:id", component: SupervisorDetailsStageII, permission: "deputyregistrar_supervisor_applications.read" },
    { path: "/dR-supervisor-consent", name: "Supervisor Screening", icon: <FileCheck size={18} />, component: StageIISupervisors, permission: "deputyregistrar_supervisor_applications.read", nav: "item", section: "Deputy Registrar" },


    //Assistant/Associate Director 1 Routes
    { path: "/rdc-proceedings-aad", name: "RDC Proceedings", icon: <FileCheck size={18} />, component: AADRDCProceedings, permission: "rdc_proceedings_aad_1.read", nav: "item", section: "Assistant/Associate Director 1" },
    { path: "/thesis-for-plag-check", name: "Thesis for Plag Check", icon: <FileSearch size={18} />, component: ThesisForPlagCheck, permission: "thesis_for_plag_check.read", nav: "item", section: "Assistant/Associate Director 1" },
    { path: "/assistant-associate-viva-approval-1", name: "Viva Approvals", icon: <FileCheck size={18} />, component: AAVivalApprovals, permission: "aa_viva_approval_1.read", nav: "item", section: "Assistant/Associate Director 1" },
    { path: "/rdc-decision-aad", name: "RDC Decision", icon: <FileCheck size={18} />, component: RDCDecisionAD, permission: "rdc_decision_aad_1.read", nav: "item", section: "Assistant/Associate Director 1" },
    //Assistant/Associate Director 2 Routes
    { path: "/assistant-associate-viva-approval-2", name: "Viva Approvals", icon: <FileCheck size={18} />, component: AAVivalApprovals, permission: "aa_viva_approval_2.read", nav: "item", section: "Assistant/Associate Director 2" },

    // VC Office Routes
    { path: "/rdc-proceedings", name: "RDC Proceedings", icon: <FileCheck size={18} />, component: RDCProceedings, permission: "rdc_proceedings.read", nav: "item", section: "VC Office" },
    { path: "/vc_office/examinerslist", name: "Examiners List", icon: <ClipboardList size={18} />, component: ExaminersListsVC, permission: "vc_thesis.read" },
    { path: "/vc_office/add-examiner", name: "Add Examiner", icon: <UserPlus size={18} />, component: AddExaminerVC, permission: "vc_thesis.read" },
    { path: "/vc_office/thesis", name: "View Thesis", icon: <Eye size={18} />, component: ThesisListVC, permission: "vc_thesis.read", nav: "item", section: "VC Office" },
    { path: "/vc-office-viva-approval", name: "Viva Approvals", icon: <FileCheck size={18} />, component: VCOfficeVivalApprovals, permission: "vc_viva_approval.read", nav: "item", section: "VC Office" },
    { path: "/vc-office-supervisor-approval", name: "Supervisor Screening", icon: <FileCheck size={18} />, component: SupScreening, permission: "vc_supervisor_approval.read", nav: "item", section: "VC Office" },
    { path: "/vc-office-supervisor-approval/:id", component: VCOfficeSupervisorDetails, permission: "vc_supervisor_approval.read" },
    { path: "/vc-office-rdc-decision", name: "RDC Decision", icon: <FileCheck size={18} />, component: RDCDecisionVC, permission: "vc_rdc_decision.read", nav: "item", section: "VC Office" },
    // Admission Cell Routes
    //below 2 are not requried since scholar docs are not needed to be verified by Admisison Cell
    // { path: "/admission-cell/phd-applications", name: "PhD Applications", icon: <GraduationCap size={18} />, component: PhDApplications, permission: "phd_applications.read", nav: "item", section: "Admission Cell" },
    // { path: "/admission-cell/phd-applications/:id", component: PhDApplicationDetails, permission: "phd_applications.read" },
    { path: "/admission-cell/schedule-interview", name: "Schedule Interview", icon: <Calendar size={18} />, component: ScheduleInterview, permission: "schedule_interview.read", nav: "item", section: "Admission Cell" },
    { path: "/admission-cell/interview-evaluation", name: "Interview Evaluation", icon: <CheckCircle size={18} />, component: InterviewEvaluation, permission: "interview_evaluation.read", nav: "item", section: "Admission Cell" },
    { path: "/admission-cell/merit-list-upload", name: "Merit List Upload", icon: <CheckCircle size={18} />, component: MeritListUpload, permission: "merit_list_upload.read", nav: "item", section: "Admission Cell" },
    { path: "/admission-cell/interview-evaluation/:id", component: InterviewEvaluationDetails, permission: "interview_evaluation.read" },
    { path: "/admission-cell/document-verification", name: "Counselling", icon: <FileSearch size={18} />, component: DocumentVerification, permission: "document_verification.read", nav: "item", section: "Admission Cell" },
    { path: "/admission-cell/document-verification/:id", component: DocumentVerificationDetails, permission: "document_verification.read" },

    // RBAC 
    { path: "/dashboard/rbac/users", name: "Users", icon: <Users size={18} />, component: AllUsers, permission: "user_management.read", nav: "item", section: "USERS & PERMISSIONS" },
    { path: "/dashboard/rbac/users/add", component: AddUser, permission: "user_management.create" },
    { path: "/dashboard/rbac/users/edit/:id", component: UpdateUser, permission: "user_management.update" },
    { path: "/dashboard/rbac/roles", name: "Roles", icon: <UserCheck size={18} />, component: AllRoles, permission: "role_management.read", nav: "item", section: "USERS & PERMISSIONS" },
    { path: "/dashboard/rbac/roles/create", component: RoleCreation, permission: "role_management.create" },
    { path: "/dashboard/rbac/roles/edit/:id", component: UpdateRole, permission: "role_management.update" },

    // Website Settings - Core Settings
    { path: "/dashboard/website-settings/header", name: "Header Settings", icon: <Sliders size={18} />, component: HeaderSettings, permission: "website_settings_header.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/contact", name: "Contact Info", icon: <MapPin size={18} />, component: ContactSettings, permission: "website_settings_contact.read", nav: "item", section: "WEBSITE MANAGEMENT" },

    // Website Settings - Home Page Content
    { path: "/dashboard/website-settings/home", name: "Home Page", icon: <Home size={18} />, component: HomeSettings, permission: "website_settings_home.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/aboutus", name: "About Us", icon: <Info size={18} />, component: AboutusSettings, permission: "website_settings_aboutus.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/noticeboard", name: "Noticeboard", icon: <Bell size={18} />, component: NoticeboardSettings, permission: "website_settings_noticeboard.read", nav: "item", section: "WEBSITE MANAGEMENT" },

    // Website Settings - Management
    { path: "/dashboard/website-settings/coordinators", name: "Co-Ordinators", icon: <Users size={18} />, component: CoOrdinatorsSettings, permission: "website_settings_coordinators.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/emailtemplates", name: "Email Templates", icon: <Mail size={18} />, component: EmailTemplateSettings, permission: "website_settings_emailtemplates.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/querycomplaint", name: "Query & Complaints", icon: <MessageSquare size={18} />, component: QueryComplaintSettings, permission: "website_settings_querycomplaint.read", nav: "item", section: "WEBSITE MANAGEMENT" },

    // Website Settings - Academic
    { path: "/dashboard/website-settings/phdsyllabus", name: "PhD Syllabus", icon: <BookMarked size={18} />, component: PhdSyllabusSettings, permission: "website_settings_phdsyllabus.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/research", name: "Research Projects", icon: <BookOpen size={18} />, component: ResearchProjects, permission: "website_settings_research.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/compendium", name: "Research Compendium", icon: <Book size={18} />, component: ResearchCompendium, permission: "website_settings_compendium.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/scipapers", name: "SCI Papers", icon: <GraduationCap size={18} />, component: SciPapers, permission: "website_settings_scipapers.read", nav: "item", section: "WEBSITE MANAGEMENT" },

    // Website Settings - Policies & Documents
    { path: "/dashboard/website-settings/ordinance", name: "Ordinances", icon: <FileText size={18} />, component: Ordinance, permission: "website_settings_ordinance.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/mous", name: "MoUs", icon: <Handshake size={18} />, component: MoUs, permission: "website_settings_mous.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    { path: "/dashboard/website-settings/researchpolicy", name: "Research Policies", icon: <ScrollText size={18} />, component: ResearchPolicySettings, permission: "website_settings_researchpolicy.read", nav: "item", section: "WEBSITE MANAGEMENT" },
    // Workflow Configuration
    { path: "/dashboard/workflow-config", name: "Workflow Management", icon: <Settings size={18} />, component: WorkflowConfig, permission: "workflow_management.read", nav: "item", section: "SYSTEM CONFIGURATION" }

  ],

  // 🎓 SCHOLAR ROUTES
  scholar: [
    { path: "", name: "Dashboard", icon: <LayoutDashboard size={18} />, component: ScholarDashboard, nav: "direct", isLocked: false },
    { path: "research-supervisor", name: "Research Supervisor", icon: <UserCheck size={18} />, component: ScholarResearchSupervisor, nav: "direct", isLocked: false },
    { path: "course-work", name: "Course Work", icon: <BookOpen size={18} />, component: ScholarCourseWork, nav: "direct", isLocked: false },
    { path: "synopsis", name: "Synopsis", icon: <FileText size={18} />, component: ScholarSynopsis, nav: "direct", isLocked: true },
    { path: "progress-reports", name: "Progress Reports", icon: <TrendingUp size={18} />, component: ScholarProgressReports, nav: "direct", isLocked: true },
    { path: "progress-reports/progressreportformat", component: ProgressReportFormat, isLocked: true },
    { path: "research-papers", name: "Research Papers", icon: <Newspaper size={18} />, component: ScholarResearchPapers, nav: "direct", isLocked: true },
    { path: "conference-and-seminar", name: "Conference & Seminar", icon: <Users size={18} />, component: ScholarConferenceAndSeminar, nav: "direct", isLocked: true },
    { path: "thesis-submission", name: "Thesis Submission", icon: <GraduationCap size={18} />, component: ScholarThesisSubmission, nav: "direct", isLocked: true },
    { path: "thesis-submission/uploads", component: ThesisUploads, isLocked: true, customGuard: 'blockIfUploaded' },
    { path: "fee-payments", name: "Fee Payments", icon: <CreditCard size={18} />, component: ScholarFeePayments, nav: "direct", isLocked: false },
    { path: "my-settings", name: "Change Password", icon: <Lock size={18} />, component: ScholarMySettings, nav: "item", section: "My Settings", isLocked: false },
    { path: "my-settings/photo", name: "Change Photo", icon: <Camera size={18} />, component: ScholarMySettings, nav: "item", section: "My Settings", isLocked: false }
  ],

  // 👨‍🏫 SUPERVISOR ROUTES
  supervisor: [
    { path: "", name: "Home", icon: <LayoutDashboard size={18} />, component: SupervisorHome, nav: "direct" },
    { path: "my-scholars", name: "My Scholars", icon: <Users size={18} />, component: SupervisorMyScholars, nav: "direct" },
    { path: "my-profile", name: "My Profile", icon: <User size={18} />, component: SupervisorMyProfile, nav: "direct" },
    { path: "personal-details", name: "Personal Details", icon: <User size={18} />, component: SupervisorPersonalDetails, nav: "item", section: "Profile Management" },
    { path: "educational-details", name: "Educational Details", icon: <GraduationCap size={18} />, component: SupervisorEducationalDetails, nav: "item", section: "Profile Management" },
    { path: "experience-details", name: "Experience Details", icon: <Briefcase size={18} />, component: SupervisorExperienceDetails, nav: "item", section: "Profile Management" },
    { path: "research-details", name: "Research Details", icon: <Microscope size={18} />, component: SupervisorResearchDetails, nav: "item", section: "Profile Management" },
    { path: "awards-fellowships", name: "Awards & Fellowships", icon: <Award size={18} />, component: SupervisorAwardsFellowship, nav: "item", section: "Profile Management" },
    { path: "publications-papers", name: "Publications & Papers", icon: <FileText size={18} />, component: SupervisorPublicationsPapers, nav: "item", section: "Profile Management" },
    { path: "photograph-signature", name: "Photograph & Signature", icon: <Camera size={18} />, component: SupervisorPhotographSignature, nav: "item", section: "Profile Management" },
    { path: "print-profile", name: "Print Profile", icon: <Printer size={18} />, component: SupervisorPrintProfile, nav: "item", section: "Other Options" },
    { path: "seat-availability", name: "Seat Availability", icon: <MapPin size={18} />, component: SupervisorSeatAvailability, nav: "item", section: "Other Options" },
    { path: "my-settings", name: "My Settings", icon: <Settings size={18} />, component: SupervisorMySettings, nav: "item", section: "Other Options" },
    { path: "conference-approval", component: ConferencesApproval },
    { path: "conference-approval/view", component: ConferenceView },
    { path: "research-approval", component: ReasearchPaperApproval },
    { path: "research-approval/view", component: ResearchPaperView },
    { path: "progressreport-approval", component: ProgressReportApproval },
    { path: "progressreport-approval/view", component: ProgressReportView },
    { path: "thesissubmittedlist", name: "Thesis Submitted", icon: <FileText size={18} />, component: ThesisSubmittedList, nav: "item", section: "Viva Voce" },
    { path: "examinerlist", name: "Examiner List", icon: <ClipboardList size={18} />, component: Examiner },
    { path: "addnewexaminer", name: "Add New Examiner", icon: <UserPlus size={18} />, component: AddNewExaminer },
    { path: "vivadate", name: "Viva Date", icon: <Calendar size={18} />, component: VivaDateSchedule, nav: "item", section: "Viva Voce" },



    // Publication routes (hidden from nav)
    { path: "publications/authored-books-monographs", component: AuthoredBooksMonographs },
    { path: "publications/edited-books", component: EditedBooks },
    { path: "publications/ugc-papers", component: UGCPapers },
    { path: "publications/chapters", component: Chapters },
    { path: "publications/lecture-person", component: LecturePerson },
    { path: "publications/seminars", component: Seminars },
    { path: "publications/projects", component: Projects },
    { path: "publications/admin-position", component: AdminPosition },
    { path: "publications/conference-ppt", component: ConferencePPt },
    { path: "publications/membership-academic-prof", component: MembershipOfAcademicProff },
    { path: "publications/community-service", component: CommunityService },
    { path: "publications/patent", component: Patent }
  ]
};

// ============================================================================
// 🔐 CRUD PERMISSIONS SYSTEM
// ============================================================================

/**
 * Define all CRUD permissions for buttons and actions
 * This replaces the old modules.json system
 */
export const crudPermissions = {
  // Core System
  dashboard: ['read'],
  admission_cell_dashboard: ['read'],

  // Supervisor Recognition Cell
  supervisor_applications: ['read'],
  dor_progress_report_approval: ['read', 'approve', 'reject'],

  // Director of Research
  director_profile: ['read', 'update'],
  departments: ['read', 'download'],
  provisional_supervisors: ['read', 'update', 'approve', 'reject'],
  existingsup: ['read', 'update', 'delete', 'download'],
  prephd: ['read', 'download'],//?
  phd: ['read', 'download'],//?
  rdc_committee: ['read', 'create', 'update'],
  // examiners: ['read', 'create', 'update', 'delete'],
  // add_examiners: ['read', 'create', 'update', 'delete'],
  thesis: ['read', 'create', 'update', 'delete'],
  viva: ['read', 'create', 'update'],
  rdc_proceedings_dor: ['read', 'approve', 'reject', 'download'],
  dor_viva_approval: ['read', 'approve', 'reject'],
  //dor_progress_report_approval: ['read','approve', 'reject'],

  // VC Office
  rdc_proceedings: ['read', 'approve', 'reject', 'revise', 'download'],
  // vc_examiners: ['read', 'create', 'update', 'delete'],
  // vc_add_examiners: ['read', 'create', 'update', 'delete'],
  vc_thesis: ['read', 'create', 'update', 'delete'],
  vc_viva_approval: ['read', 'approve', 'reject'],
  vc_supervisor_approval: ['read', 'approve', 'reject'],

  // Office
  scholar_synopsis: ['read', 'update', 'approve', 'reject', 'revision', 'download'],
  pending_course_work: ['read', 'approve', 'reject', 'revision'],
  supervisor_consent: ['read', 'update', 'approve', 'reject'],
  upcoming_rdc: ['read', 'update', 'revision', 'upload', 'download'],
  schedule_rdc: ['read', 'bulk-assign', 'update'],
  rdc_proceedings_office: ['read', 'update', 'approve', 'reject', 'upload', 'download'],
  viva_approval: ['read', 'upload', 'update', 'download'],
  attendance: ['read', 'read-individual', 'read-bulk-upload', 'download'],

  //Assistant/Associate Director 1
  rdc_proceedings_aad_1: ['read', 'approve', 'reject', 'download'],
  thesis_for_plag_check: ['read', 'download', 'update', 'upload', 'pending', 'reject'],
  aa_viva_approval_1: ['read', 'approve', 'reject'],

  //Assistant/Associate Director 2
  aa_viva_approval_2: ['read', 'approve', 'reject'],

  // Registrar Office
  registrar_viva_approval: ['read', 'approve', 'reject'],
  registrar_supervisor_approval: ['read', 'approve', 'reject', 'print'],


  //Deputy Registrar
  deputyregistrar_supervisor_applications: ['read', 'update', 'approve', 'reject'],
  //deputyregistrar_viva_approval: ['read', 'approve', 'reject','print'],

  //Dean
  dean_supervisor_applications: ['read', 'update', 'approve', 'reject', 'print'],
  //dean_supervisor_approval:['read', 'update','approve','reject','print'],

  // Admission Cell
  schedule_interview: ['read', 'update'],
  phd_applications: ['read', 'update'],
  interview_evaluation: ['read', 'evaluation'],
  merit_list_upload: ['read'],
  document_verification: ['read', 'create', 'update', 'delete', 'approve', 'reject'],//not in use

  // RBAC
  user_management: ['read', 'create', 'update', 'delete'],
  role_management: ['read', 'create', 'update', 'delete'],

  // Website Settings - Core Settings
  website_settings_header: ['read', 'create', 'update', 'delete'],
  website_settings_contact: ['read', 'create', 'update', 'delete'],

  // Website Settings - Home Page Content
  website_settings_home: ['read', 'create', 'update', 'delete'],
  website_settings_aboutus: ['read', 'create', 'update', 'delete'],
  website_settings_noticeboard: ['read', 'create', 'update', 'delete'],

  // Website Settings - Management
  website_settings_coordinators: ['read', 'create', 'update', 'delete'],
  website_settings_emailtemplates: ['read', 'create', 'update', 'delete'],
  website_settings_querycomplaint: ['read', 'create', 'update', 'delete'],

  // Website Settings - Academic
  website_settings_phdsyllabus: ['read', 'create', 'update', 'delete'],
  website_settings_research: ['read', 'create', 'update', 'delete'],
  website_settings_compendium: ['read', 'create', 'update', 'delete'],
  website_settings_scipapers: ['read', 'create', 'update', 'delete'],

  // Website Settings - Policies & Documents
  website_settings_ordinance: ['read', 'create', 'update', 'delete'],
  website_settings_mous: ['read', 'create', 'update', 'delete'],
  website_settings_researchpolicy: ['read', 'create', 'update', 'delete'],

  // Website Settings (General)
  website_settings: ['read', 'create', 'update', 'delete'],
  workflow_management: ['read', 'create', 'update', 'delete'],


  // Payment Management
  // payment_status: ['read', 'update'],//not in use

  // Document Verification
  verification_pending: ['read', 'update', 'approve', 'reject'],
  document_rejected: ['read', 'update'],

  // Admission Management
  qualified_for_admission: ['read', 'update', 'approve', 'reject'],
  admitted: ['read', 'update'],
  admission_cancelled: ['read', 'update'],
  not_applied_for_counselling: ['read', 'update'],

  // RMS Settings
  content_management: ['read', 'create', 'update', 'delete'],
  application_control: ['read', 'update'],
  communication_templates: ['read', 'create', 'update', 'delete'],

  // Website Management
  homepage_slider: ['read', 'create', 'update', 'delete'],
  website_news: ['read', 'create', 'update', 'delete'],
  phone_directory: ['read', 'create', 'update', 'delete'],

  // System Settings
  change_password: ['update'],

};

export default routes;
