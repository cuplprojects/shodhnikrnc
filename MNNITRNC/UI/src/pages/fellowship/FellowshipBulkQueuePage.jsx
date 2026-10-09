import { useCallback, useEffect, useState } from 'react';
import { bulkActOnClaims, listPendingClaimsForCaller } from '../../api/fellowshipApi';
import { formatCurrency } from '../projects/utils/currency';

const ACTION_LABELS = { Approve: 'Approve', Reject: 'Reject', Return: 'Return to PI' };
const ACTION_STYLES = {
  Approve: 'bg-emerald-600 hover:bg-emerald-700',
  Reject: 'bg-rose-600 hover:bg-rose-700',
  Return: 'bg-amber-500 hover:bg-amber-600',
};
// Both require a non-empty remark server-side (RejectAsync/ReturnAsync throw
// ArgumentException otherwise) -- surfaced here so the bulk bar's "Optional"
// remarks hint doesn't mislead the user into submitting one of these blank.
const REMARKS_REQUIRED_ACTIONS = new Set(['Reject', 'Return']);

/**
 * Multi-select bulk approve/reject/return for one fellowship-claim stage.
 * Mirrors GrantReceiptQueuePage.jsx's own checkbox/select-all/bulk-bar shape
 * -- the claim-specific display columns differ, the bulk interaction pattern
 * does not.
 *
 * Fetches its own claim list via listPendingClaimsForCaller (narrowed to
 * claims actually pending this caller's action, including per-DA assignment
 * narrowing) rather than reusing the `claims` prop from
 * FellowshipApprovalPage.jsx's unfiltered listAllFellowshipClaims -- so
 * "select all" never includes a claim the bulk action would reject and roll
 * back the whole batch over.
 */
export default function FellowshipBulkQueuePage({ stage, onActed }) {
  const [eligible, setEligible] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const pending = await listPendingClaimsForCaller();
      setEligible(pending.filter((c) => c.currentStage === stage));
    } finally {
      setIsLoading(false);
    }
  }, [stage]);

  useEffect(() => { load(); }, [load]);

  const allSelected = eligible.length > 0 && eligible.every((c) => selectedIds.has(c.id));
  const someSelected = eligible.some((c) => selectedIds.has(c.id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(eligible.map((c) => c.id)));
  };

  const runBulkAction = async (action) => {
    if (isBulkSubmitting || selectedIds.size === 0) return;
    if (REMARKS_REQUIRED_ACTIONS.has(action) && !bulkRemarks.trim()) {
      setBulkError(`${ACTION_LABELS[action]} requires a remark for the whole batch.`);
      return;
    }
    setIsBulkSubmitting(true);
    setBulkError(null);
    try {
      await bulkActOnClaims(Array.from(selectedIds), action, bulkRemarks || null);
      setBulkRemarks('');
      setSelectedIds(new Set());
      await load();
      onActed?.();
    } catch (err) {
      setBulkError(err?.message ?? 'The bulk action failed. None of the selected claims were changed.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  if (isLoading || eligible.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-white/20 dark:border-slate-800/50">
        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-bold">Scholar</th>
              <th className="px-4 py-3 font-bold">Project</th>
              <th className="px-4 py-3 font-bold">Month</th>
              <th className="px-4 py-3 font-bold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {eligible.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelected(c.id)}
                    aria-label={`Select ${c.scholarName}`}
                  />
                </td>
                <td className="px-4 py-3 font-semibold">{c.scholarName}</td>
                <td className="px-4 py-3">{c.projectTitle}</td>
                <td className="px-4 py-3">{c.claimMonth}/{c.claimYear}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(c.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 shadow-2xl px-4 py-4 lg:px-8 z-20">
          <div className="w-full flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {selectedIds.size} selected
            </span>
            <input
              type="text"
              value={bulkRemarks}
              onChange={(e) => setBulkRemarks(e.target.value)}
              placeholder="Remarks for the whole batch (required for Reject/Return)"
              className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none"
            />
            {['Approve', 'Reject', 'Return'].map((action) => (
              <button
                key={action}
                type="button"
                disabled={isBulkSubmitting}
                onClick={() => runBulkAction(action)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 ${ACTION_STYLES[action]}`}
              >
                {ACTION_LABELS[action]} {selectedIds.size}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setSelectedIds(new Set()); setBulkError(null); }}
              className="px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400"
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
