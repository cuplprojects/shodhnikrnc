import { ClipboardCheck } from 'lucide-react';
import { listGrantReceiptsForDa } from '../../api/projectsApi';
import GrantReceiptQueuePage from './GrantReceiptQueuePage';

// DA may Forward, Reject, or Return (GrantReceiptWorkflowSeeder.Route sequence 3).
export default function GrantReceiptDaQueuePage() {
  return (
    <GrantReceiptQueuePage
      icon={ClipboardCheck}
      title="DA Grant Receipt Queue"
      description="Grant receipts awaiting the Dealing Assistant's forward, reject, or return."
      emptyMessage="No grant receipts are currently waiting in the DA queue."
      loadErrorMessage="Failed to load the DA queue."
      loadReceipts={listGrantReceiptsForDa}
      bulkAction="Forward"
      bulkSecondaryActions={['Reject', 'Return']}
    />
  );
}
