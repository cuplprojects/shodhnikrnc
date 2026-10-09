import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, ExternalLink } from 'lucide-react';
import {
  forwardGrantReceipt, approveGrantReceipt, rejectGrantReceipt, returnGrantReceipt,
  bulkActOnGrantReceipts,
} from '../../api/projectsApi';
import { formatCurrency } from './utils/currency';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

const STATUS_STYLES = {
  Approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
  Rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
  PendingApproval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
};

// Which actions a stage supports -- mirrors GrantReceiptChainActions.jsx's
// own per-stage gating (HOD may only Forward; DA/Superintendent/
// DeputyRegistrar may each Forward/Reject/Return; Dean may Approve/Reject/
// Return; the PI's own resubmit at ReturnedToPIGrantReceipt is a Forward
// call; WithRnCOfficeGrantReceipt is kept for any pre-chain-expansion
// in-flight receipt still sitting there, though no new receipt reaches it).
// Kept in sync with the identical table on ProjectDetailPage.jsx
// (GrantReceiptApprovalList.jsx).
const ACTIONS_BY_STAGE = {
  WithHODGrantReceipt: ['Forward'],
  WithRnCOfficeGrantReceipt: ['Forward', 'Reject', 'Return'],
  AssignedToDAGrantReceipt: ['Forward', 'Reject', 'Return'],
  WithSuperintendentGrantReceipt: ['Forward', 'Reject', 'Return'],
  WithDeputyRegistrarGrantReceipt: ['Forward', 'Reject', 'Return'],
  WithDeanGrantReceipt: ['Approve', 'Reject', 'Return'],
  ReturnedToPIGrantReceipt: ['Forward'],
};

const ACTION_LABELS = { Forward: 'Forward', Approve: 'Approve', Reject: 'Reject', Return: 'Return to PI' };
const ACTION_STYLES = {
  Forward: 'bg-blue-600 hover:bg-blue-700',
  Approve: 'bg-emerald-600 hover:bg-emerald-700',
  Reject: 'bg-rose-600 hover:bg-rose-700',
  Return: 'bg-amber-500 hover:bg-amber-600',
};
const ACTION_CALL = {
  Forward: forwardGrantReceipt, Approve: approveGrantReceipt,
  Reject: rejectGrantReceipt, Return: returnGrantReceipt,
};

