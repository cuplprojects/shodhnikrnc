import { useState } from 'react';
import { downloadReport } from '../../../api/reportsApi';

/**
 * Excel/PDF export, reusing reportsApi.js's downloadReport (the
 * fellowshipApi.js downloadStipendForm blob-download pattern). Each button
 * tracks its own pending state so one export in flight doesn't disable the
 * other format.
 */
export default function ExportButtons({ reportKey, from, to }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const runExport = async (format) => {
    setPending(format);
    setError(null);
    try {
      await downloadReport(reportKey, format, { from, to });
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => runExport('excel')}
        className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white transition-colors"
      >
        {pending === 'excel' ? 'Exporting…' : 'Export Excel'}
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => runExport('pdf')}
        className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white transition-colors"
      >
        {pending === 'pdf' ? 'Exporting…' : 'Export PDF'}
      </button>
      {error && <span className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
