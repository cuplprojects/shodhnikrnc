import React, { useState } from 'react';
import { formatCurrency } from '../utils/currency';
import { getBudgetHeadDisplay } from '../../../constants/projectEnums';
import { deleteHistoricalExpenditure, deleteHistoricalGrantReceipt } from '../../../api/historicalEntriesApi';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Renders the two historical-entry lists (expenditure, grant receipts) for
 * the selected project, each with a Delete action per row. Delete uses the
 * same window.confirm pattern already used elsewhere in this app (e.g.
 * AdvertisementTemplatesPage, GenerateAdvertisementModal) rather than a
 * custom modal.
 */
export default function HistoricalEntriesTable({ expenditures, grantReceipts, onDeleted }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteExpenditure = async (item) => {
    const confirmed = window.confirm(
      `Delete this historical expenditure of ${formatCurrency(item.amount)} (${getBudgetHeadDisplay(item.headName)})? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await deleteHistoricalExpenditure(item.id);
      if (onDeleted) onDeleted();
    } catch (err) {
      console.error('Failed to delete historical expenditure', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteGrantReceipt = async (item) => {
    const confirmed = window.confirm(
      `Delete this historical grant receipt of ${formatCurrency(item.amount)} (${getBudgetHeadDisplay(item.headName)})? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await deleteHistoricalGrantReceipt(item.id);
      if (onDeleted) onDeleted();
    } catch (err) {
      console.error('Failed to delete historical grant receipt', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Historical Expenditure */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Historical Expenditure</h3>
        </div>
        <div className="overflow-x-auto">
          {expenditures.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No historical expenditure recorded yet.</div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-900/80 uppercase text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4 text-left">Head</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Date</th>
                  <th className="py-3 px-4 text-left">Description</th>
                  <th className="py-3 px-4 text-center">Entered By</th>
                  <th className="py-3 px-4 text-center">Recorded At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {expenditures.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {getBudgetHeadDisplay(item.headName)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">{formatDate(item.transactionDate)}</td>
                    <td className="py-3 px-4 text-left max-w-[280px]">
                      <span title={item.description}>{item.description}</span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[10px]" title={item.recordedByUserId}>
                      {item.recordedByUserId ? `${item.recordedByUserId.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteExpenditure(item)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold transition-all active:scale-95 border border-rose-200 dark:border-rose-800 disabled:opacity-50"
                      >
                        {deletingId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Historical Grant Receipts */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Historical Grant Receipts</h3>
        </div>
        <div className="overflow-x-auto">
          {grantReceipts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No historical grant receipts recorded yet.</div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-900/80 uppercase text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4 text-left">Head</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Date</th>
                  <th className="py-3 px-4 text-left">Remarks</th>
                  <th className="py-3 px-4 text-center">Entered By</th>
                  <th className="py-3 px-4 text-center">Recorded At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {grantReceipts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {getBudgetHeadDisplay(item.headName)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">{formatDate(item.receivedDate)}</td>
                    <td className="py-3 px-4 text-left max-w-[280px]">
                      <span title={item.remarks}>{item.remarks || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[10px]" title={item.recordedByUserId}>
                      {item.recordedByUserId ? `${item.recordedByUserId.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteGrantReceipt(item)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold transition-all active:scale-95 border border-rose-200 dark:border-rose-800 disabled:opacity-50"
                      >
                        {deletingId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
