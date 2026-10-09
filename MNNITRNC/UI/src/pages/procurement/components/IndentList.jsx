import { formatCurrency } from '../../projects/utils/currency';
import { PROCUREMENT_TIERS, WORKFLOW_STAGE_LABELS } from '../../../constants/procurementEnums';

/** Terminal stages read as outcomes; everything else is still in flight. */
const STAGE_STYLES = {
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  Rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  Cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  Raised: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  SignedCopyUploaded: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const DEFAULT_STAGE_STYLE =
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
}

export default function IndentList({
  indents,
  onSelect,
  showType = false,
  showProject = false,
  emptyMessage = 'No indents raised yet',
  renderAction = null,
}) {
  if (!indents || indents.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        <p className="text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
        <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-5 py-4 w-16 text-center">S.No</th>
            <th className="px-5 py-4">Item Name</th>
            {showProject && <th className="px-5 py-4">Project</th>}
            {showType && <th className="px-5 py-4">Type</th>}
            <th className="px-5 py-4 text-right">Est. Cost (₹)</th>
            <th className="px-5 py-4">Form</th>
            <th className="px-5 py-4">Stage</th>
            <th className="px-5 py-4">Raised</th>
            {renderAction && <th className="px-5 py-4 text-right">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {indents.map((indent, i) => {
            const tier = PROCUREMENT_TIERS[indent.tier];
            const stageStyle = STAGE_STYLES[indent.currentStage] ?? DEFAULT_STAGE_STYLE;

            return (
              <tr
                key={indent.id}
                onClick={() => onSelect?.(indent)}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${onSelect ? 'cursor-pointer' : ''}`}
              >
                <td className="px-5 py-4 text-center font-medium text-slate-400">{i + 1}</td>
                <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{indent.name}</td>
                {showProject && (
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                    {indent.projectTitle ?? '—'}
                  </td>
                )}
                {showType && (
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {indent.indentType}
                    </span>
                  </td>
                )}
                <td className="px-5 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(indent.estimatedCost)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded"
                    title={tier?.label}
                  >
                    {tier?.annexure ?? indent.tier}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${stageStyle}`}>
                    {WORKFLOW_STAGE_LABELS[indent.currentStage] ?? indent.currentStage}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                  {formatDate(indent.createdAt)}
                </td>
                {renderAction && (
                  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    {renderAction(indent)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
