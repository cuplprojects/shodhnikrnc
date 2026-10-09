import { useEffect, useState, useMemo, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getProject, getBudgetSummary, listGrantReceipts } from '../../api/projectsApi';
import { actionWorkflow, getWorkflowInstance } from '../../api/workflowApi';
import GrantReceiptApprovalList from './components/GrantReceiptApprovalList';
import { PROJECT_TYPES, getBudgetHeadDisplay } from '../../constants/projectEnums';
import { INDENT_TYPES } from '../../constants/procurementEnums';
import { listIndentsForProject } from '../../api/procurementApi';
import IndentList from '../procurement/components/IndentList';
import { formatCurrency } from './utils/currency';
import EquipmentRequisitionModal from './components/EquipmentRequisitionModal';
import ConsumablesRequisitionModal from './components/ConsumablesRequisitionModal';
import ContingencyRequisitionModal from './components/ContingencyRequisitionModal';
import UploadIndentDocumentModal from './components/UploadIndentDocumentModal';
import CancelIndentModal from './components/CancelIndentModal';
import TravelRequestModal from '../travel/components/TravelRequestModal';
import TravelList from '../travel/components/TravelList';
import { listTravelRequestsForProject } from '../../api/travelApi';
import GenerateAdvertisementModal from './components/GenerateAdvertisementModal';
import GenerateScreeningProformaModal from './components/GenerateScreeningProformaModal';
import GenerateSelectionProformaModal from './components/GenerateSelectionProformaModal';
import GenerateMinutesProformaModal from './components/GenerateMinutesProformaModal';
import GenerateOfferLetterModal from './components/GenerateOfferLetterModal';
import UploadManpowerDocumentModal from './components/UploadManpowerDocumentModal';
import ViewManpowerDocumentModal from './components/ViewManpowerDocumentModal';
import UpdateSelectionModal from './components/UpdateSelectionModal';
import RecommendStipendModal from './components/RecommendStipendModal';
import UpdateCandidateStatusModal from './components/UpdateCandidateStatusModal';
import ReappropriationHistoryModal from './components/ReappropriationHistoryModal';
import ProjectWorkflowActions from './components/ProjectWorkflowActions';
import DaAssignmentModal from './components/DaAssignmentModal';
import { useAuth } from '../../auth/useAuth';


import {
  MoreVertical,
  Wallet,
  Box,
  ClipboardList,
  Edit2,
  FilePlus,
  MonitorSmartphone,
  Briefcase,
  Plane,
  FolderGit2, Clock, Calendar, CheckCircle2, ChevronRight, FileText, IndianRupee,
  Activity, Users, UserCog, Building2, Beaker, FileSignature, BookOpen, AlertCircle,
  FileCheck, ShieldCheck, HelpCircle, PackageSearch, PenTool, LayoutTemplate, Link as LinkIcon, Download, Search, Settings2, Shield, CalendarCheck, X
} from 'lucide-react';

const ActionMenuContext = createContext();

const ActionMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [activeSubMenu, setActiveSubMenu] = useState(null);

  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + 4,
          left: rect.right - 192 // w-48 = 192px
        });
      }
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <ActionMenuContext.Provider value={{ activeSubMenu, setActiveSubMenu, closeMenu: () => setIsOpen(false) }}>
      <button
        ref={buttonRef}
        onClick={() => {
          setIsOpen(!isOpen);
          setActiveSubMenu(null);
        }}
        // onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Disabled to allow clicking inside
        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
      >
        <MoreVertical size={18} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)}></div>
          {createPortal(
            <div
              className="fixed z-[9999] w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
              style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            >
              <div className="py-1">
                {children}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </ActionMenuContext.Provider>
  );
};

const ActionSubMenu = ({ label, children }) => {
  const { activeSubMenu, setActiveSubMenu } = useContext(ActionMenuContext);
  const isOpen = activeSubMenu === label;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setActiveSubMenu(isOpen ? null : label);
        }}
        className="w-full text-left flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span>{label}</span>
        <ChevronRight size={14} className="text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute top-0 right-full mr-1 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-duration-100 z-50">
          <div className="py-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

