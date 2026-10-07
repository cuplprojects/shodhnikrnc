import { useState, useEffect } from 'react';
import { actionWorkflow, listDealingAssistantOptions } from '../../../api/workflowApi';
import { useAuth } from '../../../auth/useAuth';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

export default function TravelChainActions({ travelRequestId, workflowInstance, onActed }) {
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];
  const currentUserId = user?.userId;

  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');

  useEffect(() => {
    let ignore = false;
    listDealingAssistantOptions()
      .then((options) => { if (!ignore) setAssigneeOptions(options ?? []); })
      .catch(() => { if (!ignore) setAssigneeOptions([]); });
    return () => { ignore = true; };
  }, []);

  const currentStage = workflowInstance?.currentStage ?? null;
  const assignedToUserId = workflowInstance?.assignedToUserId ?? null;

  const run = async (actionFn) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await actionFn();
      setRemarks('');
      onActed?.();
    } catch (err) {
      setError(err?.message ?? 'The action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRole = (roleList) =>
    roleList.some((r) => userRoles.map((ur) => String(ur).toLowerCase()).includes(r.toLowerCase()));

  const isUserAssignedOrHasExemptRole = () => {
    if (hasRole(['Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin'])) return true;
    if (hasRole(['RegularStaff', 'Faculty'])) return !assignedToUserId || assignedToUserId === currentUserId;
    return false;
  };

  const isAllowedForCurrentStage = (() => {
    if (currentStage === 'Raised') return hasRole(['Faculty', 'PI', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithPITravel') return hasRole(['Faculty', 'PI', 'SuperAdmin', 'Admin']);
    if (currentStage === 'SignedCopyUploaded') return hasRole(['HOD', 'HeadOfDepartment', 'SuperAdmin', 'Admin']);
    if (currentStage === 'Assigned') return hasRole(['RegularStaff', 'Clerk', 'SuperAdmin', 'Admin']) && isUserAssignedOrHasExemptRole();
    if (currentStage === 'Forwarded') return hasRole(['Superintendent', 'SuperAdmin', 'Admin']);
    if (currentStage === 'ForwardedOSRC') return hasRole(['DeputyRegistrar', 'SuperAdmin', 'Admin']);
    if (currentStage === 'ForwardedDR') return hasRole(['Dean', 'Director', 'SuperAdmin', 'Admin']);
    if (currentStage === 'Director') return hasRole(['Director', 'SuperAdmin', 'Admin']);
    return false;
  })();

  const activeSteps = (workflowInstance?.steps || []).filter((s) => !s.isUndone);
  const lastStep = activeSteps.length > 0 ? activeSteps[activeSteps.length - 1] : null;
  const canUndo = Boolean(lastStep) && Boolean(currentUserId) && lastStep.actorUserId === currentUserId;

  const showSealAndUpload = isAllowedForCurrentStage && currentStage === 'Raised';
  const showPITravelActions = isAllowedForCurrentStage && currentStage === 'WithPITravel';
  const showHODActions = isAllowedForCurrentStage && currentStage === 'SignedCopyUploaded';
  const showClerkAssign = isAllowedForCurrentStage && currentStage === 'Assigned';
  const showSuperintendentActions = isAllowedForCurrentStage && currentStage === 'Forwarded';
  const showDRForward = isAllowedForCurrentStage && currentStage === 'ForwardedOSRC';
  const showDeanDecision = isAllowedForCurrentStage && currentStage === 'ForwardedDR';
  const showDirectorDecision = isAllowedForCurrentStage && currentStage === 'Director';

  const anyChainAction = showSealAndUpload || showPITravelActions || showHODActions || showClerkAssign || showSuperintendentActions || showDRForward || showDeanDecision || showDirectorDecision;

  // Forward and Return both require a non-blank remark server-side
  // (WorkflowEngineService.ForwardAsync/ReturnAsync) when the actor is at a
  // PI-owned stage (empty AllowedRoles -- here, WithPITravel) or holds the
  // HOD role for Forward, and unconditionally for Return. Gate the buttons
  // here too so the user sees why the action is blocked instead of a failed
  // request. A Return button is offered at every stage except Raised and
  // Assigned, so the shared remarks box is effectively required whenever
  // one of those stages' actions are shown.
  const remarksBlank = !remarks.trim();
  const forwardRequiresRemark = hasRole(['Faculty', 'PI', 'HOD']);
  const returnOffered = showPITravelActions || showHODActions || showClerkAssign
    || showSuperintendentActions || showDRForward || showDeanDecision || showDirectorDecision;
  const remarkPossiblyRequired = forwardRequiresRemark || returnOffered;

  const STAGE_LABELS = {
    Raised: 'Travel Request Raised — Awaiting Signed Copy Upload',
    WithPITravel: 'PI Review — Fellow Travel Request',
    SignedCopyUploaded: 'HOD Review',
    Assigned: 'R&C Office (Clerk)',
    Forwarded: 'Superintendent',
    ForwardedOSRC: 'Deputy Registrar',
    ForwardedDR: 'Dean Decision',
    Director: 'Director Approval',
    IndentApproved: 'Approved',
    Approved: 'Approved',
    Rejected: 'Rejected',
    Cancelled: 'Cancelled',
  };

  const undoButton = canUndo && (
    <button
      type="button"
      onClick={() => run(() => actionWorkflow(workflowInstance.id, 'undo'))}
      disabled={isSubmitting}
      title={`Undo action by ${lastStep?.actorName || 'Unknown'}`}
      className="text-xs px-3 py-1.5 border border-rose-300 dark:border-rose-700/60 text-rose-600 dark:text-rose-400 font-semibold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
    >
      ↶ Undo
    </button>
  );

  if (!workflowInstance) return null;

  if (!anyChainAction) {
    const stageName = currentStage ? (STAGE_LABELS[currentStage] || currentStage) : '';
    return (
      <div className="space-y-3">
        {error && (
          <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between gap-4">
          <div>
            <span>Currently under approval / action at: <strong>{stageName}</strong></span>
            {currentStage && (
              <div className="text-xs text-slate-500 mt-1">
                User roles: {userRoles.join(', ')} | Allowed: {isAllowedForCurrentStage ? 'Yes' : 'No'}
              </div>
            )}
          </div>
          {undoButton}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
          Workflow Actions
        </h3>
        {undoButton}
      </div>
      
      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 flex items-start gap-3">
            <span className="shrink-0 text-red-500">⚠</span>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              Action Remarks {remarkPossiblyRequired && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              rows="3"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={remarkPossiblyRequired ? 'A remark is required for this action' : 'Add optional remarks for the next reviewer...'}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm resize-none custom-scrollbar shadow-inner"
            />
          </div>

          {(showClerkAssign || showSuperintendentActions) && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                Assign to Staff Member (Optional)
              </label>
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm shadow-inner"
              >
                <option value="">Select Staff Member to Assign...</option>
                {assigneeOptions.map((o) => (
                  <option key={o.userId} value={o.userId}>
                    {o.fullName} ({o.userName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

      <div className="flex flex-wrap gap-2">
        {showSealAndUpload && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'upload-signed-copy', { remarks: remarks || null }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Seal & Upload Signed Copy
          </button>
        )}

        {showPITravelActions && (
          <>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Forward to HOD
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return to Fellow
            </button>
          </>
        )}

        {showHODActions && (
          <>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Forward to R&C Office
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
          </>
        )}

        {showClerkAssign && (
          <>
            <button type="button" disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'assign', { assigneeUserId: selectedAssigneeId, remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Assign
            </button>
            <button type="button" disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'assign-and-forward', { assigneeUserId: selectedAssigneeId, remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Assign &amp; Forward
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Forward
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
          </>
        )}

        {showSuperintendentActions && (
          <>
            <button type="button" disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'assign', { assigneeUserId: selectedAssigneeId, remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Assign
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Forward to Deputy Registrar
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
          </>
        )}

        {showDRForward && (
          <>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Forward to Dean
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
          </>
        )}

        {showDeanDecision && (
          <>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'approve', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Approve
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward-', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Forward to Director
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'reject', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Reject
            </button>
          </>
        )}

        {showDirectorDecision && (
          <>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'approve', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Approve
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'reject', { remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Reject
            </button>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
