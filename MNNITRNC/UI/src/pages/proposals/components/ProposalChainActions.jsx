import { useEffect, useState } from 'react';
import {
  forwardProposal, rejectProposal, returnProposal, approveProposal, submitProposal, withdrawProposal,
  listDealingAssistantOptions, assignToDealingAssistant, undoLastProposalAction,
} from '../../../api/proposalsApi';
import { useAuth } from '../../../auth/useAuth';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

/**
 * The chain-action panel shown on the proposal detail page.
 *
 * Action buttons are scoped by stage and role according to the workflow specification:
 * - Only proposal owner (PI) can withdraw.
 * - HOD stage: Forward only (HOD role).
 * - Office / Dealing Assistant stage: Forward (+ Assign dropdown) (Office roles).
 * - Superintendent stage: Forward, Return to PI, Reject (Superintendent role).
 * - Deputy Registrar stage: Forward, Return to PI, Reject (Deputy Registrar role).
 * - Dean stage: Approve, Return to PI, Reject (Dean / Director role).
 */
export default function ProposalChainActions({ proposal, onActed, currentUserId, lastStepActorUserId }) {
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];

  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');

  const { id, status, currentStage, ownerUserId, piUserId } = proposal;
  const isUnderApprovalAtOffice = status === 'UnderApproval' && currentStage === 'WithRnCOffice';

  // Fetched only at the one stage the dropdown can appear
  useEffect(() => {
    if (!isUnderApprovalAtOffice) return;
    let ignore = false;
    listDealingAssistantOptions()
      .then((options) => { if (!ignore) setAssigneeOptions(options ?? []); })
      .catch(() => { if (!ignore) setAssigneeOptions([]); });
    return () => { ignore = true; };
  }, [isUnderApprovalAtOffice]);

  const run = async (action) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      setRemarks('');
      onActed?.();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const actualOwnerId = ownerUserId || piUserId;
  const isOwner = Boolean(currentUserId) && Boolean(actualOwnerId) && currentUserId === actualOwnerId;

  const hasRole = (roleList) =>
    roleList.some((r) => userRoles.map((ur) => String(ur).toLowerCase()).includes(r.toLowerCase()));

  const isDraft = status === 'Draft';
  const isUnderApproval = status === 'UnderApproval';
  const isTerminalish = ['Approved', 'SubmittedToAgency', 'Sanctioned', 'Withdrawn', 'Rejected', 'NotFunded'].includes(status);
  const isReturnedToPi = currentStage === 'ReturnedToPI';

  // Role authorization check per stage
  const isAllowedForCurrentStage = (() => {
    if (!isUnderApproval) return isDraft && isOwner;
    if (isReturnedToPi) return isOwner;
    if (currentStage === 'WithHOD') return hasRole(['HOD', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithRnCOffice' || currentStage === 'AssignedToDealingAssistant')
      return hasRole(['RegularStaff', 'Superintendent', 'DeputyRegistrar', 'Dean', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithSuperintendent') return hasRole(['Superintendent', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithDeputyRegistrar') return hasRole(['DeputyRegistrar', 'SuperAdmin', 'Admin']);
    if (currentStage === 'WithDean') return hasRole(['Dean', 'Director', 'SuperAdmin', 'Admin']);
    return false;
  })();

  // Action button visibility
  const showSubmit = isDraft && isOwner;
  const showResubmit = isUnderApproval && isReturnedToPi && isOwner;

  const showForward =
    isUnderApproval &&
    isAllowedForCurrentStage &&
    ['WithHOD', 'WithRnCOffice', 'AssignedToDealingAssistant', 'WithSuperintendent', 'WithDeputyRegistrar'].includes(currentStage);

  const showAssign = isUnderApprovalAtOffice && isAllowedForCurrentStage;

  const showReturn =
    isUnderApproval &&
    isAllowedForCurrentStage &&
    ['WithHOD', 'WithSuperintendent', 'WithDeputyRegistrar'].includes(currentStage);

  const showReject =
    isUnderApproval &&
    isAllowedForCurrentStage &&
    ['WithSuperintendent', 'WithDeputyRegistrar', 'WithDean'].includes(currentStage);

  const showApprove = isUnderApproval && isAllowedForCurrentStage && currentStage === 'WithDean';

  // Only the proposal owner (PI) can withdraw
  const showWithdraw = isOwner && !isTerminalish;

  const anyChainAction = showSubmit || showResubmit || showForward || showReject || showReturn || showApprove;

  // Submit, Forward (incl. Resubmit) and Return all require a non-blank
  // remark server-side (ResearchProposalService.SubmitForApprovalAsync and
  // WorkflowEngineService.ForwardAsync/ReturnAsync) -- gate the buttons here
  // too so the user sees why the action is blocked instead of a failed request.
  const remarksBlank = !remarks.trim();

  // Once the instance has moved past every stage this viewer could act at,
  // show what happened instead of stale/irrelevant action buttons -- this is
  // a UX read of already-fetched data, not a new authorization decision (the
  // backend remains the sole authority on who may act, per this file's own
  // stated philosophy above).
  const STAGE_LABELS = {
    WithHOD: 'the HOD',
    WithRnCOffice: 'the R&C Office',
    AssignedToDealingAssistant: 'the Dealing Assistant',
    WithSuperintendent: 'the Superintendent',
    WithDeputyRegistrar: 'the Deputy Registrar',
    WithDean: 'the Dean',
    ReturnedToPI: 'the PI (returned for correction)',
  };

  const statusMessage = (() => {
    if (isTerminalish) {
      if (status === 'Approved') return 'This proposal has been approved internally.';
      if (status === 'SubmittedToAgency') return 'This proposal has been submitted to agency.';
      if (status === 'Rejected') return 'This proposal has been rejected.';
      if (status === 'Withdrawn') return 'This proposal has been withdrawn.';
      if (status === 'Sanctioned') return 'This proposal has been sanctioned.';
      if (status === 'NotFunded') return 'The funding agency did not fund this proposal.';
      return null;
    }
    if (currentStage && STAGE_LABELS[currentStage] && !anyChainAction) {
      return `Forwarded to ${STAGE_LABELS[currentStage]}.`;
    }
    return null;
  })();

  // Offered whenever the viewer is the actor of the most recent step,
  // independent of anyChainAction/statusMessage below -- "I want to take back
  // what I just did" is exactly the situation where the normal action buttons
  // have collapsed away. The backend's own undo endpoint remains the sole
  // authority on whether the attempt is actually still eligible (e.g. it
  // rejects if another action has since happened); this is only a UX hint.
  const canUndo = Boolean(lastStepActorUserId) && Boolean(currentUserId) && lastStepActorUserId === currentUserId;

  const undoButton = canUndo && (
    <button
      type="button"
      onClick={() => run(() => undoLastProposalAction(id))}
      disabled={isSubmitting}
      className="text-xs px-3 py-1.5 border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50"
    >
      Undo my last action
    </button>
  );

  const undoError = error && (
    <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
      {error}
    </div>
  );

  if (!anyChainAction && !showWithdraw) {
    if (!statusMessage) {
      if (!undoButton) return null;
      return (
        <div className="space-y-3">
          {undoError}
          {undoButton}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {undoError}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          {statusMessage}
        </div>
        {undoButton}
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
      {undoButton}

      {anyChainAction && (
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Remarks <span className="text-rose-600">*</span>
          </label>
          <textarea
            rows="2"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="A remark is required for this action"
            className={`${FIELD_CLASS} custom-scrollbar`}
          />
        </div>
      )}

      {showAssign && (
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Assign to a Dealing Assistant (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className={`${FIELD_CLASS} w-full `}
            >
              <option value="">Leave open to any office staff</option>
              {assigneeOptions.map((o) => (
                <option key={o.userId} value={o.userId}>{o.fullName}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={isSubmitting || !selectedAssigneeId}
              onClick={() => run(() => assignToDealingAssistant(id, selectedAssigneeId, remarks))}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
            >
              Assign &amp; forward
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {showSubmit && (
          <button type="button" disabled={isSubmitting || remarksBlank}
            onClick={() => run(() => submitProposal(id, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Submit for approval
          </button>
        )}
        {showResubmit && (
          <button type="button" disabled={isSubmitting || remarksBlank}
            onClick={() => run(() => forwardProposal(id, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Resubmit Proposal
          </button>
        )}
        {showForward && (
          <button type="button" disabled={isSubmitting || (currentStage === 'WithHOD' && remarksBlank)}
            onClick={() => run(() => forwardProposal(id, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Forward
          </button>
        )}
        {showApprove && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => approveProposal(id, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Approve
          </button>
        )}
        {showReturn && (
          <button type="button" disabled={isSubmitting || remarksBlank}
            onClick={() => run(() => returnProposal(id, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Return to PI
          </button>
        )}
        {showReject && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => rejectProposal(id, remarks))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
            Reject
          </button>
        )}
        {showWithdraw && (
          <button type="button" disabled={isSubmitting}
            onClick={() => run(() => withdrawProposal(id))}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/30">
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
