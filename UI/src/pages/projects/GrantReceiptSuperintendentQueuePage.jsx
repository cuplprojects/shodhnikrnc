import { UserCheck } from 'lucide-react';
import { listGrantReceiptsForSuperintendent } from '../../api/projectsApi';
import GrantReceiptQueuePage from './GrantReceiptQueuePage';

// Superintendent may Forward, Reject, or Return (sequence 4).
export default function GrantReceiptSuperintendentQueuePage() {
  return (
    <GrantReceiptQueuePage
      icon={UserCheck}
      title="Superintendent Grant Receipt Queue"
      description="Grant receipts awaiting the Superintendent's forward, reject, or return."
      emptyMessage="No grant receipts are currently waiting in the Superintendent queue."
      loadErrorMessage="Failed to load the Superintendent queue."
      loadReceipts={listGrantReceiptsForSuperintendent}
      bulkAction="Forward"
      bulkSecondaryActions={['Reject', 'Return']}
    />
  );
}
