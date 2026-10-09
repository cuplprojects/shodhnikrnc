import { PROPOSAL_STATUS_LABELS, proposalStatusStyle } from '../../../constants/proposalEnums';

/**
 * ProposalStatus is the broader lifecycle (Draft..Withdrawn); WorkflowStage
 * (ProposalStageBadge) is only where it sits within the internal chain while
 * Status is UnderApproval. Both are shown side by side wherever a proposal is
 * listed, since neither alone tells the whole story -- see
 * research-proposal-design.md's note that Approved != funded.
 */
export default function ProposalStatusBadge({ status }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${proposalStatusStyle(status)}`}>
      {PROPOSAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}