const ActionItem = ({ icon: Icon, label, onClick, danger, disabled, title }) => {
  const { closeMenu } = useContext(ActionMenuContext);
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onClick(e);
        closeMenu();
      }}
      className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors ${disabled
          ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50 bg-slate-50/50 dark:bg-slate-800/50'
          : danger
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
        }`}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  // Same role-check idiom as ProposalChainActions: lower-case, tolerant match
  // against whatever the JWT's roles claim carries. Must match the backend's
  // ProjectService.CanAssignDa exactly (Superintendent/Dean only).
  const userRoles = user?.roles ?? [];
  const canAssignDa = ['Superintendent', 'Dean'].some((r) =>
    userRoles.map((ur) => String(ur).toLowerCase()).includes(r.toLowerCase())
  );
  const [project, setProject] = useState(null);
  const [budgetLines, setBudgetLines] = useState([]);
  const [reappropriationSummary, setReappropriationSummary] = useState([]);
  const [grantReceipts, setGrantReceipts] = useState([]);
  // Keyed by grant receipt id -- only fetched for receipts still
  // PendingApproval, mirroring RecruitmentDetailPage's Task-5 pattern of
  // fetching a workflow instance only for what is actually in flight.
  const [grantReceiptWorkflows, setGrantReceiptWorkflows] = useState({});
  const [showGrantReceiptSubmitted, setShowGrantReceiptSubmitted] = useState(
    Boolean(location.state?.grantReceiptSubmitted)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setWorkflowActionLoading] = useState(false);
  const [isEqReqModalOpen, setIsEqReqModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  // Consumable and contingency indents are raised fresh rather than from a
  // pre-existing row, so unlike equipment there is nothing to preselect.
  const [isConsumablesModalOpen, setIsConsumablesModalOpen] = useState(false);
  const [isContingencyModalOpen, setIsContingencyModalOpen] = useState(false);
  const [isTravelModalOpen, setIsTravelModalOpen] = useState(false);
  const [isReappropriationModalOpen, setIsReappropriationModalOpen] = useState(false);
  const [isDaModalOpen, setIsDaModalOpen] = useState(false);


  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [isScreeningModalOpen, setIsScreeningModalOpen] = useState(false);
  const [isSelectionProformaModalOpen, setIsSelectionProformaModalOpen] = useState(false);
  const [isMinutesModalOpen, setIsMinutesModalOpen] = useState(false);
  const [isOfferLetterModalOpen, setIsOfferLetterModalOpen] = useState(false);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [isViewDocModalOpen, setIsViewDocModalOpen] = useState(false);
  const [isUpdateSelectionModalOpen, setIsUpdateSelectionModalOpen] = useState(false);
  const [isRecommendStipendModalOpen, setIsRecommendStipendModalOpen] = useState(false);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);

  const [isUploadIndentDocModalOpen, setIsUploadIndentDocModalOpen] = useState(false);
  const [uploadIndentParams, setUploadIndentParams] = useState(null);
  const [isCancelIndentModalOpen, setIsCancelIndentModalOpen] = useState(false);
  const [cancelIndentParams, setCancelIndentParams] = useState(null);
  const [isCancellingIndent, setIsCancellingIndent] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedManpowerForAd, setSelectedManpowerForAd] = useState(null);

  const [activeBudgetTab, setActiveBudgetTab] = useState('Overall Summary');
  const [activeSection, setActiveSection] = useState('overview');
  const [indents, setIndents] = useState([]);
  const [travelRequests, setTravelRequests] = useState([]);

  // Indents live behind one endpoint per type; the page shows them per type, so
  // each result is tagged with the type it came from.
  const loadIndents = async () => {
    const results = await Promise.all(
      INDENT_TYPES.map((type) =>
        listIndentsForProject(type.value, id)
          .then((rows) => (rows ?? []).map((row) => ({ ...row, indentType: type.value })))
          .catch(() => [])
      )
    );
    setIndents(results.flat());
  };

  const loadTravelRequests = async () => {
    const rows = await listTravelRequestsForProject(id).catch(() => []);
    setTravelRequests(rows ?? []);
  };

  const loadProjectData = async () => {
    try {
      const projectData = await getProject(id);
      setProject(projectData);
      const summaryData = await getBudgetSummary(id).catch(() => ({ lines: [], reappropriations: [] }));
      setBudgetLines(summaryData?.lines || []);
      setReappropriationSummary(summaryData?.reappropriations || []);
      const receiptsData = await listGrantReceipts(id).catch(() => []);
      setGrantReceipts(receiptsData || []);
      await loadGrantReceiptWorkflows(receiptsData || []);
    } catch {
      setError('Failed to load project.');
    }
  };

  // Only PendingApproval receipts have a workflow instance worth rendering --
  // Draft is the pre-auinstant (never actually observed, see
  // GrantReceiptChainActions' own note) and Approved/Rejected receipts have
  // already left the chain, so their timeline is not fetched here to keep
  // this page's load from growing with every historical receipt.
  const loadGrantReceiptWorkflows = async (receipts) => {
    const pending = receipts.filter(
      (r) => r.status === 'PendingApproval' && r.workflowInstanceId
    );
    const entries = await Promise.all(
      pending.map(async (r) => {
        try {
          const instance = await getWorkflowInstance(r.workflowInstanceId);
          return [r.id, instance];
        } catch {
          return [r.id, null];
        }
      })
    );
    setGrantReceiptWorkflows(Object.fromEntries(entries));
  };

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      loadProjectData(),
      loadIndents().catch(() => { }),
      loadTravelRequests().catch(() => { }),
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openIndent = (indent) => {
    const type = (indent?.indentType || 'Consumable').toLowerCase();
    navigate(`/procurement/indents/${type}/${indent.id}`);
  };

  const viewDocumentForIndent = async (indent) => {
    if (!indent) return;
    setDocumentTitle(`Indent PDF - ${indent.name || indent.itemName || 'Document'}`);
    setDocumentUrl(`/api/v1/indents/dynamic/${indent.id}/document`);
    setIsViewDocModalOpen(true);
  };

  const viewTravelDocument = async (request) => {
    if (!request) return;
    try {
      const { getChecklist, documentDownloadPath } = await import('../../api/documentsApi');
      const checklist = await getChecklist({
        requestType: 'Travel',
        phase: 'Indent',
        requestId: request.id,
        ownerType: 'TravelRequest'
      });
      // The generated form is saved under DocumentKind.TravelRequestForm
      const generatedForm = checklist?.items?.find(i => i.documentKind === 'TravelRequestForm' || i.name?.toLowerCase().includes('generated'));

      if (generatedForm && generatedForm.documentId) {
        setDocumentTitle(`Travel Request - ${request.place || 'Document'}`);
        // Strip the '/api' prefix since ViewManpowerDocumentModal adds it via apiClient. Wait, no, ViewManpowerDocumentModal uses `apiBlob(path)` and strips the base URL, but `documentDownloadPath` returns `/api/documents/...` which works perfectly with `apiBlob`.
        setDocumentUrl(documentDownloadPath(generatedForm.documentId));
        setIsViewDocModalOpen(true);
      } else {
        // Fallback if not generated yet
        setDocumentTitle(`Travel Request - ${request.place || 'Document'}`);
        setDocumentUrl('');
        setIsViewDocModalOpen(true);
      }
    } catch (e) {
      console.error(e);
      // Fallback
      setDocumentTitle(`Travel Request - ${request.place || 'Document'}`);
      setDocumentUrl('');
      setIsViewDocModalOpen(true);
    }
  };

  const handleCancelIndentConfirm = async (reason) => {
    if (!cancelIndentParams) return;
    setIsCancellingIndent(true);
    try {
      const { getIndent } = await import('../../api/procurementApi');
      const { apiPost } = await import('../../api/apiClient');
      const fullIndent = await getIndent(cancelIndentParams.indentType, cancelIndentParams.id);
      if (!fullIndent.workflowInstanceId) {
        throw new Error('No active workflow found for this indent.');
      }
      await apiPost(`/api/workflows/${fullIndent.workflowInstanceId}/cancel`, { remarks: reason });
      setIsCancelIndentModalOpen(false);
      setCancelIndentParams(null);
      loadAllData();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsCancellingIndent(false);
    }
  };

  // Raising an indent commits money against a budget head and adds a row to the
  // type's table, so both are stale until refetched.
  const handleIndentRaised = () => {
    getBudgetSummary(id)
      .then((summaryData) => {
        setBudgetLines(summaryData?.lines || []);
        setReappropriationSummary(summaryData?.reappropriations || []);
      })
      .catch(() => { /* the indent was raised; a stale summary is not worth an error */ });
    void loadIndents();
  };

  // Travel commits against a head just as an indent does, so the summary is
  // stale after a raise too.
  const handleTravelRaised = () => {
    getBudgetSummary(id)
      .then((summaryData) => {
        setBudgetLines(summaryData?.lines || []);
        setReappropriationSummary(summaryData?.reappropriations || []);
      })
      .catch(() => { /* the request was raised; a stale summary is not worth an error */ });
    void loadTravelRequests();
  };

  // Wired and working, but no control calls it yet -- the workflow action buttons
  // are still to be added to this page. Kept rather than deleted so that work does
  // not have to be redone.
  // eslint-disable-next-line no-unused-vars
  const handleWorkflowAction = async (action) => {
    if (!project?.workflowInstanceId) return;
    setWorkflowActionLoading(true);
    try {
      await actionWorkflow(project.workflowInstanceId, action);
      const projectData = await getProject(id);
      setProject(projectData);
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setWorkflowActionLoading(false);
    }
  };

  const durationYears = useMemo(() => {
    if (!project || !project.durationMonths) return 1;
    return Math.max(1, Math.ceil(project.durationMonths / 12));
  }, [project]);

  const budgetTabs = useMemo(() => {
    const tabs = Array.from({ length: durationYears }, (_, i) => `Year ${i + 1}`);
    tabs.push('Overall Summary');
    return tabs;
  }, [durationYears]);

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Intersection Observer to update active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { rootMargin: '-20% 0px -80% 0px' });

    const sections = ['overview', 'budget', 'equipment', 'manpower', 'consumables', 'contingency', 'travel'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Error Loading Project</h3>
        <p className="text-slate-500 dark:text-slate-400">{error ?? 'Project not found.'}</p>
      </div>
    );
  }

  const typeLabel = PROJECT_TYPES.find((t) => t.value === project.projectType)?.label ?? project.projectType;
  const isBudgetExceeded = Boolean(project && project.totalSanctioned < project.totalAmount);
  const isProjectApproved = Boolean(project && (project.status === 'Approved' || project.status === 'Active') && !isBudgetExceeded);

  const eqData = project.sanctionedEquipment || [];
  const manpowerData = project.sanctionedManpowerPositions || [];
  // Raised indents, split by type. These previously read project.consumables /
  // project.contingency, which the API never returns, so both tables were always
  // empty regardless of what had been raised.
  const consumablesData = indents.filter((i) => i.indentType === 'Consumable');
  const contingencyData = indents.filter((i) => i.indentType === 'Contingency');
  const equipmentIndents = indents.filter((i) => i.indentType === 'Equipment');
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutTemplate },
    { id: 'budget', label: 'Budget & Grants', icon: Wallet },
    { id: 'equipment', label: 'Equipment', icon: MonitorSmartphone },
    { id: 'manpower', label: 'Manpower', icon: Users },
    { id: 'consumables', label: 'Consumables', icon: Box },
    { id: 'contingency', label: 'Contingency', icon: Briefcase },
    { id: 'travel', label: 'Travel', icon: Plane }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* 1. Premium Header (Stays separate at top) */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Ongoing Project
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
              Year 1
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Current Year: {new Date().getFullYear()}
            </span>
            {typeLabel && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                {typeLabel}
              </span>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-4xl">
                {project.projectTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                {project.piName && (
                  <>
                    <span className="flex items-center gap-1.5"><UserCog size={16} /> PI: <span className="text-slate-900 dark:text-slate-200">{project.piName}</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                  </>
                )}
                {project.collaborators?.length > 0 && (
                  <>
                    <span className="flex items-center gap-1.5"><Users size={16} /> Co-PI: <span className="text-slate-900 dark:text-slate-200">{project.collaborators.map(c => c.faculty).join(", ")}</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                  </>
                )}
                <span className="flex items-center gap-1.5"><ClipboardList size={16} /> Sanction No: <span className="text-slate-900 dark:text-slate-200">{project.sanctionNo}</span></span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                <span className="flex items-center gap-1.5"><Building2 size={16} /> Agency: <span className="text-slate-900 dark:text-slate-200">{project.agency}</span></span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                <span className="flex items-center gap-1.5"><Wallet size={16} /> Total Sanctioned: <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(project.totalSanctioned)}</span></span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                <span className="flex items-center gap-1.5"><Wallet size={16} /> Total (Budget + Overhead): <span className="text-violet-600 dark:text-violet-400">{formatCurrency(project.totalAmount)}</span></span>
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
              <button
                onClick={() => setIsDaModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm font-semibold"
              >
                <UserCog size={16} /> Dealing Assistant
              </button>
              <button
                onClick={() => navigate(`/projects/${id}/edit`)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm font-semibold"
              >
                <Edit2 size={16} /> Edit Project
              </button>
              {/* <button
                onClick={() => navigate(`/projects/${id}/grant-receipts/new`)}
                className="flex items-center gap-2 px-5 py-2.5 hover:hover:text-white rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 font-semibold"
              >
                <FilePlus size={16} /> Record Grant
              </button> */}
            </div>
          </div>
        </div>
      </div>

      <DaAssignmentModal
        project={project}
        isOpen={isDaModalOpen}
        onClose={() => setIsDaModalOpen(false)}
        onUpdated={() => { /* the modal re-fetches its own history; no other page state derives from the DA */ }}
        canAssign={canAssignDa}
      />

      {/* Sanction Mismatch Warning Banner */}
      {project.totalSanctioned < project.totalAmount && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm shadow-sm space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-100 text-base">
            <AlertCircle className="text-rose-600 dark:text-rose-400 shrink-0" size={20} />
            <span>Sanctioned Amount Validation Warning</span>
          </div>
          <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
            Note: Please edit the grant amount or Sanctioned Budget Heads as total budget from heads ({formatCurrency(project.totalAmount)}) exceeds/does not match Total Sanctioned ({formatCurrency(project.totalSanctioned)}).
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold pt-1">
            <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-800">
              Total Sanctioned: {formatCurrency(project.totalSanctioned)}
            </span>
            <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-800">
              Proposed Budget Total: {formatCurrency(project.totalAmount)}
            </span>
            <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100 rounded-lg border border-rose-300 dark:border-rose-700 font-extrabold">
              Exceeded Difference: {formatCurrency(project.totalAmount - project.totalSanctioned)}
            </span>
            <button
              type="button"
              onClick={() => navigate(`/projects/${id}/edit`)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-bold shadow-sm cursor-pointer ml-auto"
            >
              Edit Project & Budget Heads
            </button>
          </div>
        </div>
      )}

      {/* Unapproved Project Warning Banner */}
      {!isProjectApproved && !isBudgetExceeded && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium shadow-sm flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
          <span>
            <strong>Project Pending Approval:</strong> Requisition actions, grant receipt recording, and travel requests are disabled until the project is approved by the Dean.
          </span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* Sticky Sidebar Navigation */}
        <aside className="sidebar w-full lg:w-64 shrink-0 lg:sticky lg:top-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 block">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-3">Project Details</h3>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <Icon size={18} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Continuous Document Content Area */}
        <div className="flex-1 space-y-6 w-full">

          {/* Workflow Actions Section */}
          <ProjectWorkflowActions project={project} onActed={loadAllData} />

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 w-full overflow-hidden">

            {/* OVERVIEW SECTION */}
            <section id="overview" className="p-6 lg:p-8 scroll-mt-8">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <LayoutTemplate size={22} className="text-blue-500" /> Overview & Basic Info
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <span className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Project Type</span>
                  <span className="inline-block font-semibold text-slate-800 dark:text-slate-200">{typeLabel}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <span className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Sanction Date</span>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"><Calendar size={16} className="text-blue-500" /> {project.sanctionDate}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <span className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Start Date</span>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"><Calendar size={16} className="text-emerald-500" /> {project.startDate}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <span className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Duration</span>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"><Clock size={16} className="text-indigo-500" /> {project.durationMonths} Months</div>
                </div>
              </div>



              <h3 className="text-md font-bold text-slate-800 dark:text-white mb-4">Co-Principal Investigators (Co-PI) & Collaborators</h3>
              {project.collaborators?.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No Co-PIs or collaborators assigned.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                    <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-5 py-4 w-16 text-center">S.No</th>
                        <th className="px-5 py-4">Co-PI / Faculty / Scientist</th>
                        <th className="px-5 py-4">Institute / Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {project.collaborators?.map((c, i) => (
                        <tr key={c.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-5 py-4 text-center font-medium text-slate-400">{i + 1}</td>
                          <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{c.faculty}</td>
                          <td className="px-5 py-4 flex items-center gap-1.5"><Building2 size={16} className="text-slate-400" /> {c.institute}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* BUDGET SECTION */}
            <section id="budget" className="p-6 lg:p-8 scroll-mt-8 bg-slate-50/30 dark:bg-slate-800/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet size={22} className="text-emerald-500" /> Budget & Grant Details
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsReappropriationModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors shadow-sm"
                  >
                    Reappropriation History Log
                  </button>
                </div>
                <div className="flex bg-slate-200/50 dark:bg-slate-700/50 p-1 rounded-lg overflow-x-auto">
                  {budgetTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveBudgetTab(tab)}
                      className={`px-4 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap transition-colors ${activeBudgetTab === tab
                          ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <ReappropriationHistoryModal
                project={project}
                isOpen={isReappropriationModalOpen}
                onClose={() => setIsReappropriationModalOpen(false)}
                onUpdated={() => {
                  loadProjectData();
                }}
                reappropriationSummary={reappropriationSummary}
                budgetLines={budgetLines}
                isProjectApproved={isProjectApproved}
              />


              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3">Budget Head</th>
                      <th className="px-4 py-3 text-right">Sanctioned Budget (₹)</th>
                      <th className="px-4 py-3 text-right">Grant Received (₹)</th>
                      <th className="px-4 py-3 text-right">Used (₹)</th>
                      <th className="px-4 py-3 text-right">Available Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(() => {
                      let displayLines;
                      if (activeBudgetTab === 'Overall Summary') {
                        const aggregated = {};
                        budgetLines.forEach(line => {
                          const key = `${line.headName}-${line.customLabel || ''}`;
                          if (!aggregated[key]) {
                            aggregated[key] = { headName: line.headName, customLabel: line.customLabel, sanctioned: 0, grantReceived: 0, spent: 0, available: 0 };
                          }
                          aggregated[key].sanctioned += (line.sanctioned || 0);
                          aggregated[key].grantReceived += (line.grantReceived || 0);
                          aggregated[key].spent += (line.spent || 0);
                          aggregated[key].available += (line.available || 0);
                        });
                        displayLines = Object.values(aggregated);
                      } else {
                        const yearMatch = activeBudgetTab.match(/\d+/);
                        const yearNum = yearMatch ? parseInt(yearMatch[0], 10) : 1;
                        displayLines = budgetLines.filter(line => line.projectYear === yearNum);
                      }

                      if (displayLines.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No budget details available.</td>
                          </tr>
                        );
                      }

                      const totals = displayLines.reduce((acc, curr) => ({
                        sanctioned: acc.sanctioned + (curr.sanctioned || 0),
                        grantReceived: acc.grantReceived + (curr.grantReceived || 0),
                        spent: acc.spent + (curr.spent || 0),
                        available: acc.available + (curr.available || 0)
                      }), { sanctioned: 0, grantReceived: 0, spent: 0, available: 0 });

                      return (
                        <>
                          {displayLines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-4 font-semibold text-slate-800 dark:text-slate-200">
                                {getBudgetHeadDisplay(line.headName, line.customLabel)}
                              </td>
                              <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                                {formatCurrency(line.sanctioned)}
                              </td>
                              <td className="px-4 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(line.grantReceived)}
                              </td>
                              <td className="px-4 py-4 text-right font-medium text-rose-600 dark:text-rose-400">
                                {formatCurrency(line.spent)}
                              </td>
                              <td className="px-4 py-4 text-right font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(line.available)}
                              </td>
                            </tr>
                          ))}
                          {activeBudgetTab === 'Overall Summary' && reappropriationSummary.map((r) => (
                            <tr key={`reappropriation-${r.headName}`} className="bg-indigo-50/50 dark:bg-indigo-950/20">
                              <td className="px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-300 text-xs">
                                {getBudgetHeadDisplay(r.headName, r.customLabel)} — Re-appropriated (project total)
                              </td>
                              <td className="px-4 py-3 text-right text-slate-400">—</td>
                              <td className="px-4 py-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                                {r.netReappropriated > 0 ? '+' : ''}{formatCurrency(r.netReappropriated)}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-400">—</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                                Effective: {formatCurrency(r.effectiveTotalReceived)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700">
                            <td className="px-4 py-4 font-extrabold text-slate-900 dark:text-white text-right uppercase tracking-wider text-xs">Total</td>
                            <td className="px-4 py-4 text-right font-extrabold text-slate-900 dark:text-white">{formatCurrency(totals.sanctioned)}</td>
                            <td className="px-4 py-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.grantReceived)}</td>
                            <td className="px-4 py-4 text-right font-extrabold text-rose-600 dark:text-rose-400">{formatCurrency(totals.spent)}</td>
                            <td className="px-4 py-4 text-right font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(totals.available)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Grant Receipts -- each receipt now goes through PI -> HOD ->
                R&C office -> Dean before it counts toward the sanctioned sum
                above (GrantReceiptWorkflowSeeder.Route); this list is where a
                PI can see a receipt's real approval status rather than only
                its downstream effect on the totals. */}
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText size={18} className="text-emerald-500" /> Grant Receipts
                  </h3>
                  <button
                    disabled={!isProjectApproved}
                    title={!isProjectApproved ? "Grant receipts cannot be recorded until the project is approved by the Dean." : ""}
                    onClick={() => {
                      if (!isProjectApproved) return;
                      navigate(`/projects/${id}/grant-receipts/new`);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                      isProjectApproved
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <FilePlus size={14} /> Record Grant Receipt
                  </button>
                </div>

                {showGrantReceiptSubmitted && (
                  <div className="mb-4 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
                    <span>Submitted to HOD for approval. It will count toward the sanctioned amount once the full chain approves it.</span>
                    <button onClick={() => setShowGrantReceiptSubmitted(false)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200">
                      <X size={16} />
                    </button>
                  </div>
                )}

                <GrantReceiptApprovalList
                  receipts={grantReceipts}
                  budgetHeads={project?.budgetHeads}
                  workflowInstances={grantReceiptWorkflows}
                  projectId={id}
                  onActed={loadProjectData}
                />
              </div>
            </section>

            {/* EQUIPMENT SECTION */}
            <section id="equipment" className="p-6 lg:p-8 scroll-mt-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MonitorSmartphone size={22} className="text-indigo-500" /> Sanctioned Equipment
                </h2>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-4 w-16 text-center">S.No</th>
                      <th className="px-5 py-4">Equipment Name</th>
                      <th className="px-5 py-4">Unit</th>
                      <th className="px-5 py-4 text-right">Amount (₹)</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {eqData.map((eq, i) => (
                      <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-4 text-center font-medium text-slate-400">{i + 1}</td>
                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{eq.name}</td>
                        <td className="px-5 py-4">{eq.unit}</td>
                        <td className="px-5 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(eq.amount)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize border border-slate-200 dark:border-slate-700">
                            {(eq.requisition_status || eq.status || 'not_raised').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ActionMenu>
                            {(() => {
                              const eqStatus = eq.requisition_status || eq.status || 'not_raised';
                              if (eqStatus === 'not_raised') {
                                return <ActionItem icon={FilePlus} label="Raise Requisition" disabled={!isProjectApproved} title={!isProjectApproved ? "Requisitions cannot be raised until the project is approved by the Dean." : ""} onClick={() => {
                                  if (!isProjectApproved) return;
                                  setSelectedEquipment(eq);
                                  setIsEqReqModalOpen(true);
                                }} />;
                              }
                              return (
                                <>
                                  {['indent_raised', 'indent_raised_uploaded', 'approved', 'assigned', 'forwarded', 'forwarded1', 'forwarded2', 'director', 'bill_processed', 'bill_processed_uploaded', 'paid', 'bill_approved'].includes(eqStatus) && (
                                    <ActionItem icon={FileText} label="View Indent" onClick={() => {
                                      const indent = equipmentIndents.find(i => i.name === eq.name);
                                      if (indent) viewDocumentForIndent(indent, 'Indent', null);
                                    }} />
                                  )}
                                  {eqStatus === 'indent_raised' && (
                                    <ActionItem icon={FilePlus} label="Upload Signed Indent" onClick={() => {
                                      const indent = equipmentIndents.find(i => i.name === eq.name);
                                      if (indent) {
                                        setUploadIndentParams({ indentId: indent.id, indentType: indent.indentType, phase: 'Indent', title: 'Upload Signed Indent', workflowInstanceId: indent.workflowInstanceId });
                                        setIsUploadIndentDocModalOpen(true);
                                      }
                                    }} />
                                  )}
                                  {eqStatus === 'approved' && (
                                    <ActionItem icon={FileText} label="Generate Cover Letter & Process Bill" onClick={() => {
                                      const indent = equipmentIndents.find(i => i.name === eq.name);
                                      if (indent) openIndent(indent);
                                    }} />
                                  )}
                                  {eqStatus === 'bill_processed' && (
                                    <>
                                      <ActionItem icon={FileText} label="View Bill Cover Letter" onClick={() => {
                                        const indent = equipmentIndents.find(i => i.name === eq.name);
                                        if (indent) viewDocumentForIndent(indent, 'Bill', 'Generated Cover Letter');
                                      }} />
                                      <ActionItem icon={FilePlus} label="Upload Signed Cover Letter" onClick={() => {
                                        const indent = equipmentIndents.find(i => i.name === eq.name);
                                        if (indent) {
                                          setUploadIndentParams({ indentId: indent.id, indentType: indent.indentType, phase: 'Bill', title: 'Upload Signed Cover Letter', workflowInstanceId: indent.workflowInstanceId });
                                          setIsUploadIndentDocModalOpen(true);
                                        }
                                      }} />
                                    </>
                                  )}
                                  {['bill_processed_uploaded', 'paid'].includes(eqStatus) && (
                                    <ActionItem icon={FileText} label="View Signed Cover Letter" onClick={() => {
                                      const indent = equipmentIndents.find(i => i.name === eq.name);
                                      if (indent) viewDocumentForIndent(indent, 'Bill', 'Signed Cover Letter');
                                    }} />
                                  )}
                                  {['indent_raised', 'indent_raised_uploaded'].includes(eqStatus) && (
                                    <>
                                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                      <ActionItem icon={AlertCircle} label="Cancel Indent" danger onClick={() => {
                                        const indent = equipmentIndents.find(i => i.name === eq.name);
                                        if (indent) {
                                          setCancelIndentParams(indent);
                                          setIsCancelIndentModalOpen(true);
                                        }
                                      }} />
                                    </>
                                  )}
                                </>
                              );
                            })()}
                          </ActionMenu>
                        </td>
                      </tr>
                    ))}
                    {eqData.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No equipment sanctioned.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>


            </section>

            {/* MANPOWER SECTION */}
            <section id="manpower" className="p-6 lg:p-8 scroll-mt-8 bg-slate-50/30 dark:bg-slate-800/10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users size={22} className="text-amber-500" /> Manpower Details
                </h2>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-4 w-16 text-center">S.No</th>
                      <th className="px-5 py-4">Designation</th>
                      <th className="px-5 py-4 text-center">Positions</th>
                      <th className="px-5 py-4 text-right">Stipend</th>
                      <th className="px-5 py-4 text-right">HRA</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {manpowerData.map((mp, i) => (
                      <tr key={mp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-4 text-center font-medium text-slate-400">{i + 1}</td>
                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{mp.designation}</td>
                        <td className="px-5 py-4 text-center font-semibold bg-slate-50/50 dark:bg-slate-800/10">{mp.positions}</td>
                        <td className="px-5 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(mp.stipend)}</td>
                        <td className="px-5 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(mp.hra)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                            {mp.status || 'Not Started'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ActionMenu>
                            <ActionItem label="Manage Recruitment" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={async () => {
                              if (!isProjectApproved) return;
                              try {
                                const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
                                const recId = await getOrCreateRecruitment(project?.id, mp.id);
                                navigate(`/recruitments/${recId}`);
                              } catch {
                                // Global toast shows the error automatically.
                              }
                            }} />
                            <ActionSubMenu label="Generate Forms">
                              <ActionItem label="Generate advertisement" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                                if (!isProjectApproved) return;
                                setSelectedManpowerForAd(mp);
                                setIsAdModalOpen(true);
                              }} />
                              <ActionItem label="Generate Screening Committee Proforma" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                                if (!isProjectApproved) return;
                                setSelectedManpowerForAd(mp);
                                setIsScreeningModalOpen(true);
                              }} />
                              <ActionItem label="Generate Selection Committee Proforma" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                                if (!isProjectApproved) return;
                                setSelectedManpowerForAd(mp);
                                setIsSelectionProformaModalOpen(true);
                              }} />
                              <ActionItem label="Generate Minutes of Selection" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                                if (!isProjectApproved) return;
                                setSelectedManpowerForAd(mp);
                                setIsMinutesModalOpen(true);
                              }} />
                              <ActionItem label="Generate Offer Letter" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                                if (!isProjectApproved) return;
                                setSelectedManpowerForAd(mp);
                                setIsOfferLetterModalOpen(true);
                              }} />
                            </ActionSubMenu>

                            <ActionSubMenu label="View Generated Forms">
                              <ActionItem label="View Generated Advertisement" onClick={async () => {
                                setDocumentTitle('Generated Advertisement');
                                try {
                                  const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
                                  const recId = await getOrCreateRecruitment(project?.id, mp.id);
                                  setDocumentUrl(`/api/recruitments/${recId}/documents/Advertisement`);
                                  setIsViewDocModalOpen(true);
                                } catch {
                                  // Global toast shows the error automatically.
                                }
                              }} />
                              <ActionItem label="View Screening Committee Proforma" onClick={async () => {
                                setDocumentTitle('Screening Committee Proforma');
                                try {
                                  const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
                                  const recId = await getOrCreateRecruitment(project?.id, mp.id);
                                  setDocumentUrl(`/api/recruitments/${recId}/documents/ScreeningProforma`);
                                  setIsViewDocModalOpen(true);
                                } catch (e) { console.error(e); }
                              }} />
                              <ActionItem label="View Selection Committee Proforma" onClick={async () => {
                                setDocumentTitle('Selection Committee Proforma');
                                try {
                                  const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
                                  const recId = await getOrCreateRecruitment(project?.id, mp.id);
                                  setDocumentUrl(`/api/recruitments/${recId}/documents/SelectionProforma`);
                                  setIsViewDocModalOpen(true);
                                } catch (e) { console.error(e); }
                              }} />
                              <ActionItem label="View Minutes of Selection" onClick={async () => {
                                setDocumentTitle('Minutes of Selection');
                                try {
                                  const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
                                  const recId = await getOrCreateRecruitment(project?.id, mp.id);
                                  setDocumentUrl(`/api/recruitments/${recId}/documents/MinutesOfSelection`);
                                  setIsViewDocModalOpen(true);
                                } catch (e) { console.error(e); }
                              }} />
                              <ActionItem label="View Generated Offer Letter" onClick={async () => {
                                setDocumentTitle('Offer Letter');
                                try {
                                  const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
                                  const recId = await getOrCreateRecruitment(project?.id, mp.id);
                                  setDocumentUrl(`/api/recruitments/${recId}/documents/OfferLetter`);
                                  setIsViewDocModalOpen(true);
                                } catch (e) { console.error(e); }
                              }} />
                              <ActionItem label="View Generated Stipend Form" onClick={() => {
                                setDocumentTitle('Stipend Form');
                                setDocumentUrl(''); // Stipend Form might not have a backend endpoint yet
                                setIsViewDocModalOpen(true);
                              }} />
                            </ActionSubMenu>
                            <ActionItem label="Upload Manpower Documents" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                              if (!isProjectApproved) return;
                              setSelectedManpowerForAd(mp);
                              setIsUploadDocModalOpen(true);
                            }} />
                            <ActionItem label="View Status & Signed Documents" onClick={() => { setDocumentTitle('Status & Signed Documents'); setIsViewDocModalOpen(true); }} />
                            <ActionItem label="Update selection" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                              if (!isProjectApproved) return;
                              setSelectedManpowerForAd(mp);
                              setIsUpdateSelectionModalOpen(true);
                            }} />
                            <ActionItem label="Update Manpower status" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                              if (!isProjectApproved) return;
                              setSelectedManpowerForAd(mp);
                              setIsUpdateStatusModalOpen(true);
                            }} />
                            <ActionItem label="Recommend stipend" disabled={!isProjectApproved} title={!isProjectApproved ? "Project must be approved by Dean first" : ""} onClick={() => {
                              if (!isProjectApproved) return;
                              setSelectedManpowerForAd(mp);
                              setIsRecommendStipendModalOpen(true);
                            }} />
                          </ActionMenu>
                        </td>
                      </tr>
                    ))}
                    {manpowerData.length === 0 && (
                      <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No manpower sanctioned.</td></tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>
            {/* CONSUMABLES SECTION */}
            <section id="consumables" className="p-6 lg:p-8 scroll-mt-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Box size={22} className="text-purple-500" /> Recurring: Consumables
                </h2>
                <button
                  disabled={!isProjectApproved}
                  title={!isProjectApproved ? "Consumables requisition cannot be raised until the project is approved by the Dean." : ""}
                  onClick={() => {
                    if (!isProjectApproved) return;
                    setIsConsumablesModalOpen(true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                    isProjectApproved
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  Raise a new requisition
                </button>
              </div>
              <IndentList
                indents={consumablesData}
                emptyMessage="No consumables requisitioned yet"
                renderAction={(indent) => {
                  const stage = indent.currentStage;
                  const isInitial = !stage || ['Raised', 'indent_raised', 'Draft', 'WithPIFellowship'].includes(stage);
                  return (
                    <ActionMenu>
                      <ActionItem
                        icon={FileText}
                        label="View Indent PDF"
                        onClick={() => viewDocumentForIndent(indent)}
                      />

                      <ActionItem
                        icon={FileText}
                        label="Download PDF"
                        onClick={async () => {
                          const { downloadDynamicIndentDocument } = await import('../../api/dynamicIndentApi');
                          downloadDynamicIndentDocument(indent.id);
                        }}
                      />
                      {!['Approved', 'IndentApproved', 'Rejected', 'Cancelled'].includes(stage) && (
                        <ActionItem icon={FilePlus} label={isInitial ? "Upload Signed Indent" : "Upload / Replace Signed Indent"} onClick={() => {
                          setUploadIndentParams({ indentId: indent.id, indentType: 'Consumable', phase: 'Indent', title: 'Upload Signed Indent', workflowInstanceId: indent.workflowInstanceId });
                          setIsUploadIndentDocModalOpen(true);
                        }} />
                      )}
                      <>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        <ActionItem icon={AlertCircle} label="Cancel Indent" danger onClick={() => {
                          setCancelIndentParams(indent);
                          setIsCancelIndentModalOpen(true);
                        }} />
                      </>
                    </ActionMenu>
                  );
                }}
              />
            </section>

            {/* CONTINGENCY SECTION */}
            <section id="contingency" className="p-6 lg:p-8 scroll-mt-8 bg-slate-50/30 dark:bg-slate-800/10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase size={22} className="text-pink-500" /> Recurring: Contingency
                </h2>
                <button
                  disabled={!isProjectApproved}
                  title={!isProjectApproved ? "Contingency requisition cannot be raised until the project is approved by the Dean." : ""}
                  onClick={() => {
                    if (!isProjectApproved) return;
                    setIsContingencyModalOpen(true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                    isProjectApproved
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  Raise a new requisition
                </button>
              </div>
              <IndentList
                indents={contingencyData}
                emptyMessage="No contingency requisitioned yet"
                renderAction={(indent) => {
                  const stage = indent.currentStage;
                  const isInitial = !stage || ['Raised', 'indent_raised', 'Draft', 'WithPIFellowship'].includes(stage);
                  return (
                    <ActionMenu>
                      <ActionItem
                        icon={FileText}
                        label="View Indent PDF"
                        onClick={() => viewDocumentForIndent(indent)}
                      />

                      <ActionItem
                        icon={FileText}
                        label="Download PDF"
                        onClick={async () => {
                          const { downloadDynamicIndentDocument } = await import('../../api/dynamicIndentApi');
                          downloadDynamicIndentDocument(indent.id);
                        }}
                      />
                      {!['Approved', 'IndentApproved', 'Rejected', 'Cancelled'].includes(stage) && (
                        <ActionItem icon={FilePlus} label={isInitial ? "Upload Signed Indent" : "Upload / Replace Signed Indent"} onClick={() => {
                          setUploadIndentParams({ indentId: indent.id, indentType: 'Contingency', phase: 'Indent', title: 'Upload Signed Indent', workflowInstanceId: indent.workflowInstanceId });
                          setIsUploadIndentDocModalOpen(true);
                        }} />
                      )}
                      <>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        <ActionItem icon={AlertCircle} label="Cancel Indent" danger onClick={() => {
                          setCancelIndentParams(indent);
                          setIsCancelIndentModalOpen(true);
                        }} />
                      </>
                    </ActionMenu>
                  );
                }}
              />
            </section>

            {/* TRAVEL SECTION */}
            <section id="travel" className="p-6 lg:p-8 scroll-mt-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plane size={22} className="text-sky-500" /> Recurring: Travel
                </h2>
                <button
                  disabled={!isProjectApproved}
                  title={!isProjectApproved ? "Travel requests cannot be raised until the project is approved by the Dean." : ""}
                  onClick={() => {
                    if (!isProjectApproved) return;
                    setIsTravelModalOpen(true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                    isProjectApproved
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  Raise a new travel request
                </button>
              </div>
              <TravelList
                requests={travelRequests}
                onSelect={(request) => navigate(`/travel/${request.id}`)}
                emptyMessage="No travel requests raised yet"
                renderAction={(request) => {
                  const stage = request.currentStage;
                  const isInitial = !stage || ['Raised', 'indent_raised', 'Draft', 'WithPIFellowship'].includes(stage);
                  const isFellowStage = stage === 'WithPITravel';
                  return (
                    <ActionMenu>
                      <ActionItem
                        icon={FileText}
                        label="View Travel Request PDF"
                        onClick={() => viewTravelDocument(request)}
                      />
                      {!['Approved', 'IndentApproved', 'Rejected', 'Cancelled'].includes(stage) && (
                        <ActionItem icon={FilePlus} label={isInitial ? "Upload Signed Request" : "Re-upload Signed Request"} onClick={() => {
                          setUploadIndentParams({ indentId: request.id, indentType: 'Travel', phase: 'Indent', title: 'Upload Signed Request', workflowInstanceId: request.workflowInstanceId });
                          setIsUploadIndentDocModalOpen(true);
                        }} />
                      )}
                      {isFellowStage && (
                        <ActionItem icon={ChevronRight} label="Forward to HOD" onClick={async () => {
                          try {
                            await actionWorkflow(request.workflowInstanceId, 'forward');
                            showToast('Travel request forwarded to HOD successfully!');
                            void loadTravelRequests();
                          } catch (err) {
                            showToast('Failed to forward travel request.', true);
                          }
                        }} />
                      )}
                      <>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        <ActionItem icon={AlertCircle} label="Cancel Travel Request" danger onClick={() => {
                          setCancelIndentParams(request);
                          setIsCancelIndentModalOpen(true);
                        }} />
                      </>
                    </ActionMenu>
                  );
                }}
              />
            </section>

          </div>
        </div>
      </div>

      <EquipmentRequisitionModal
        isOpen={isEqReqModalOpen}
        onClose={() => setIsEqReqModalOpen(false)}
        equipment={selectedEquipment}
        projectId={id}
        budgetHeads={project?.budgetHeads ?? []}
        onRaised={handleIndentRaised}
      />

      <ConsumablesRequisitionModal
        isOpen={isConsumablesModalOpen}
        onClose={() => setIsConsumablesModalOpen(false)}

        projectId={id}
        budgetHeads={project?.budgetHeads ?? []}
        onRaised={handleIndentRaised}
      />

      <ContingencyRequisitionModal
        isOpen={isContingencyModalOpen}
        onClose={() => setIsContingencyModalOpen(false)}

        projectId={id}
        budgetHeads={project?.budgetHeads ?? []}
        onRaised={handleIndentRaised}
      />

      {isTravelModalOpen && (
        <TravelRequestModal
          projectId={id}
          budgetHeads={project?.budgetHeads ?? []}
          manpowerPositions={project?.sanctionedManpowerPositions ?? []}
          onClose={() => setIsTravelModalOpen(false)}
          onRaised={handleTravelRaised}
        />
      )}

      <GenerateAdvertisementModal
        isOpen={isAdModalOpen}
        onClose={() => setIsAdModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
        onGenerateComplete={(recId) => {
          setDocumentTitle('Generated Advertisement');
          setDocumentUrl(`/api/recruitments/${recId}/documents/Advertisement`);
          setIsViewDocModalOpen(true);
        }}
      />

      <GenerateScreeningProformaModal
        isOpen={isScreeningModalOpen}
        onClose={() => setIsScreeningModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
        onComplete={loadProjectData}
      />

      <GenerateMinutesProformaModal
        isOpen={isMinutesModalOpen}
        onClose={() => setIsMinutesModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
        onComplete={loadProjectData}
      />

      <GenerateOfferLetterModal
        isOpen={isOfferLetterModalOpen}
        onClose={() => setIsOfferLetterModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
        onGenerateComplete={(title, url) => {
          setDocumentTitle(title);
          setDocumentUrl(url);
          setIsViewDocModalOpen(true);
        }}
      />

      <UploadManpowerDocumentModal
        isOpen={isUploadDocModalOpen}
        onClose={() => setIsUploadDocModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
        onComplete={loadProjectData}
      />

      <GenerateSelectionProformaModal
        isOpen={isSelectionProformaModalOpen}
        onClose={() => setIsSelectionProformaModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
        onGenerateComplete={async (data) => {
          setIsSelectionProformaModalOpen(false);
          setDocumentTitle('Selection Committee Proforma');
          try {
            const { getOrCreateRecruitment } = await import('./utils/recruitmentHelper');
            const { saveDocumentData } = await import('../../api/recruitmentApi');
            const recId = await getOrCreateRecruitment(project?.id, selectedManpowerForAd.id);
            await saveDocumentData(recId, 'SelectionProforma', data);
            let url = `/api/recruitments/${recId}/documents/SelectionProforma`;
            if (data?.coPi) {
              url += `?coPi=${encodeURIComponent(data.coPi)}`;
            }
            setDocumentUrl(url);
            setIsViewDocModalOpen(true);
          } catch (e) { console.error(e); }
        }}
      />

      <ViewManpowerDocumentModal
        isOpen={isViewDocModalOpen}
        onClose={() => {
          setIsViewDocModalOpen(false);
          loadProjectData();
        }}
        documentType="manpower_document"
        documentTitle={documentTitle}
        documentUrl={documentUrl}
      />

      <UpdateSelectionModal
        isOpen={isUpdateSelectionModalOpen}
        onClose={() => setIsUpdateSelectionModalOpen(false)}
        project={project}
        manpower={selectedManpowerForAd}
      />

      <RecommendStipendModal
        isOpen={isRecommendStipendModalOpen}
        onClose={() => setIsRecommendStipendModalOpen(false)}
        manpower={selectedManpowerForAd}
        project={project}
      />

      <UpdateCandidateStatusModal
        isOpen={isUpdateStatusModalOpen}
        onClose={() => setIsUpdateStatusModalOpen(false)}
      />

      <UploadIndentDocumentModal
        isOpen={isUploadIndentDocModalOpen}
        onClose={() => setIsUploadIndentDocModalOpen(false)}
        onComplete={() => { loadIndents(); loadProjectData(); }}
        {...uploadIndentParams}
      />

      <CancelIndentModal
        isOpen={isCancelIndentModalOpen}
        onClose={() => setIsCancelIndentModalOpen(false)}
        onConfirm={handleCancelIndentConfirm}
        indentName={cancelIndentParams?.name}
        isCancelling={isCancellingIndent}
      />

    </div>
  );
}