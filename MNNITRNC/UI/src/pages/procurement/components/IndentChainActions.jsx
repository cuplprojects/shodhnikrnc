import { useState, useEffect } from 'react';
import {
  forwardIndent, forwardIndentToDirector, approveIndent, rejectIndent, returnIndent,
  getMarketCommitteeSteps, recordMarketCommitteeStep,
} from '../../../api/procurementApi';
import { actionWorkflow, listDealingAssistantOptions } from '../../../api/workflowApi';
import { useAuth } from '../../../auth/useAuth';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

/**
 * Every action button here is always offered -- the frontend does not
 * decide "only HOD can act at SignedCopyUploaded" or "only Superintendent
 * may forward from Forwarded"; the backend's workflow engine (reading the
 * roles configured on the current stage) is the sole authority. A 403 from
 * any of these calls surfaces as a normal error message rather than
 * something this panel should have prevented by hiding the button.
 *
 * `currentStage` only decides which action verbs make sense to offer at all
 * -- that is a UX simplification, not an authorization decision.
 */

// Helper: BRD A7.1 & A7.2 approval-band lookup, moved here from
// IndentApprovalPage.jsx -- it is now purely internal to deciding what the
// ForwardedDR-stage button does, not something the queue page needs anymore.
function getApprovalBandInfo(gemAvailability, estimatedCost) {
  const isGem = gemAvailability === 'Yes';

  if (isGem) {
    if (estimatedCost <= 50000) {
      return {
        band: 'GeM Direct Purchase (≤ ₹50,000) — Signed by Dean',
        description: 'Direct purchase permitted without quotation, subject to indent approval by Dean (R&C).',
        authority: 'Dean (R&C)',
        biddingRequired: false,
        committeeRequired: false,
      };
    } else if (estimatedCost <= 100000) {
      return {
        band: 'GeM Bidding Process (₹50k - ₹1 Lakh) — Signed by Dean',
        description: 'Order value exceeds ₹50,000. Undergoes GeM bidding process; signed & approved by Dean (R&C).',
        authority: 'Dean (R&C)',
        biddingRequired: true,
        committeeRequired: false,
      };
    } else {
      return {
        band: 'GeM Bidding Process (> ₹1 Lakh) — Signed by Director',
        description: 'Order value exceeds ₹1 Lakh. Undergoes GeM bidding process; signed & approved by Director.',
        authority: 'Director',
        biddingRequired: true,
        committeeRequired: false,
      };
    }
  } else {
    if (estimatedCost <= 100000) {
      return {
        band: 'Non-GeM 1st Indent (≤ ₹1 Lakh) — Signed by Dean',
        description: '1st Indent up to ₹2 Lakh split band. Up to ₹1 Lakh signed and approved by Dean.',
        authority: 'Dean (R&C)',
        biddingRequired: false,
        committeeRequired: false,
      };
    } else if (estimatedCost <= 200000) {
      return {
        band: 'Non-GeM 1st Indent (₹1 Lakh - ₹2 Lakh) — Signed by Director',
        description: '1st Indent split band (> ₹1 Lakh to ₹2 Lakh). Signed and approved by Director.',
        authority: 'Director',
        biddingRequired: false,
        committeeRequired: false,
      };
    } else {
      return {
        band: 'Non-GeM 2nd Indent (₹2 Lakh - ₹25 Lakh) — Market Committee',
        description: '2nd Indent (₹2L - ₹25L). Market committee formed, notice issued, comparative statement signed, PO issued. Binding: Prayagraj.',
        authority: 'Non-GeM Market Committee & Director',
        biddingRequired: false,
        committeeRequired: true,
      };
    }
  }
}

