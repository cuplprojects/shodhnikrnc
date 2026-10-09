import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-sm shadow-sm';

/**
 * Optional, zero-or-more manpower rows. `positions` is one fixed count for
 * the whole row (not per-year); `stipendByYear[i]` is a MONTHLY rate for
 * budget year i+1 (e.g. Rs 25,000/month in Year 1); `hraPercent` is one
 * uniform percentage applied to every year's stipend. The row total shown
 * per year is the annualized figure: positions x (stipend + stipend x
 * hraPercent/100) x 12 -- matching how a budget line's per-year amount is
 * an annual total, so the two can be compared 1:1 by the parent page's
 * RecurringManpower reconciliation check.
 */
export default function ProposalManpowerFieldArray({ items, durationMonths, onChange }) {
  const yearsCount = durationMonths && Number(durationMonths) > 0
    ? Math.ceil(Number(durationMonths) / 12)
    : 1;

  const resizedItems = items.map((item) => {
    const stipendByYear = Array.from({ length: yearsCount }, (_, i) => item.stipendByYear?.[i] ?? '');
    return { ...item, stipendByYear };
  });

  // Same resize-on-duration-change pattern ProposalBudgetMatrix.jsx uses
  // for yearAmounts -- without it, a duration change leaves stale-length
  // stipendByYear arrays and the manpower reconciliation check compares
  // the wrong number of years.
  useEffect(() => {
    const needsResize = items.some((item) => (item.stipendByYear?.length ?? 0) !== yearsCount);
    if (needsResize) {
      onChange(resizedItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsCount]);

  const updateItem = (index, field, value) => {
    const next = [...resizedItems];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const updateStipendForYear = (index, yearIndex, value) => {
    const next = [...resizedItems];
    const stipendByYear = [...next[index].stipendByYear];
    stipendByYear[yearIndex] = value;
    next[index] = { ...next[index], stipendByYear };
    onChange(next);
  };

  const addItem = () => onChange([
    ...resizedItems,
    { designation: '', positions: 1, hraPercent: '', stipendByYear: Array(yearsCount).fill('') },
  ]);
  const removeItem = (index) => onChange(resizedItems.filter((_, i) => i !== index));

  const annualRowTotal = (item) => {
    const positions = Number(item.positions) || 0;
    const hraPercent = Number(item.hraPercent) || 0;
    return item.stipendByYear.reduce((sum, s) => {
      const monthly = Number(s) || 0;
      return sum + positions * (monthly + (monthly * hraPercent) / 100) * 12;
    }, 0);
  };

  return (
    <div className="space-y-4">
      {resizedItems.map((item, index) => (
        <div key={index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              required value={item.designation} placeholder="Designation (e.g. JRF)"
              onChange={(e) => updateItem(index, 'designation', e.target.value)}
              className={`${FIELD_CLASS} flex-1`} aria-label={`Manpower ${index + 1} designation`}
            />
            <input
              required type="number" min="1" value={item.positions} placeholder="Positions"
              onChange={(e) => updateItem(index, 'positions', e.target.value)}
              className={`${FIELD_CLASS} sm:w-28`} aria-label={`Manpower ${index + 1} positions`}
            />
            <input
              required type="number" min="0" max="100" step="0.01" value={item.hraPercent} placeholder="HRA %"
              onChange={(e) => updateItem(index, 'hraPercent', e.target.value)}
              className={`${FIELD_CLASS} sm:w-28`} aria-label={`Manpower ${index + 1} HRA percent`}
            />
            <button
              type="button" onClick={() => removeItem(index)}
              aria-label={`Remove manpower ${index + 1}`}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${yearsCount}, minmax(0, 1fr))` }}>
            {item.stipendByYear.map((stipend, yearIndex) => {
              const hraPercent = Number(item.hraPercent) || 0;
              const monthlyHra = (Number(stipend) || 0) * hraPercent / 100;
              return (
                <div key={yearIndex} className="flex flex-col">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Stipend / month — Year {yearIndex + 1}
                  </label>
                  <input
                    required type="number" min="0" step="0.01" value={stipend}
                    onChange={(e) => updateStipendForYear(index, yearIndex, e.target.value)}
                    className={FIELD_CLASS} aria-label={`Manpower ${index + 1} year ${yearIndex + 1} monthly stipend`}
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5">+HRA {formatCurrency(monthlyHra)}/mo</span>
                </div>
              );
            })}
          </div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Total across all years (this position): {formatCurrency(annualRowTotal(item))}
          </div>
        </div>
      ))}
      <button
        type="button" onClick={addItem}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus size={14} /> Add Manpower Position
      </button>
    </div>
  );
}
