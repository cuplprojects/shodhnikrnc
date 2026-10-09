import { PROPOSAL_STAGE_LABELS, proposalStageStyle } from '../../../constants/proposalEnums';

/**
 * A proposal's WorkflowStage, badge-styled like WORKFLOW_STAGE_LABELS is
 * elsewhere (procurementEnums.js) -- proposals use their own stage set
 * (Draft..WithDean, ReturnedToPI) so they get their own label/style map
 * rather than sharing the office-escalation one.
 */
export default function ProposalStageBadge({ stage }) {
  if (!stage) {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
        —
      </span>
    );
  }

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${proposalStageStyle(stage)}`}>
      {PROPOSAL_STAGE_LABELS[stage] ?? stage}
    </span>
  );
}
