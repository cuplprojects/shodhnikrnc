import { useState } from 'react';
import { approveAdvertisement, rejectAdvertisement, returnAdvertisement } from '../../../api/recruitmentApi';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

/**
 * Every action button here is always offered -- the frontend does not decide
 * "only RnC office can act at WithRnCOfficeAdvertisement" or "only Computer
 * Centre may approve the final stage"; the backend's workflow engine (reading
 * the roles configured on the current stage) is the sole authority. A 403
 * from any of these calls surfaces as a normal error message rather than
 * something this panel should have prevented by hiding the button.
 *
 * `currentStage` only decides which action verbs make sense to offer at all
 * (e.g. no buttons once the instance is back with the PI, or once it has
 * reached a terminal stage) -- that is a UX simplification, not an
 * authorization decision.
 */
export default function AdvertisementChainActions({ recruitmentRequestId, workflowInstance, onActed }) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStage = workflowInstance?.currentStage ?? null;

  const run = async (action) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await action();
      setRemarks('');
      onActed?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  // RnC office may Approve, Reject, or Return at WithRnCOfficeAdvertisement --
  // see AdvertisementWorkflowSeeder.Route, sequence 2.
  const showRnCOfficeActions = currentStage === 'WithRnCOfficeAdvertisement';
  // Computer Centre may only Approve -- sequence 3, CanReject/CanReturn false.
  // Its approve is the one RecruitmentService.ApproveAdvertisementAsync reads
  // back as Approved to flip RecruitmentRequest.Stage to Advertised.
  const showComputerCentreApprove = currentStage === 'WithComputerCentre';

  const anyChainAction = showRnCOfficeActions || showComputerCentreApprove;

  // WithPIAdvertisement (freshly raised, about to au) and
  // ReturnedToPIAdvertisement (sent back for correction) are both PI-actionable
  // states, but the PI acts by reopening GenerateAdvertisementModal and
  // resubmitting -- not through a button in this panel. Approved/Rejected are
  // terminal. In every one of these cases there is nothing to click here, so
  // show a short status line instead of leaving the panel visually empty with
  // no explanation.
  const STATUS_MESSAGES = {
    WithPIAdvertisement: 'Submitted for R&C Office approval.',
    ReturnedToPIAdvertisement: 'Returned to the PI for correction. Reopen "Generate Advertisement" to edit and resubmit.',
    Approved: 'This advertisement has been approved and is now live.',
    Rejected: 'This advertisement has been rejected.',
  };

  if (!workflowInstance) {
    return null;
  }

  if (!anyChainAction) {
    const message = currentStage ? STATUS_MESSAGES[currentStage] : null;
    if (!message) return null;
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-3">

      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
        <textarea
          rows="2"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional remarks travel with the action"
          className={`${FIELD_CLASS} custom-scrollbar`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(showRnCOfficeActions || showComputerCentreApprove) && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => approveAdvertisement(recruitmentRequestId, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            {showComputerCentreApprove ? 'Publish' : 'Approve'}
          </button>
        )}
        {showRnCOfficeActions && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => returnAdvertisement(recruitmentRequestId, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Return to PI
          </button>
        )}
        {showRnCOfficeActions && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => rejectAdvertisement(recruitmentRequestId, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
