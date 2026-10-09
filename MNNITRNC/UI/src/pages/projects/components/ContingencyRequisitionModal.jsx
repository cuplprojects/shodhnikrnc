import RequisitionModalShell from '../../procurement/components/RequisitionModalShell';

/**
 * Contingency requisition. The form body is shared with the consumable and
 * equipment modals — see RequisitionModalShell.
 */
const ContingencyRequisitionModal = ({
  isOpen,
  onClose,
  contingency,
  projectId,
  budgetHeads,
  onRaised,
}) => {
  if (!isOpen) return null;

  return (
    <RequisitionModalShell
      key={contingency?.id ?? 'new'}
      title="Raise Contingency Requisition"
      indentType="Contingency"
      projectId={projectId}
      budgetHeads={budgetHeads}
      prefill={contingency}
      onClose={onClose}
      onRaised={onRaised}
    />
  );
};

export default ContingencyRequisitionModal;
