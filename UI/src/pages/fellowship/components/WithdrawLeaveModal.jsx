import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { withdrawLeaveRequest } from '../../../api/fellowshipApi';

export default function WithdrawLeaveModal({ requestId, onClose, onWithdrawn }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await withdrawLeaveRequest(requestId, 'Withdrawn by Fellow');
      onWithdrawn();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to withdraw leave request.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Withdraw Leave Request
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to withdraw this leave request? This action cannot be undone.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-semibold dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-lg">
            {isSubmitting ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}
