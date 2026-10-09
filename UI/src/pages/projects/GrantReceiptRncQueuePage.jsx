import { Building2 } from 'lucide-react';
import { listGrantReceiptsForRnCOffice } from '../../api/projectsApi';
import GrantReceiptQueuePage from './GrantReceiptQueuePage';

// RnC office may Forward, Reject, or Return (sequence 3).
export default function GrantReceiptRncQueuePage() {
  return (
    <GrantReceiptQueuePage
      icon={Building2}
      title="R&C Office Grant Receipts"
      description="Grant receipts awaiting the R&C office's forward, reject, or return."
      emptyMessage="No grant receipts are currently waiting in the R&C office queue."
      loadErrorMessage="Failed to load the R&C office queue."
      loadReceipts={listGrantReceiptsForRnCOffice}
      bulkAction="Forward"
      bulkSecondaryActions={['Reject', 'Return']}
    />
  );
}
