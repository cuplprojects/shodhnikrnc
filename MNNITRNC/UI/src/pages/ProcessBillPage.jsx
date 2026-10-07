import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { listProcessBillProjects } from '../api/projectsApi';
import { listIndentsForProject } from '../api/procurementApi';
import { listTravelRequestsForProject } from '../api/travelApi';
import { getWorkflowInstanceByRequest } from '../api/workflowApi';
import { useAuth } from '../auth/useAuth';

function formatStageName(stage) {
  if (!stage || stage === 'Not Processed') return 'Not Processed';
  switch (stage) {
    case 'Draft': return 'Draft';
    case 'Raised': return 'Raised';
    case 'WithHOD':
    case 'SignedCopyUploaded': return 'With HOD';
    case 'AssignedToDealingAssistant':
    case 'Assigned': return 'Assigned to Staff';
    case 'WithRnCOffice': return 'With RnC Office';
    case 'WithSuperintendent':
    case 'Forwarded': return 'With Superintendent';
    case 'WithDeputyRegistrar':
    case 'ForwardedOSRC': return 'With Dy. Registrar';
    case 'WithDean':
    case 'ForwardedDR': return 'With Dean';
    case 'Approved':
    case 'IndentApproved': return 'Approved';
    case 'ReturnedToPI':
    case 'ReturnedByHODToPI':
    case 'ReturnedByDeanToPI':
    case 'IndentReturnedToPI': return 'Returned to PI';
    case 'Rejected': return 'Rejected';
    default: return stage.replace(/([A-Z])/g, ' $1').trim();
  }
}