function RowActions({ receipt, onActed }) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actions = ACTIONS_BY_STAGE[receipt.currentStage] ?? [];
  if (receipt.status !== 'PendingApproval' || actions.length === 0) {
    return <span className="text-xs text-slate-400 italic">Awaiting the next approver.</span>;
  }

  const run = async (action) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await ACTION_CALL[action](receipt.projectId, receipt.id, remarks);
      setRemarks('');
      onActed?.();
    } catch {
      // Global toast (via apiClient) shows the error automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <input
        type="text"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Remarks (optional)"
        disabled={isSubmitting}
        className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
      />
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={isSubmitting}
            onClick={() => run(action)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors ${ACTION_STYLES[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Shared implementation behind the HOD/RnC-office/Dean grant-receipt queue
 * pages -- the three differ only in icon, data source, and copy, and each
 * page below is a thin wrapper passing those in. Renders as a table (budget
 * head is not carried on the queue-item summary here, so the columns are
 * project, received date, amount, status, actions) -- matching the same
 * table layout used on the project detail page's own Grant Receipts list
 * (GrantReceiptApprovalList.jsx), rather than one card per receipt.
 *
 * `bulkAction` names which single GrantReceiptBulkAction this queue's bulk
 * bar offers as its primary action (Forward for HOD/RnC, Approve for Dean);
 * `bulkSecondaryActions` lists any others available in bulk here (Reject/
 * Return), matching ACTIONS_BY_STAGE above.
 */
export default function GrantReceiptQueuePage({
  icon: Icon, title, description, emptyMessage, loadErrorMessage,
  loadReceipts, bulkAction, bulkSecondaryActions = [],
}) {
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  const load = useCallback(async () => {
    setReceipts(await loadReceipts() ?? []);
  }, [loadReceipts]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    load()
      .catch(() => { if (active) setError(loadErrorMessage); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [load, loadErrorMessage]);

  const reload = useCallback(() => {
    setSelectedIds(new Set());
    return load();
  }, [load]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkEligibleIds = receipts
    .filter((r) => r.status === 'PendingApproval' && (ACTIONS_BY_STAGE[r.currentStage]?.length ?? 0) > 0)
    .map((r) => r.id);
  const allSelected = bulkEligibleIds.length > 0 && bulkEligibleIds.every((id) => selectedIds.has(id));
  const someSelected = bulkEligibleIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(bulkEligibleIds));
  };

  const runBulkAction = async (action) => {
    if (isBulkSubmitting || selectedIds.size === 0) return;
    setIsBulkSubmitting(true);
    setBulkError(null);
    try {
      await bulkActOnGrantReceipts(Array.from(selectedIds), action, bulkRemarks);
      setBulkRemarks('');
      await reload();
    } catch (err) {
      // The batch is all-or-nothing on the backend -- nothing was applied.
      // Selection is kept so the user can retry without re-picking.
      setBulkError(err?.message ?? 'The bulk action failed. None of the selected receipts were changed.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen dark:dark:p-4 lg:p-8 animate-in fade-in duration-500">
      <div className="w-full w-full space-y-6 pb-24">
        <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Icon size={24} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium ml-14">{description}</p>
        </div>

        {isLoading ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 font-medium shadow-sm animate-pulse">
            Loading queue...
          </div>
        ) : error ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-rose-200/50 dark:border-rose-900/50 rounded-2xl p-12 text-center text-rose-500 dark:text-rose-400 font-medium shadow-sm">
            {error}
          </div>
        ) : receipts.length === 0 ? (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-16 text-center flex flex-col items-center shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
              <FileSearch size={36} className="text-indigo-400 dark:text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Queue is Empty</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium w-full ">{emptyMessage}</p>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-bold w-10">
                      {bulkEligibleIds.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          aria-label="Select all"
                        />
                      )}
                    </th>
                    <th className="px-4 py-3 font-bold">Project</th>
                    <th className="px-4 py-3 font-bold">Received</th>
                    <th className="px-4 py-3 font-bold text-right">Amount</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receipts.map((r) => {
                    const isBulkEligible = r.status === 'PendingApproval' && (ACTIONS_BY_STAGE[r.currentStage]?.length ?? 0) > 0;
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3">
                          {isBulkEligible && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelected(r.id)}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                              aria-label={`Select ${r.projectTitle}`}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                          <span className="inline-flex items-center gap-1.5">
                            {r.projectTitle}
                            <Link
                              to={`/projects/${r.projectId}`}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title="View project"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.receivedDate)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(r.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_STYLES[r.status] ?? STATUS_STYLES.PendingApproval}`}>
                            {r.status === 'PendingApproval' ? 'Pending Approval' : r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <RowActions receipt={r} onActed={reload} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-2xl px-4 py-4 lg:px-8 z-20">
          <div className="w-full flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              {selectedIds.size} selected
            </span>
            <input
              type="text"
              value={bulkRemarks}
              onChange={(e) => setBulkRemarks(e.target.value)}
              placeholder="Optional remarks for the whole batch"
              className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:text-white"
            />
            {[bulkAction, ...bulkSecondaryActions].map((action) => (
              <button
                key={action}
                type="button"
                disabled={isBulkSubmitting}
                onClick={() => runBulkAction(action)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors whitespace-nowrap ${ACTION_STYLES[action]}`}
              >
                {ACTION_LABELS[action]} {selectedIds.size}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setSelectedIds(new Set()); setBulkError(null); }}
              className="px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Clear
            </button>
            {bulkError && (
              <div className="w-full text-sm font-semibold text-rose-600 dark:text-rose-400">{bulkError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
