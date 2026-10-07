import RequisitionModalShell from '../../procurement/components/RequisitionModalShell';

/**
 * Equipment requisition. Unlike the other two it must reference the sanctioned
 * equipment line it draws against — the server rejects the raise otherwise, and
 * also rejects equipment belonging to a different project. Legacy had no such
 * link, so equipment could be indented that the sanction never approved.
 */
const EquipmentRequisitionModal = ({
  isOpen,
  onClose,
  equipment,
  projectId,
  budgetHeads,
  onRaised,
}) => {
  if (!isOpen) return null;

  return (
    <RequisitionModalShell
      key={equipment?.id ?? 'new'}
      title="Raise Equipment Requisition"
      indentType="Equipment"
      projectId={projectId}
      budgetHeads={budgetHeads}
      sanctionedEquipment={equipment}
      prefill={equipment}
      onClose={onClose}
      onRaised={onRaised}
    />
  );
};

export default EquipmentRequisitionModal;
