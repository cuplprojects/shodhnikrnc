import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { overrideHra } from '../../../api/fellowshipApi';
import { HRA_OVERRIDE_NOTE } from '../../../constants/fellowshipEnums';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

/**
 * Dean/Director HRA override.
 *
 * The reason is required by the server and by this form: an unexplained change
 * to someone's pay is not auditable. The sanctioned figure is shown next to the
 * computed one so a mismatch is visible before deciding.
 */
export default function HraOverrideModal({ claim, onClose, onSaved }) {
  const [hraAmount, setHraAmount] = useState(String(claim.hraAmount ?? 0));
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const amount = Number(hraAmount) || 0;
  const newTotal = (claim.fellowshipAmount ?? 0) + amount;
  const canSubmit = reason.trim().length > 0 && amount >= 0;

  const mismatch =
    claim.sanctionedHra != null && Math.abs(claim.sanctionedHra - claim.hraAmount) > 0.005;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await overrideHra(claim.id, { hraAmount: amount, reason: reason.trim() });
      onSaved?.();
      onClose();
    } catch (err) {
      // Error is shown via the global toast notification
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Override HRA</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Fellowship</span>
              <span className="tabular-nums">{formatCurrency(claim.fellowshipAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Current HRA (computed at 20%)</span>
              <span className="tabular-nums">{formatCurrency(claim.hraAmount)}</span>
            </div>
            {claim.sanctionedHra != null && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">HRA sanctioned for this position</span>
                <span className={`tabular-nums ${mismatch ? 'font-bold text-amber-600 dark:text-amber-400' : ''}`}>
                  {formatCurrency(claim.sanctionedHra)}
                </span>
              </div>
            )}
          </div>

          {mismatch && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                The computed 20% differs from the HRA sanctioned for this position.
                Check which figure is correct before overriding.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className={LABEL_CLASS} htmlFor="hraAmount">
              New HRA amount (₹) <span className="text-red-500">*</span>
            </label>
            <input required id="hraAmount" type="number" step="0.01" min="0"
              value={hraAmount} onChange={(e) => setHraAmount(e.target.value)}
              className={FIELD_CLASS} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              New total: <strong className="tabular-nums">{formatCurrency(newTotal)}</strong>
            </p>
          </div>

          <div className="space-y-1">
            <label className={LABEL_CLASS} htmlFor="reason">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea required id="reason" rows="3" value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${FIELD_CLASS} custom-scrollbar`} />
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {HRA_OVERRIDE_NOTE}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !canSubmit}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg">
              {isSubmitting ? 'Saving…' : 'Override HRA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
