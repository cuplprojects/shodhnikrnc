import { BUDGET_HEAD_NAMES } from '../../../constants/projectEnums';
import { formatCurrency } from '../utils/currency';

export default function BudgetSummaryTable({ lines }) {
  const headLabel = (line) => line.customLabel || BUDGET_HEAD_NAMES.find((h) => h.value === line.headName)?.label || line.headName;

  if (lines.length === 0) {
    return <p className="text-slate-500 dark:text-slate-400">No budget heads defined for this project.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
        <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-6 py-3">Budget Head</th>
            <th className="px-6 py-3 text-center">Project Year</th>
            <th className="px-6 py-3 text-right">Sanctioned</th>
            <th className="px-6 py-3 text-right">Grant Received</th>
            <th className="px-6 py-3 text-right">Spent</th>
            <th className="px-6 py-3 text-right">Available</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.headName}-${line.projectYear}-${index}`} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
              <td className="px-6 py-4 font-medium">{headLabel(line)}</td>
              <td className="px-6 py-4 text-center">{line.projectYear}</td>
              <td className="px-6 py-4 text-right text-slate-900 dark:text-slate-200">{formatCurrency(line.sanctioned)}</td>
              <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400">{formatCurrency(line.grantReceived)}</td>
              <td className="px-6 py-4 text-right text-rose-600 dark:text-rose-400">{formatCurrency(line.spent)}</td>
              <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(line.available)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
