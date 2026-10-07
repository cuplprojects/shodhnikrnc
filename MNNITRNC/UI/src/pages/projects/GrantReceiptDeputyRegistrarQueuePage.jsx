import { BadgeCheck } from 'lucide-react';
import { listGrantReceiptsForDeputyRegistrar } from '../../api/projectsApi';
import GrantReceiptQueuePage from './GrantReceiptQueuePage';

// Deputy Registrar may Forward, Reject, or Return (sequence 5).
export default function GrantReceiptDeputyRegistrarQueuePage() {
  return (
    <GrantReceiptQueuePage
      icon={BadgeCheck}
      title="Deputy Registrar Grant Receipt Queue"
      description="Grant receipts awaiting the Deputy Registrar's forward, reject, or return."
      emptyMessage="No grant receipts are currently waiting in the Deputy Registrar queue."
      loadErrorMessage="Failed to load the Deputy Registrar queue."
      loadReceipts={listGrantReceiptsForDeputyRegistrar}
      bulkAction="Forward"
      bulkSecondaryActions={['Reject', 'Return']}
    />
  );
}
