import { useEffect } from 'react';
import { OVERHEAD_SUB_HEADS } from '../../../constants/projectEnums';
import { formatCurrency } from '../utils/currency';

const RATIOS = { Idf: 0.4, Pdf: 0.4, Ddf: 0.2 };

export default function OverheadSplitInputs({ overheadAmount, split, onChange }) {
  useEffect(() => {
    const computed = {};
    for (const subHead of OVERHEAD_SUB_HEADS) {
      computed[subHead.value] = Math.round(Number(overheadAmount || 0) * RATIOS[subHead.value] * 100) / 100;
    }
    onChange(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overheadAmount]);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <table className="w-full text-sm text-left">
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {OVERHEAD_SUB_HEADS.map((subHead) => (
            <tr key={subHead.value} className="bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
              <td className="px-6 py-3.5 font-medium text-slate-600 dark:text-slate-300 pl-8 w-[30%]">
                {subHead.label.split(' ')[0]}
              </td>
              <td className="px-6 py-3.5 text-slate-400 dark:text-slate-500 w-[40%] text-center">
                ---
              </td>
              <td className="px-6 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums pr-8">
                {formatCurrency(split[subHead.value] ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
