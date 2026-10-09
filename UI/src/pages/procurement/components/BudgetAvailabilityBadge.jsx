import { useEffect, useState } from 'react';
import { AlertTriangle, Wallet } from 'lucide-react';
import { getIndentBudget } from '../../../api/procurementApi';
import { formatCurrency } from '../../projects/utils/currency';

/**
 * Live budget position for the selected head, so the user sees what is left
 * before submitting rather than discovering it via a rejected request.
 *
 * The server enforces the same rule on raise; this is advisory display.
 */
export default function BudgetAvailabilityBadge({ budgetHeadId, estimatedCost }) {
  if (!budgetHeadId) return null;

  // Remounting per head means the fetch state starts empty for each one, so
  // nothing has to be cleared when the selection changes.
  return <BudgetFigures key={budgetHeadId} budgetHeadId={budgetHeadId} estimatedCost={estimatedCost} />;
}

function BudgetFigures({ budgetHeadId, estimatedCost }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Still guard the in-flight request: React may reuse this instance if the key
    // does not actually change between renders.
    let active = true;

    getIndentBudget(budgetHeadId)
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .catch(() => {
        if (active) setError('Could not load budget availability.');
      });

    return () => {
      active = false;
    };
  }, [budgetHeadId]);

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        {error}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        Loading budget availability…
      </div>
    );
  }

  const cost = Number(estimatedCost);
  const exceeds = Number.isFinite(cost) && cost > 0 && cost > snapshot.available;

  const shellClass = exceeds
    ? 'border-red-300 bg-red-50 dark:border-red-700/60 dark:bg-red-900/20'
    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20';

  const iconClass = exceeds
    ? 'text-red-600 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`p-4 rounded-xl border ${shellClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {exceeds
          ? <AlertTriangle size={16} className={iconClass} />
          : <Wallet size={16} className={iconClass} />}
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Budget availability
        </span>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols- sm:grid-cols-4 gap-3 text-xs">
        <Figure label="Sanctioned" value={snapshot.sanctioned} />
        <Figure label="Committed" value={snapshot.committed} />
        <Figure label="Paid" value={snapshot.paid} />
        <Figure label="Available" value={snapshot.available} strong />
      </dl>

      {exceeds && (
        <p className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300">
          The estimated cost exceeds the available balance. This request will be rejected.
        </p>
      )}
    </div>
  );
}

function Figure({ label, value, strong }) {
  return (
    <div>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${strong
        ? 'font-bold text-slate-900 dark:text-white'
        : 'font-medium text-slate-700 dark:text-slate-300'}`}>
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
