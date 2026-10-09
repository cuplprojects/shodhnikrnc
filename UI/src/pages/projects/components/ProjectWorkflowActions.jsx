import { useState, useEffect } from 'react';
import { getWorkflowInstance } from '../../../api/workflowApi';
import { getStageDisplayLabel } from '../../../constants/workflowDefinitionEnums';
import { useAuth } from '../../../auth/useAuth';
import {
  submitProject,
  forwardProject,
  approveProject,
  rejectProject,
  returnProject
} from '../../../api/projectsApi';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Clock,
  UserCheck,
  FileText,
  AlertCircle
} from 'lucide-react';

const formatStepDate = (step) => {
  const val = step.timestamp || step.performedAt || step.createdAt;
  if (!val) return '—';
  const date = new Date(val);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

export default function ProjectWorkflowActions({ project, onActed }) {
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];
  const currentUserId = (user?.userId || user?.id || '').toLowerCase();

  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState(null);

  const loadWorkflow = async () => {
    if (!project?.workflowInstanceId) return;
    setIsLoading(true);
    try {
      const data = await getWorkflowInstance(project.workflowInstanceId);
      setWorkflowInstance(data);
    } catch (err) {
      console.error('Failed to load project workflow instance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, [project?.workflowInstanceId]);

  if (!project) return null;

  const actualOwnerId = (project.ownerUserId || project.piUserId || '').toLowerCase();
  const isOwner = Boolean(currentUserId) && Boolean(actualOwnerId) && currentUserId === actualOwnerId;

  const hasRole = (roleList) =>
    roleList.some((r) => userRoles.map((ur) => String(ur).toLowerCase()).includes(r.toLowerCase()));

  const currentStage = workflowInstance?.currentStage || project.status;
  const isDeanStage = currentStage === 'WithDean' || currentStage === 'Director' || currentStage === 'ForwardedDR' || currentStage === 'IndentWithDean';
  const isBudgetExceeded = project.totalSanctioned < project.totalAmount;
  const isApprovedOrActive = project.status === 'Approved' || project.status === 'Active' || project.status === 'Rejected';
  const isDraftOrRevision = project.status === 'Draft' || project.status === 'PendingRevision' || currentStage === 'Draft' || currentStage === 'ReturnedToPI' || currentStage === 'ReturnedByHODToPI' || currentStage === 'ReturnedByDeanToPI';

  // Role authorization check per stage
  const isAllowedForCurrentStage = (() => {
    if (isApprovedOrActive) return false;
    if (isDraftOrRevision) return isOwner || hasRole(['Faculty', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithHOD' || currentStage === 'SignedCopyUploaded') return hasRole(['HOD', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithRnCOffice' || currentStage === 'Assigned' || currentStage === 'AssignedToDealingAssistant' || currentStage === 'IndentWithRnCOffice')
      return hasRole(['RegularStaff', 'Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin']);
    if (currentStage === 'Forwarded' || currentStage === 'WithSuperintendent') return hasRole(['Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin']);
    if (currentStage === 'ForwardedOSRC' || currentStage === 'WithDeputyRegistrar') return hasRole(['DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin']);
    if (isDeanStage) return hasRole(['Dean', 'Director', 'SuperAdmin', 'Admin']);

    if (project.status === 'UnderApproval') {
      return hasRole(['HOD', 'RegularStaff', 'Superintendent', 'DeputyRegistrar', 'Dean', 'Director', 'SuperAdmin', 'Admin']);
    }
    return false;
  })();

  const showAvailableActions = isAllowedForCurrentStage;

  const handleAction = async (actionFn, actionName) => {
    if (!remarks.trim()) {
      setError(`Remarks are mandatory to ${actionName.toLowerCase()} the project update.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await actionFn(project.id, remarks.trim());
      setRemarks('');
      await loadWorkflow();
      onActed?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to ${actionName.toLowerCase()} project.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="text-violet-600 dark:text-violet-400" size={20} />
            Project Approval &amp; Workflow Status
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track approval workflow progress or take required action.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
            project.status === 'Approved' || project.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
              : project.status === 'PendingRevision'
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            Status: {project.status}
          </span>
          {workflowInstance?.currentStage && (
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
              Stage: {getStageDisplayLabel(workflowInstance.currentStage)}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Info notice when forwarded to next stage */}
      {!showAvailableActions && project.status === 'UnderApproval' && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Project has been forwarded and is currently under approval at <strong>Stage: {getStageDisplayLabel(currentStage)}</strong>.
          </span>
        </div>
      )}

      {/* Available Action Form */}
      {showAvailableActions && (
        <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Available Actions
          </h3>

          {isBudgetExceeded ? (
            <div className="p-3.5 rounded-lg bg-rose-100/70 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-semibold">
              Cannot submit or forward for approval while total budget from heads exceeds Total Sanctioned. Please edit the project budget heads to align with sanctioned amount.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Action Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="Enter mandatory remarks for this action..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Submit button for PI when in PendingRevision / Draft */}
                {(project.status === 'PendingRevision' || project.status === 'Draft' || (!isApprovedOrActive && !project.workflowInstanceId)) && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(submitProject, 'Submit')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} /> Submit for Approval
                  </button>
                )}

                {/* Forward button (intermediate stages) */}
                {project.status === 'UnderApproval' && !isDeanStage && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(forwardProject, 'Forward')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} /> Forward (with Remark)
                  </button>
                )}

                {/* Approve button (Dean) */}
                {isDeanStage && project.status === 'UnderApproval' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(approveProject, 'Approve')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve Project
                  </button>
                )}

                {/* Return button */}
                {project.status === 'UnderApproval' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(returnProject, 'Return')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Return to PI
                  </button>
                )}

                {/* Reject button (Dean) */}
                {isDeanStage && project.status === 'UnderApproval' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAction(rejectProject, 'Reject')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workflow Step History Timeline */}
      {workflowInstance?.steps?.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Approval History Log
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {workflowInstance.steps.map((step, idx) => (
              <div key={idx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck size={14} className="text-violet-500" />
                    <span>Stage: {getStageDisplayLabel(step.stage)}</span>
                    <span className="text-[10px] text-slate-400">({step.action})</span>
                  </div>
                  {step.remarks && (
                    <p className="text-slate-600 dark:text-slate-300 italic pl-5">
                      &quot;{step.remarks}&quot;
                    </p>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock size={12} />
                  <span>{formatStepDate(step)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
