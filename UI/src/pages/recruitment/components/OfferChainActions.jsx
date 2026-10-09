import { useState } from 'react';
import { actionWorkflow } from '../../../api/workflowApi';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

/**
 * Drives the offer-letter approval chain -- the generic 7-stage
 * RequestType.ManpowerDocument office-escalation route (WorkflowDefinitionSeeder
 * .ShippedRoute), the SAME route ApproveMeritListAsync already raises an
 * instance of for the merit list. IssueOfferLetterAsync raises a *separate*
 * instance of this same route (tracked as RecruitmentRequest
 * .OfferWorkflowInstanceId, not WorkflowInstanceId) once the PI proposes an
 * offer; ReleaseOfferLetterAsync hard-gates on that instance reaching
 * WorkflowStage.Approved. Unlike the Advertisement chain (its own dedicated
 * 4-stage route with dedicated approveAdvertisement/rejectAdvertisement
 * /returnAdvertisement actions), this route has no recruitment-specific
 * action endpoints -- every action here goes through the generic
 * actionWorkflow(instanceId, action, payload) client, exactly as
 * IndentChainActions.jsx drives the same shipped route for indents.
 *
 * ShippedRoute stages or interest here:
 *   1 Raised            (raiser's own stage) -- Upload Signed Copy only.
 *     RaiseAsync does NOT authis stage; it sits at Raised until
 *     someone calls upload-signed-copy (WorkflowEngineService
 *     .UploadSignedCopyAsync), which for a non-Indent/non-Travel RequestType
 *     like ManpowerDocument advances straight to SignedCopyUploaded. Same
 *     escape IndentChainActions.jsx uses at its own Raised stage.
 *   2 SignedCopyUploaded HOD             -- Forward/Return
 *   3 Assigned           RegularStaff    -- Forward/Return
 *   4 Forwarded          Superintendent  -- Forward/Return
 *   5 ForwardedOSRC      DeputyRegistrar -- Forward only (CanReturn false)
 *   6 ForwardedDR        Dean,Director   -- Approve/Reject/Return (CanApprove)
 *   7 Director           Director        -- Approve/Reject/Return
 *
 * As with AdvertisementChainActions, every button here is always offered --
 * the backend's workflow engine (reading AllowedRoles on the current stage)
 * is the sole authority on who may act; `currentStage` only decides which
 * action verbs make sense to show at all. A 403 surfaces as a normal error
 * message rather than something this panel should have prevented.
 */
export default function OfferChainActions({ recruitmentRequestId, workflowInstance, onActed }) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const currentStage = workflowInstance?.currentStage ?? null;

  const run = async (action) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      setRemarks('');
      onActed?.();
    } catch (err) {
      // Also shown via the global toast (apiClient).
      setError(err?.message ?? 'The action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SignedCopyUploaded through Forwarded/ForwardedOSRC can Forward.
  // ForwardedDR and Director are excluded: both have CanApprove true, and
  // ForwardAsync always throws "nowhere to advance to" once the current
  // stage's CanApprove is true (it treats "next by sequence" as concluded,
  // not forwardable) -- Approve is the only way onward from there.
  const showUploadSignedCopy = currentStage === 'Raised';
  const FORWARD_STAGES = ['SignedCopyUploaded', 'Assigned', 'Forwarded', 'ForwardedOSRC'];
  const APPROVE_STAGES = ['ForwardedDR', 'Director'];
  const RETURN_STAGES = ['SignedCopyUploaded', 'Assigned', 'Forwarded', 'ForwardedDR', 'Director'];

  const showForward = FORWARD_STAGES.includes(currentStage);
  const showApproveReject = APPROVE_STAGES.includes(currentStage);
  const showReturn = RETURN_STAGES.includes(currentStage);

  const anyChainAction = showUploadSignedCopy || showForward || showApproveReject || showReturn;

  // Return requires a non-blank remark unconditionally
  // (WorkflowEngineService.ReturnAsync) -- gate the button here too so the
  // user sees why it's disabled instead of a failed request.
  const remarksBlank = !remarks.trim();

  // Approved and Rejected are terminal -- nothing to click in this panel for
  // those; show a short status line instead of an empty panel.
  const STATUS_MESSAGES = {
    Approved: 'This offer has been approved. It can now be released to the candidate.',
    Rejected: 'This offer was rejected.',
  };

  if (!workflowInstance) {
    return null;
  }

  if (!anyChainAction) {
    const message = currentStage ? STATUS_MESSAGES[currentStage] : null;
    return (
      <div className="space-y-2">
        {error && (
          <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
            {message}
          </div>
        )}
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

      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Remarks {showReturn && <span className="text-rose-600">*</span>}
        </label>
        <textarea
          rows="2"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={showReturn ? 'A remark is required to Return this offer' : 'Optional remarks travel with the action'}
          className={`${FIELD_CLASS} custom-scrollbar`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {showUploadSignedCopy && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'upload-signed-copy', { remarks: remarks || null }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Submit for Approval
          </button>
        )}
        {showApproveReject && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'approve', { remarks: remarks || null }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Approve
          </button>
        )}
        {showForward && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'forward', { remarks: remarks || null }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Forward
          </button>
        )}
        {showReturn && (
          <button type="button" disabled={isSubmitting || remarksBlank}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'return', { remarks }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Return
          </button>
        )}
        {showApproveReject && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => actionWorkflow(workflowInstance.id, 'reject', { remarks: remarks || null }))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
