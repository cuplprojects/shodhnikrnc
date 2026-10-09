import RequisitionModalShell from '../../procurement/components/RequisitionModalShell';

/**
 * Consumable requisition. The form body is shared with the contingency and
 * equipment modals — see RequisitionModalShell, which also explains why the
 * old "Mode of Purchase" dropdown is gone.
 */
const ConsumablesRequisitionModal = ({
  isOpen,
  onClose,
  consumable,
  projectId,
  budgetHeads,
  onRaised,
}) => {
  if (!isOpen) return null;

  return (
    <RequisitionModalShell
      key={consumable?.id ?? 'new'}
      title="Raise Consumables Requisition"
      indentType="Consumable"
      projectId={projectId}
      budgetHeads={budgetHeads}
      prefill={consumable}
      onClose={onClose}
      onRaised={onRaised}
    />
  );
};

export default ConsumablesRequisitionModal;
