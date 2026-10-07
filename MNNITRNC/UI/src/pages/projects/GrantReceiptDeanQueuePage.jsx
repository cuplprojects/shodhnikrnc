import { ShieldCheck } from 'lucide-react';
import { listGrantReceiptsForDean } from '../../api/projectsApi';
import GrantReceiptQueuePage from './GrantReceiptQueuePage';

// Dean may Approve (the route's only CanApprove stage, terminal), Reject, or
// Return (sequence 4).
export default function GrantReceiptDeanQueuePage() {
  return (
    <GrantReceiptQueuePage
      icon={ShieldCheck}
      title="Dean Grant Receipt Queue"
      description="Grant receipts awaiting the Dean's final approval, reject, or return."
      emptyMessage="No grant receipts are currently waiting for the Dean's decision."
      loadErrorMessage="Failed to load the Dean queue."
      loadReceipts={listGrantReceiptsForDean}
      bulkAction="Approve"
      bulkSecondaryActions={['Reject', 'Return']}
    />
  );
}
