import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BUDGET_HEAD_NAMES } from '../../../constants/proposalEnums';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-sm shadow-sm';

/**
 * Rows = budget heads, columns = Year 1..N where N = ceil(durationMonths / 12)
 * (a 28-month proposal gets 3 columns). Overhead is no longer per-row: ONE
 * overheadPercent (a sibling prop, not part of `lines`) applies to the sum of
 * whichever rows have `includeInOverhead` checked -- matches
 * ResearchProposalService.ComputeAmounts's server-side formula exactly
 * (client-side numbers here are a live preview only; the server is
 * authoritative).
 */
export default function ProposalBudgetMatrix({ durationMonths, lines, onChange, overheadPercent, onOverheadPercentChange }) {
  const yearsCount = durationMonths && Number(durationMonths) > 0
    ? Math.ceil(Number(durationMonths) / 12)
    : 1;

  const resizedLines = lines.map((line) => {
    const yearAmounts = Array.from({ length: yearsCount }, (_, i) => line.yearAmounts[i] ?? '');
    return { ...line, yearAmounts };
  });

  // Sync the resize back to the parent's state whenever durationMonths changes
  // the year-column count -- without this, a user who changes Duration without
  // touching every budget row leaves the parent holding stale-length
  // yearAmounts arrays, and submitting throws InvalidBudgetYearCountException
  // server-side with no client-side warning.
  useEffect(() => {
    const needsResize = lines.some((line) => line.yearAmounts.length !== yearsCount);
    if (needsResize) {
      onChange(resizedLines);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsCount]);

  // Aua system-managed RecurringOverhead row so the
  // per-year overhead breakdown (previously display-only) is actually
  // submitted as a real budget line. Excluded from its own base
  // (includeInOverhead: false) to avoid circularity on resubmit.
  //
  // Overhead is computed per year -- each year's own sum of checked lines is
  // multiplied by overheadPercent independently, NOT a lump total (every
  // year's amounts summed first) split evenly afterward. A front-loaded
  // budget must produce front-loaded overhead, matching
  // ResearchProposalService.ComputeAmounts's server-side formula exactly.
  useEffect(() => {
    const nonOverheadLines = lines.filter((l) => l.headName !== 'RecurringOverhead');
    const overheadByYear = Array.from({ length: yearsCount }, (_, yearIndex) => {
      const yearBase = nonOverheadLines
        .filter((l) => l.includeInOverhead)
        .reduce((sum, l) => sum + (Number(l.yearAmounts[yearIndex]) || 0), 0);
      return (yearBase * (Number(overheadPercent) || 0)) / 100;
    });

    const existingOverheadLine = lines.find((l) => l.headName === 'RecurringOverhead');
    const alreadyCorrect = existingOverheadLine
      && existingOverheadLine.yearAmounts.length === yearsCount
      && existingOverheadLine.yearAmounts.every((a, i) => Number(a) === overheadByYear[i]);
    if (alreadyCorrect) return;

    const overheadLine = {
      headName: 'RecurringOverhead',
      includeInOverhead: false,
      customLabel: null,
      yearAmounts: overheadByYear,
    };
    const next = existingOverheadLine
      ? lines.map((l) => (l.headName === 'RecurringOverhead' ? overheadLine : l))
      : [...lines, overheadLine];
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overheadPercent, yearsCount, JSON.stringify(lines.filter((l) => l.headName !== 'RecurringOverhead').map((l) => [l.headName, l.includeInOverhead, l.yearAmounts]))]);

  const updateHeadName = (index, headName) => {
    const next = [...resizedLines];
    next[index] = { ...next[index], headName };
    onChange(next);
  };

  const updateIncludeInOverhead = (index, includeInOverhead) => {
    const next = [...resizedLines];
    next[index] = { ...next[index], includeInOverhead };
    onChange(next);
  };

  const updateCustomLabel = (index, customLabel) => {
    const next = [...resizedLines];
    next[index] = { ...next[index], customLabel };
    onChange(next);
  };

  const updateYearAmount = (index, yearIndex, value) => {
    const next = [...resizedLines];
    const yearAmounts = [...next[index].yearAmounts];
    yearAmounts[yearIndex] = value;
    next[index] = { ...next[index], yearAmounts };
    onChange(next);
  };

  const addLine = () => {
    onChange([
      ...resizedLines,
      { headName: BUDGET_HEAD_NAMES[0].value, includeInOverhead: true, customLabel: '', yearAmounts: Array(yearsCount).fill('') },
    ]);
  };

  const removeLine = (index) => onChange(resizedLines.filter((_, i) => i !== index));

  const lineTotal = (line) => line.yearAmounts.reduce((sum, a) => sum + (Number(a) || 0), 0);

  const proposedAmount = resizedLines
    .filter((l) => l.headName !== 'RecurringOverhead')
    .reduce((sum, l) => sum + lineTotal(l), 0);

  // Overhead computed per year -- each year's own checked-lines total x
  // percent, independently -- matching ResearchProposalService.ComputeAmounts's
  // server-side formula exactly. NOT one lump total split evenly afterward.
  const overheadLines = resizedLines.filter((l) => l.includeInOverhead);
  const yearlyOverhead = Array.from({ length: yearsCount }, (_, yearIndex) => {
    const yearBase = overheadLines.reduce((sum, l) => sum + (Number(l.yearAmounts[yearIndex]) || 0), 0);
    return (yearBase * (Number(overheadPercent) || 0)) / 100;
  });
  const overheadAmount = yearlyOverhead.reduce((sum, a) => sum + a, 0);
  const totalAmount = proposedAmount + overheadAmount;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="text-left pb-2 pr-2">Budget Head</th>
              {Array.from({ length: yearsCount }, (_, i) => (
                <th key={i} className="text-left pb-2 px-2">Year {i + 1}</th>
              ))}
              <th className="text-center pb-2 px-2">Include in Overhead</th>
              <th className="text-right pb-2 px-2">Line Total</th>
              <th className="pb-2 pl-2"></th>
            </tr>
          </thead>
          <tbody>
            {resizedLines
              .map((line, index) => ({ line, index }))
              .sort((a, b) => (a.line.headName === 'RecurringOverhead' ? 1 : 0) - (b.line.headName === 'RecurringOverhead' ? 1 : 0))
              .map(({ line, index }) => (
                <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-2">
                    {line.headName === 'RecurringOverhead' ? (
                      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Recurring: Overhead (automatically)
                      </span>
                    ) : (
                      <>
                        <select
                          value={line.headName}
                          onChange={(e) => updateHeadName(index, e.target.value)}
                          className={FIELD_CLASS}
                          aria-label={`Budget line ${index + 1} head`}
                        >
                          {BUDGET_HEAD_NAMES.filter((h) => h.value !== 'RecurringOverhead').map((h) => (
                            <option key={h.value} value={h.value}>{h.label}</option>
                          ))}
                        </select>
                        {line.headName === 'Other' && (
                          <input
                            type="text"
                            placeholder="Describe this budget head"
                            value={line.customLabel || ''}
                            onChange={(e) => updateCustomLabel(index, e.target.value)}
                            className={`${FIELD_CLASS} mt-1`}
                            aria-label={`Budget line ${index + 1} custom label`}
                          />
                        )}
                      </>
                    )}
                  </td>
                  {line.yearAmounts.map((amount, yearIndex) => (
                    <td key={yearIndex} className="py-2 px-2">
                      {line.headName === 'RecurringOverhead' ? (
                        <span className="block px-3 py-2 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                          {formatCurrency(Number(amount) || 0)}
                        </span>
                      ) : (
                        <input
                          type="number" min="0" step="0.01" value={amount}
                          onChange={(e) => updateYearAmount(index, yearIndex, e.target.value)}
                          className={FIELD_CLASS}
                          aria-label={`Budget line ${index + 1} year ${yearIndex + 1} amount`}
                          placeholder="0.00"
                        />
                      )}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox" checked={line.includeInOverhead}
                      disabled={line.headName === 'RecurringOverhead'}
                      onChange={(e) => updateIncludeInOverhead(index, e.target.checked)}
                      aria-label={`Include budget line ${index + 1} in overhead`}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                    />
                  </td>
                  <td className="py-2 px-2 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(lineTotal(line))}
                  </td>
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      disabled={resizedLines.length <= 1 || line.headName === 'RecurringOverhead'}
                      aria-label={`Remove budget line ${index + 1}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus size={14} /> Add Row
      </button>

      <div className="w-full ">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
          Overhead % <span className="text-rose-500">*</span>
        </label>
        <input
          type="number" min="0" max="100" step="0.01" value={overheadPercent}
          onChange={(e) => onOverheadPercentChange(e.target.value)}
          className={FIELD_CLASS}
          aria-label="Overhead percentage"
          placeholder="0"
        />
        <p className="text-xs text-slate-400 mt-1">
          Applied to the sum of every checked row above.
        </p>
      </div>

      <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proposed Amount</div>
          <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(proposedAmount)}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overhead Amount</div>
          <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(overheadAmount)}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</div>
          <div className="text-lg font-extrabold text-violet-600 dark:text-violet-400">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      {yearsCount > 1 && overheadAmount > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Year-wise Overhead
          </div>
          <table className="w-full text-sm border-collapse w-full ">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {yearlyOverhead.map((_, i) => (
                  <th key={i} className="text-left pb-2 px-2">Year {i + 1}</th>
                ))}
                <th className="text-left pb-2 px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 dark:border-slate-800">
                {yearlyOverhead.map((amount, i) => (
                  <td key={i} className="py-2 px-2 tabular-nums">{formatCurrency(amount)}</td>
                ))}
                <td className="py-2 px-2 font-semibold tabular-nums">{formatCurrency(overheadAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
