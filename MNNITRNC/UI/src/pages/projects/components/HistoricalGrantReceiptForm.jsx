import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { recordHistoricalGrantReceipt } from '../../../api/historicalEntriesApi';
import { getBudgetHeadDisplay } from '../../../constants/projectEnums';

/**
 * Direct historical-grant-receipt entry form for a single project. Mirrors
 * HistoricalExpenditureForm's/AddGrantReceivedPage's loading/error/success
 * pattern.
 */
export default function HistoricalGrantReceiptForm({ projectId, budgetHeads, onRecorded }) {
  const [budgetHeadId, setBudgetHeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const resetForm = () => {
    setBudgetHeadId('');
    setAmount('');
    setReceivedDate('');
    setRemarks('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setShowSuccess(false);
    setIsSubmitting(true);

    try {
      await recordHistoricalGrantReceipt(projectId, {
        budgetHeadId,
        amount: Number(amount),
        receivedDate,
        remarks: remarks.trim() ? remarks : null,
      });

      setShowSuccess(true);
      resetForm();
      if (onRecorded) onRecorded();
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to record historical grant receipt', err);
      setError(err.message || 'Failed to record the historical grant receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = budgetHeadId && Number(amount) > 0 && receivedDate;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors space-y-5">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Record Historical Grant Receipt</h3>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Budget Head <span className="text-red-500">*</span></label>
          <select
            value={budgetHeadId}
            onChange={(e) => setBudgetHeadId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white hover:bg-white dark:hover:bg-slate-800"
          >
            <option value="">-- Choose a budget head --</option>
            {budgetHeads.map((head) => (
              <option key={head.id} value={head.id}>
                {getBudgetHeadDisplay(head.headName, head.customLabel)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Amount (₹) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Received Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Remarks</label>
          <textarea
            rows="3"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional notes (e.g. reference numbers)"
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {showSuccess && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg text-sm font-medium animate-in fade-in zoom-in duration-300">
                <CheckCircle2 size={18} />
                Grant receipt recorded.
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
            {isSubmitting ? 'Saving...' : 'Record Grant Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}