function getBillingStatusBadge(stage) {
  const formatted = formatStageName(stage);
  if (!stage || stage === 'Not Processed') {
    return (
      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
        Not Processed
      </span>
    );
  }
  if (stage === 'Approved' || stage === 'IndentApproved') {
    return (
      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
        Approved
      </span>
    );
  }
  if (stage === 'Rejected') {
    return (
      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs">
        Rejected
      </span>
    );
  }
  if (stage === 'ReturnedToPI' || stage === 'ReturnedByHODToPI' || stage === 'ReturnedByDeanToPI' || stage === 'IndentReturnedToPI') {
    return (
      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-2xs">
        Returned to PI
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
      {formatted}
    </span>
  );
}

function getItemTypeBadge(item) {
  if (item.indentType === 'Travel') {
    return (
      <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full border text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 shadow-2xs">
        Travel
      </span>
    );
  }
  let typeStr = 'Product';
  if (item.gemCategoryType !== undefined && item.gemCategoryType !== null) {
    if (typeof item.gemCategoryType === 'string') {
      typeStr = item.gemCategoryType;
    } else if (item.gemCategoryType === 1) {
      typeStr = 'Service';
    } else if (item.gemCategoryType === 0) {
      typeStr = 'Product';
    }
  } else if (item.itemType) {
    typeStr = item.itemType;
  } else if (item.categoryType) {
    typeStr = item.categoryType;
  } else if (item.nature) {
    typeStr = item.nature;
  } else if (item.indentType === 'Contingency' && (item.isService || item.serviceType)) {
    typeStr = 'Service';
  } else {
    typeStr = 'Product';
  }

  const isProduct = typeStr.toLowerCase() === 'product';
  return (
    <span className={`whitespace-nowrap inline-flex items-center justify-center px-3 py-1 rounded-full border text-xs font-semibold shadow-2xs ${
      isProduct
        ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800'
        : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    }`}>
      {isProduct ? 'Product' : 'Service'}
    </span>
  );
}

export default function ProcessBillPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [indents, setIndents] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIndents, setLoadingIndents] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Check navigation state for incoming success message
  useEffect(() => {
    if (location.state?.successMsg) {
      setSuccessMsg(location.state.successMsg);
      window.history.replaceState({}, document.title);
      setTimeout(() => setSuccessMsg(null), 6000);
    }
  }, [location]);

  // Fetch department projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      setError(null);
      const data = await listProcessBillProjects();
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id);
        setSelectedProject(data[0]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to fetch department projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch indents when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setIndents([]);
      setSelectedProject(null);
      return;
    }

    const proj = projects.find((p) => p.id === selectedProjectId);
    setSelectedProject(proj || null);

    loadIndentsForProject(selectedProjectId);
  }, [selectedProjectId, projects]);

  const loadIndentsForProject = async (projectId) => {
    try {
      setLoadingIndents(true);
      setError(null);

      const [contingencyRes, equipmentRes, consumableRes, travelRes] = await Promise.allSettled([
        listIndentsForProject('Contingency', projectId),
        listIndentsForProject('Equipment', projectId),
        listIndentsForProject('Consumable', projectId),
        listTravelRequestsForProject(projectId),
      ]);

      const contingencyList = contingencyRes.status === 'fulfilled' ? contingencyRes.value.map(i => ({ ...i, indentType: 'Contingency' })) : [];
      const equipmentList = equipmentRes.status === 'fulfilled' ? equipmentRes.value.map(i => ({ ...i, indentType: 'Equipment' })) : [];
      const consumableList = consumableRes.status === 'fulfilled' ? consumableRes.value.map(i => ({ ...i, indentType: 'Consumable' })) : [];
      const travelList = travelRes.status === 'fulfilled' ? travelRes.value.map(i => ({
        ...i,
        indentType: 'Travel',
        name: i.name || (i.place ? `Travel to ${i.place}${i.purpose ? ` (${i.purpose})` : ''}` : 'Travel Request'),
        estimatedCost: i.expectedCost || i.estimatedCost || 0,
        gemAvailability: 'N/A',
      })) : [];

      const combined = [...contingencyList, ...equipmentList, ...consumableList, ...travelList];

      // Fetch bill workflow status for each indent in parallel
      const withBillStatus = await Promise.all(
        combined.map(async (item) => {
          try {
            const billWf = await getWorkflowInstanceByRequest(item.indentType, item.id, 'Bill', { silent: true }).catch(() => null);
            return {
              ...item,
              billingStatus: billWf?.currentStage || (item.originalBillReference ? 'Submitted' : 'Not Processed'),
              assignedToUserId: billWf?.assignedToUserId || null,
              billWorkflow: billWf,
            };
          } catch {
            return {
              ...item,
              billingStatus: item.originalBillReference ? 'Submitted' : 'Not Processed',
              assignedToUserId: null,
              billWorkflow: null,
            };
          }
        })
      );

      // Sort by creation date descending
      withBillStatus.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIndents(withBillStatus);
    } catch (err) {
      console.error('Failed to load indents:', err);
      setError('Failed to fetch indents for the selected project.');
    } finally {
      setLoadingIndents(false);
    }
  };

  const handleOpenProcessBillPage = (item) => {
    if (item.currentStage !== 'Approved' && item.currentStage !== 'IndentApproved') {
      setError('Please first Approve the indent the bill process will be start');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check clerk assignment restrictions
    const userRoles = user?.roles || [];
    const isClerkOnly = userRoles.includes('RegularStaff') && !userRoles.some(r => ['Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin'].includes(r));
    const isAssignedToClerk = item.billingStatus === 'AssignedToDealingAssistant' || item.billingStatus === 'Assigned';

    if (isClerkOnly && isAssignedToClerk && item.assignedToUserId) {
      const currentUserId = user?.userId;
      if (currentUserId && item.assignedToUserId.toLowerCase() !== currentUserId.toLowerCase()) {
        setError('This bill is currently assigned to another clerk. Only the assigned clerk can view or process it.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (item.indentType === 'Travel') {
      navigate(`/travel-bill-form/${item.id}`);
    } else {
      navigate(`/process-bill/${item.indentType.toLowerCase()}/${item.id}`);
    }
  };

  const userRoles = user?.roles || [];
  const isClerkOnly = userRoles.includes('RegularStaff') && !userRoles.some(r => ['Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin'].includes(r));

  const filteredIndents = indents.filter((item) => {
    if (activeTab !== 'All' && item.indentType !== activeTab) return false;

    if (isClerkOnly && (item.billingStatus === 'AssignedToDealingAssistant' || item.billingStatus === 'Assigned') && item.assignedToUserId) {
      if (user?.userId && item.assignedToUserId.toLowerCase() !== user.userId.toLowerCase()) {
        return false;
      }
    }
    return true;
  });

  const getBadgeColor = (type) => {
    switch (type) {
      case 'Contingency':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      case 'Equipment':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'Consumable':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'Travel':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Process Bill Management</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Select department projects and process bills for Contingency, Equipment, Consumable, and Travel Indents.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold text-blue-700 dark:text-blue-300 shadow-2xs">
              Department Portal
            </span>
            <button
              onClick={loadProjects}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors active:scale-95"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Project Selector Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Select Department Project:
          </label>
          <div className="w-full md:w-2/3">
            {loadingProjects ? (
              <p className="text-sm text-slate-500">Loading department projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-amber-600 font-medium">No projects found for your account.</p>
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.projectTitle} (Sanction No: {proj.sanctionNo}) - {proj.agency}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Selected Project Overview Pill */}
        {selectedProject && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Sanction No</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProject.sanctionNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Funding Agency</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProject.agency}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Total Sanctioned</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                ₹{Number(selectedProject.totalSanctioned || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Project Duration</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedProject.durationMonths} Months ({selectedProject.startDate})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Indents List Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header Tabs */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-2">
            {['All', 'Contingency', 'Equipment', 'Consumable', 'Travel'].map((tab) => {
              const count = tab === 'All' ? indents.length : indents.filter((i) => i.indentType === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredIndents.length}</strong> matching indents
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loadingIndents ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading project indents...</div>
          ) : filteredIndents.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No indents found for the selected project filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-900/80 uppercase text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-5 text-left min-w-[220px]">Indent Name</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Category</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Item Type</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Est. Cost</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">GeM Status</th>
                  <th className="py-3.5 px-4 text-left whitespace-nowrap">Workflow Stage</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Billing Status</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Created Date</th>
                  <th className="py-3.5 px-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredIndents.map((item) => (
                  <tr 
                    key={`${item.indentType}-${item.id}`} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors duration-150"
                  >
                    <td className="py-4 px-5 text-left font-semibold text-slate-900 dark:text-slate-100 max-w-[280px]">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2" title={item.name}>
                        {item.name}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full border text-xs font-semibold whitespace-nowrap shadow-2xs ${getBadgeColor(item.indentType)}`}>
                        {item.indentType}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {getItemTypeBadge(item)}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap font-mono tracking-tight text-sm">
                      ₹{Number(item.estimatedCost || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium">
                      {item.gemAvailability === 'Yes' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Yes
                        </span>
                      ) : item.gemAvailability === 'No' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                          No
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">N/A</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-left whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span>{formatStageName(item.currentStage) || 'Draft'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {getBillingStatusBadge(item.billingStatus)}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-xs">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            if (item.indentType === 'Travel') {
                              navigate(`/travel/${item.id}`);
                            } else {
                              navigate(`/procurement/${item.indentType}/${item.id}`);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all active:scale-95 border border-slate-200 dark:border-slate-600 shadow-2xs"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleOpenProcessBillPage(item)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
                        >
                          Process Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}