export default function IndentChainActions({ indentType, indentId, workflowInstance, indent, onActed }) {
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];
  const currentUserId = user?.userId;  // ← Changed from user?.id to user?.userId

  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [marketCommitteeSteps, setMarketCommitteeSteps] = useState(null);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [stepError, setStepError] = useState(null);
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

  const band = (currentStage === 'IndentWithDean' || currentStage === 'ForwardedDR') && indent
    ? getApprovalBandInfo(indent.gemAvailability, indent.estimatedCost)
    : null;

  // Fetch Market Committee steps when in IndentWithDean/ForwardedDR with committeeRequired band
  useEffect(() => {
    const fetchSteps = async () => {
      if ((currentStage === 'IndentWithDean' || currentStage === 'ForwardedDR') && band?.committeeRequired) {
        setIsLoadingSteps(true);
        setStepError(null);
        try {
          const data = await getMarketCommitteeSteps(indentType, indentId);
          setMarketCommitteeSteps(data);
        } catch (err) {
          setStepError(err?.message ?? 'Failed to load Market Committee steps.');
        } finally {
          setIsLoadingSteps(false);
        }
      }
    };

    fetchSteps();
  }, [currentStage, band?.committeeRequired, indentType, indentId]);

  const recordStep = async (step, recordedOn) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStepError(null);
    try {
      await recordMarketCommitteeStep(indentType, indentId, step, recordedOn);
      // Refetch steps to update UI after successful recording
      const data = await getMarketCommitteeSteps(indentType, indentId);
      setMarketCommitteeSteps(data);
    } catch (err) {
      setStepError(err?.message ?? 'Failed to record Market Committee step.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const run = async (action) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      setRemarks('');
      onActed?.();
    } catch (err) {
      // Error is also shown via the global toast notification (apiClient).
      setError(err?.message ?? 'The action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRole = (roleList) =>
    roleList.some((r) => userRoles.map((ur) => String(ur).toLowerCase()).includes(r.toLowerCase()));

  const isUserAssignedOrHasExemptRole = () => {
    // Stages narrowed by assignment only narrow RegularStaff; these roles can always act:
    if (hasRole(['Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin'])) {
      return true;
    }
    // For RegularStaff, check if this user is the assigned person
    if (hasRole(['RegularStaff', 'Faculty'])) {
      return !assignedToUserId || assignedToUserId === currentUserId;
    }
    return false;
  };

  const isAllowedForCurrentStage = (() => {
    // New indent-specific stages
    if (currentStage === 'IndentRaised') return hasRole(['Faculty', 'PI', 'SuperAdmin', 'Admin']);
    if (currentStage === 'Raised') return hasRole(['Faculty', 'PI', 'SuperAdmin', 'Admin']);  // Legacy
    if (currentStage === 'SignedCopyUploaded') return hasRole(['Faculty', 'PI', 'SuperAdmin', 'Admin']);
    if (currentStage === 'IndentWithHOD') return hasRole(['HOD', 'SuperAdmin', 'Admin']);
    if (currentStage === 'IndentWithRnCOffice') return hasRole(['RegularStaff', 'Clerk', 'SuperAdmin', 'Admin']);
    if (currentStage === 'IndentAssignedToDA') return isUserAssignedOrHasExemptRole();
    if (currentStage === 'IndentWithSuperintendent') return hasRole(['Superintendent', 'SuperAdmin', 'Admin']);
    if (currentStage === 'IndentWithDeputyRegistrar') return hasRole(['DeputyRegistrar', 'SuperAdmin', 'Admin']);
    if (currentStage === 'IndentWithDean') return hasRole(['Dean', 'SuperAdmin', 'Admin']);
    if (currentStage === 'Director') return hasRole(['Director', 'SuperAdmin', 'Admin']);
    
    // Legacy generic stages for backward compatibility
    if (currentStage === 'Assigned') return hasRole(['RegularStaff', 'Clerk', 'SuperAdmin', 'Admin']);
    if (currentStage === 'Forwarded') return hasRole(['Superintendent', 'RegularStaff', 'Clerk', 'SuperAdmin', 'Admin']);
    if (currentStage === 'ForwardedOSRC') return hasRole(['DeputyRegistrar', 'Superintendent', 'RegularStaff', 'Clerk', 'SuperAdmin', 'Admin']);
    if (currentStage === 'ForwardedDR') return hasRole(['Dean', 'Director', 'DeputyRegistrar', 'SuperAdmin', 'Admin']);
    
    return false;
  })();

  const activeSteps = (workflowInstance?.steps || []).filter((s) => !s.isUndone);
  const lastStep = activeSteps.length > 0 ? activeSteps[activeSteps.length - 1] : null;
  const canUndo = Boolean(lastStep) && Boolean(currentUserId) && lastStep.actorUserId === currentUserId;

  const showSealAndUpload = isAllowedForCurrentStage && currentStage === 'Raised';
  const showHODActions = isAllowedForCurrentStage && currentStage === 'IndentWithHOD';
  const showClerkAssign = isAllowedForCurrentStage && (currentStage === 'IndentWithRnCOffice' || currentStage === 'Assigned');
  const showAssignedStaffForward = isAllowedForCurrentStage && currentStage === 'IndentAssignedToDA';
  const showSuperintendentActions = isAllowedForCurrentStage && (currentStage === 'IndentWithSuperintendent' || (currentStage === 'Forwarded' && hasRole(['Superintendent'])));
  const showDRForward = isAllowedForCurrentStage && (currentStage === 'IndentWithDeputyRegistrar' || currentStage === 'ForwardedOSRC');
  const showDeanDecision = isAllowedForCurrentStage && (currentStage === 'IndentWithDean' || currentStage === 'ForwardedDR');
  const showDirectorDecision = isAllowedForCurrentStage && currentStage === 'Director';

  const anyChainAction = showSealAndUpload || showHODActions || showClerkAssign || showAssignedStaffForward || showSuperintendentActions || showDRForward || showDeanDecision || showDirectorDecision;

  // Forward and Return both require a non-blank remark server-side
  // (WorkflowEngineService.ForwardAsync/ReturnAsync) when the actor is at a
  // PI-owned stage (empty AllowedRoles) or holds the HOD role for Forward,
  // and unconditionally for Return. Gate the buttons here too so the user
  // sees why the action is blocked instead of a failed request. A Return
  // button is offered at every stage except Raised (Seal & Upload) and the
  // assign-only paths, so the shared remarks box is effectively required
  // whenever one of those stages' actions are shown.
  const remarksBlank = !remarks.trim();
  const forwardRequiresRemark = hasRole(['Faculty', 'PI', 'HOD']);
  const returnOffered = showHODActions || showClerkAssign || showAssignedStaffForward
    || showSuperintendentActions || showDRForward || showDeanDecision || showDirectorDecision;
  const remarkPossiblyRequired = forwardRequiresRemark || returnOffered;

  const STAGE_LABELS = {
    Raised: 'Indent Raised by Faculty',
    SignedCopyUploaded: 'Signed Copy Uploaded',
    IndentWithHOD: 'HOD Review',
    IndentWithRnCOffice: 'R&C Office (Clerk)',
    IndentAssignedToDA: 'Assigned Staff',
    IndentWithSuperintendent: 'Superintendent',
    IndentWithDeputyRegistrar: 'Deputy Registrar',
    ForwardedOSRC: 'Deputy Registrar', // Old stage name for backward compatibility
    IndentWithDean: 'Dean Decision',
    ForwardedDR: 'Dean Decision', // Old stage name for backward compatibility
    Director: 'Director Approval',
    IndentApproved: 'Approved',
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

  if (!workflowInstance) {
    return null;
  }

  if (!anyChainAction) {
    const stageName = currentStage ? (STAGE_LABELS[currentStage] || currentStage) : '';
    console.log('=== NO BUTTONS SHOWN ===', {
      currentStage,
      stageName,
      isAllowedForCurrentStage,
      showSealAndUpload,
      showHODActions,
      showClerkAssign,
      showAssignedStaffForward,
      showSuperintendentActions,
      showDRForward,
      showDeanDecision,
      showDirectorDecision,
      anyChainAction,
      assignedToUserId,
      currentUserId,
      userRoles,
    });
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
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {undoButton && (
        <div className="mb-2">
          {undoButton}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Remarks {remarkPossiblyRequired && <span className="text-rose-600">*</span>}
        </label>
        <textarea
          rows="2"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={remarkPossiblyRequired ? 'A remark is required for this action' : 'Optional remarks travel with the action'}
          className={`${FIELD_CLASS} custom-scrollbar`}
        />
      </div>

      {showClerkAssign && (
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Assign to Staff Member (optional)
          </label>
          <select
            value={selectedAssigneeId}
            onChange={(e) => setSelectedAssigneeId(e.target.value)}
            className={`${FIELD_CLASS} w-full `}
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

      {showSuperintendentActions && (
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Assign to Staff Member (optional)
          </label>
          <select
            value={selectedAssigneeId}
            onChange={(e) => setSelectedAssigneeId(e.target.value)}
            className={`${FIELD_CLASS} w-full `}
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

      {showDeanDecision && band && (
        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <span className="font-semibold">Approval band:</span> {band.band}
        </div>
      )}

      {/* Market Committee steps recording form */}
      {showDeanDecision && band?.committeeRequired && (
        <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-4 py-3">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Market Committee Steps
          </div>

          {stepError && (
            <div className="p-2 rounded border border-red-300 bg-red-50 text-xs font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
              {stepError}
            </div>
          )}

          {isLoadingSteps ? (
            <div className="text-xs text-slate-600 dark:text-slate-400">Loading steps...</div>
          ) : marketCommitteeSteps ? (
            <div className="space-y-2">
              {/* Committee Formed */}
              <div className="flex items-center gap-2">
                <label className="flex-1 text-xs text-slate-600 dark:text-slate-400">
                  Committee Formed
                </label>
                <input
                  type="date"
                  value={marketCommitteeSteps.committeeFormedOn || ''}
                  onChange={(e) => { if (!e.target.value) return; recordStep('CommitteeFormed', e.target.value); }}
                  disabled={isSubmitting}
                  className={`${FIELD_CLASS} flex-1 text-xs py-1`}
                />
                {marketCommitteeSteps.committeeFormedOn && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
                )}
              </div>

              {/* Notice Issued */}
              <div className="flex items-center gap-2">
                <label className="flex-1 text-xs text-slate-600 dark:text-slate-400">
                  Notice Issued
                </label>
                <input
                  type="date"
                  value={marketCommitteeSteps.noticeIssuedOn || ''}
                  onChange={(e) => { if (!e.target.value) return; recordStep('NoticeIssued', e.target.value); }}
                  disabled={isSubmitting}
                  className={`${FIELD_CLASS} flex-1 text-xs py-1`}
                />
                {marketCommitteeSteps.noticeIssuedOn && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
                )}
              </div>

              {/* Comparative Statement Signed */}
              <div className="flex items-center gap-2">
                <label className="flex-1 text-xs text-slate-600 dark:text-slate-400">
                  Comparative Statement Signed
                </label>
                <input
                  type="date"
                  value={marketCommitteeSteps.comparativeStatementSignedOn || ''}
                  onChange={(e) => { if (!e.target.value) return; recordStep('ComparativeStatementSigned', e.target.value); }}
                  disabled={isSubmitting}
                  className={`${FIELD_CLASS} flex-1 text-xs py-1`}
                />
                {marketCommitteeSteps.comparativeStatementSignedOn && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
                )}
              </div>

              {!marketCommitteeSteps.isComplete && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  All three Market Committee steps must be recorded before this can be forwarded to Director.
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-600 dark:text-slate-400">No steps recorded yet.</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {showSealAndUpload && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'upload-signed-copy', { remarks: remarks || null }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Seal & Upload Signed Copy
          </button>
        )}

        {showHODActions && (
          <>
            <button
              type="button"
              disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => forwardIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Forward to R&C Office
            </button>

            <button
              type="button"
              disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Return
            </button>
          </>
        )}

        {showClerkAssign && (
          <>
            <button
              type="button"
              disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'assign', { assigneeUserId: selectedAssigneeId, remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Assign
            </button>

            <button
              type="button"
              disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'assign-and-forward', { assigneeUserId: selectedAssigneeId, remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Assign &amp; Forward
            </button>

            <button
              type="button"
              disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Return
            </button>
          </>
        )}

        {showAssignedStaffForward && (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => run(() => forwardIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Forward
            </button>

            <button
              type="button"
              disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Return
            </button>
          </>
        )}

        {showSuperintendentActions && (
          <>
            <button
              type="button"
              disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => actionWorkflow(workflowInstance.id, 'assign', { assigneeUserId: selectedAssigneeId, remarks: remarks || null }))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Assign
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => run(() => forwardIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Forward to Deputy Registrar
            </button>

            <button
              type="button"
              disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Return
            </button>
          </>
        )}

        {showDRForward && (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => run(() => forwardIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Forward to Dean
            </button>

            <button
              type="button"
              disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Return
            </button>
          </>
        )}

        {showDeanDecision && band?.authority === 'Dean (R&C)' && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => approveIndent(indentType, indentId, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Approve (≤ ₹1 Lakh)
          </button>
        )}

        {showDeanDecision && band?.authority === 'Director' && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => forwardIndentToDirector(indentType, indentId, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Forward to Director (&gt; ₹1 Lakh)
          </button>
        )}

        {showDeanDecision && band?.committeeRequired && (
          <button type="button"
            onClick={() => run(() => forwardIndentToDirector(indentType, indentId, remarks))}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${
              marketCommitteeSteps?.isComplete
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
            }`}
            disabled={!marketCommitteeSteps?.isComplete || isSubmitting}>
            Forward to Director (Market Committee)
          </button>
        )}

        {showDeanDecision && (
          <>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => rejectIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Reject
            </button>
          </>
        )}

        {showDirectorDecision && (
          <>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => approveIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Approve
            </button>
            <button type="button" disabled={isSubmitting || remarksBlank}
              onClick={() => run(() => returnIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Return
            </button>
            <button type="button" disabled={isSubmitting}
              onClick={() => run(() => rejectIndent(indentType, indentId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
