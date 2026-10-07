import { BarChart3 } from 'lucide-react';

/**
 * Renders one report's rows against its column definitions (reportDefinitions.js).
 * Loading/empty/error states mirror ProposalsPage.jsx's exact shape and classes.
 */
export default function ReportTable({ definition, rows, isLoading, error }) {
  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading report…</div>;
  }

  if (error) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400">{error}</div>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        <BarChart3 size={32} className="text-slate-400 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">No data found for this report.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
        <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <tr>
            {definition.columns.map((col) => (
              <th key={col.header} className={`px-5 py-4 ${col.align === 'right' ? 'text-right' : ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, i) => (
            <tr key={definition.rowKey(row, i)} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
              {definition.columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-5 py-4 ${col.align === 'right' ? 'text-right font-medium text-emerald-600 dark:text-emerald-400' : ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
