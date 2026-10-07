import React, { useState, useEffect, useCallback, createContext, useRef, useContext } from 'react';
import { Plane, Plus, CheckCircle2, AlertCircle, Info, MoreVertical, FileText, FilePlus, ChevronRight } from 'lucide-react';
import { actionWorkflow } from '../api/workflowApi';
import { listAllTravelRequests } from '../api/travelApi';
import { listProjects, getProject } from '../api/projectsApi';
import TravelList from './travel/components/TravelList';
import TravelRequestModal from './travel/components/TravelRequestModal';
import UploadIndentDocumentModal from './projects/components/UploadIndentDocumentModal';
import ViewManpowerDocumentModal from './projects/components/ViewManpowerDocumentModal';
import { ID_CARD_GATE_NOTE } from '../constants/fellowshipEnums';
import { useAuth } from '../auth/useAuth';

const ActionMenuContext = createContext();
const ActionMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <ActionMenuContext.Provider value={() => setIsOpen(false)}>
      <div className="relative inline-block text-left" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <MoreVertical size={20} />
        </button>
        
        {isOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            {children}
          </div>
        )}
      </div>
    </ActionMenuContext.Provider>
  );
};

const ActionItem = ({ icon: Icon, label, onClick, danger }) => {
  const closeMenu = useContext(ActionMenuContext);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        closeMenu();
        onClick();
      }}
      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
        danger 
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10' 
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
};

export default function FellowTravelsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: "", error: false });
  
  // For the modal
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // For document upload/view
  const [isUploadIndentDocModalOpen, setIsUploadIndentDocModalOpen] = useState(false);
  const [uploadIndentParams, setUploadIndentParams] = useState({});
  const [isViewDocModalOpen, setIsViewDocModalOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');

  const showToast = (text, error = false) => {
    setToastMessage({ text, error });
    setTimeout(() => setToastMessage({ text: "", error: false }), 5000);
  };

  const viewTravelDocument = async (request) => {
    if (!request) return;
    try {
      const { getChecklist, documentDownloadPath } = await import('../api/documentsApi');
      const checklist = await getChecklist({
        requestType: 'Travel',
        phase: 'Indent',
        requestId: request.id,
        ownerType: 'TravelRequest'
      });
      const travelDoc = checklist?.items?.find(i => i.documentKind === 'TravelRequestForm' || i.name?.toLowerCase().includes('generated'));
      if (travelDoc && travelDoc.documentId) {
        setDocumentTitle(`Travel Request - ${request.place || 'Document'}`);
        setDocumentUrl(documentDownloadPath(travelDoc.documentId));
        setIsViewDocModalOpen(true);
      } else {
        showToast("Travel request document not found. It may not have been generated yet.", true);
      }
    } catch (err) {
      showToast("Failed to fetch travel document details.", true);
    }
  };

  const load = useCallback(async () => {
    try {
      const [allTravels, visibleProjects] = await Promise.all([
        listAllTravelRequests(),
        listProjects(),
      ]);
      
      // The API returns all requests for visible projects. We filter to only those
      // where the traveler is a Fellow/Manpower so they don't see the PI's personal travel.
      const fellowTravels = (allTravels ?? []).filter(t => 
        t.travelerType === 'Manpower' || 
        (t.travelerTypes && t.travelerTypes.includes('Manpower'))
      );
      
      setRequests(fellowTravels);
      setProjects(visibleProjects ?? []);
      
      if (visibleProjects && visibleProjects.length === 1) {
        setSelectedProjectId(visibleProjects[0].id);
      }
    } catch (err) {
      setError(err.message ?? 'Failed to load travel requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenRaiseModal = async () => {
    if (projects.length === 0) {
      showToast("You are not associated with any active project.", true);
      return;
    }
    
    // If only 1 project, just load its details directly
    const pid = selectedProjectId || projects[0].id;
    setSelectedProjectId(pid);
    
    setIsLoadingProject(true);
    setIsModalOpen(true);
    try {
      const p = await getProject(pid);
      setProjectDetails(p);
    } catch (err) {
      showToast("Failed to load project details.", true);
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleProjectSelect = async (e) => {
    const pid = e.target.value;
    setSelectedProjectId(pid);
    
    if (pid && isModalOpen) {
      setIsLoadingProject(true);
      try {
        const p = await getProject(pid);
        setProjectDetails(p);
      } catch (err) {
        showToast("Failed to load project details.", true);
      } finally {
        setIsLoadingProject(false);
      }
    }
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500">
      {toastMessage.text && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce ${toastMessage.error ? "bg-red-600" : "bg-emerald-600"} text-white`}>
          {toastMessage.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Plane size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Travel Requests</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              View and raise Travel Allowance (TA) requests.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {projects.length > 1 && (
            <select
              value={selectedProjectId || ''}
              onChange={handleProjectSelect}
              className="max-w-[200px] sm:max-w-xs px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white truncate font-medium shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.projectTitle}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleOpenRaiseModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 shrink-0"
          >
            <Plus size={18} /> Raise Travel Request
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{error}</p>
          <p className="flex items-start gap-1.5 mt-2 text-xs text-amber-800 dark:text-amber-300/90">
            <Info size={13} className="mt-0.5 shrink-0" />
            {ID_CARD_GATE_NOTE}
          </p>
        </div>
      ) : isLoading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <TravelList
            requests={requests}
            emptyMessage="No travel requests raised for your projects yet."
            renderAction={(request) => {
              const stage = request.currentStage;
              const isInitial = !stage || ['Raised', 'indent_raised', 'Draft', 'WithPIFellowship', 'WithPI'].includes(stage);
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
                  {stage === 'WithPITravel' && user?.roles?.includes('Faculty') && (
                    <ActionItem icon={ChevronRight} label="Forward to HOD" onClick={async () => {
                      try {
                        await actionWorkflow(request.workflowInstanceId, 'forward');
                        showToast('Travel request forwarded to HOD successfully!');
                        // Refresh the list
                        const rows = await listAllTravelRequests();
                        setRequests(rows || []);
                      } catch (err) {
                        showToast('Failed to forward travel request.', true);
                      }
                    }} />
                  )}
                </ActionMenu>
              );
            }}
          />
        </div>
      )}
      </div>

      {isModalOpen && (
        !projectDetails || isLoadingProject ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-xl text-slate-600 dark:text-slate-300 font-medium">
              Loading project details...
            </div>
          </div>
        ) : (
          <TravelRequestModal
            projectId={projectDetails.id}
            budgetHeads={projectDetails.budgetHeads || []}
            manpowerPositions={projectDetails.manpowerPositions || []}
            isFellow={true}
            onClose={() => setIsModalOpen(false)}
            onRaised={() => {
              setIsModalOpen(false);
              showToast("Travel request raised successfully!");
              load();
            }}
          />
        )
      )}
      
      <UploadIndentDocumentModal
        isOpen={isUploadIndentDocModalOpen}
        onClose={() => setIsUploadIndentDocModalOpen(false)}
        onComplete={() => { load(); }}
        {...uploadIndentParams}
      />
      <ViewManpowerDocumentModal
        isOpen={isViewDocModalOpen}
        onClose={() => setIsViewDocModalOpen(false)}
        documentUrl={documentUrl}
        title={documentTitle}
      />
    </>
  );
}
