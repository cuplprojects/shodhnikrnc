import { ClipboardList } from 'lucide-react';
import { listGrantReceiptsForHod } from '../../api/projectsApi';
import GrantReceiptQueuePage from './GrantReceiptQueuePage';

// HOD may only Forward (GrantReceiptWorkflowSeeder.Route sequence 2 --
// CanReject/CanReturn both false), so the bulk bar offers Forward alone,
// matching GrantReceiptChainActions' own per-card gating.
export default function GrantReceiptHodQueuePage() {
  return (
    <GrantReceiptQueuePage
      icon={ClipboardList}
      title="Department Grant Receipt Queue"
      description="Grant receipts raised within your department, awaiting your forward."
      emptyMessage="No grant receipts are currently waiting in your department's queue."
      loadErrorMessage="Failed to load the department queue."
      loadReceipts={listGrantReceiptsForHod}
      bulkAction="Forward"
    />
  );
}
