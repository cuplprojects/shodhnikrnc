const CENTS_TOLERANCE = 0.01;

function lineTotal(line) {
  return line.yearAmounts.reduce((sum, a) => sum + (Number(a) || 0), 0);
}

function findLineTotalsByYear(budgetLines, headName) {
  const line = budgetLines.find((l) => l.headName === headName);
  return line ? line.yearAmounts.map((a) => Number(a) || 0) : [];
}

/**
 * Runs the three pre-submit checks the proposal budget-form-fixes spec
 * describes as UI-only validation:
 *   1. No two budget lines share (headName, customLabel).
 *   2. Equipment total === EquipmentNonRecurring budget line total.
 *   3. Manpower per-year totals === RecurringManpower budget line's
 *      per-year amounts.
 * Returns the first failing message, or null if everything checks out.
 */
export function validateProposalBudget({ budgetLines, equipment, manpower }) {
  const seen = new Set();
  for (const line of budgetLines) {
    const normalizedLabel = (line.customLabel || '').trim().toUpperCase();
    const key = `${line.headName}::${normalizedLabel}`;
    if (seen.has(key)) {
      return line.headName === 'Other'
        ? `Two budget lines are both labeled "${line.customLabel}" — each Other line needs a distinct label.`
        : `Two budget lines both use head "${line.headName}" — each head may appear only once.`;
    }
    seen.add(key);
  }

  const equipmentTotal = equipment.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const equipmentNonRecurringTotal = findLineTotalsByYear(budgetLines, 'EquipmentNonRecurring')
    .reduce((sum, a) => sum + a, 0);
  if (Math.abs(equipmentTotal - equipmentNonRecurringTotal) > CENTS_TOLERANCE) {
    return `Equipment items total ₹${equipmentTotal.toFixed(2)} but the Equipment/Non-recurring ` +
      `budget line totals ₹${equipmentNonRecurringTotal.toFixed(2)} — they must match.`;
  }

  const recurringManpowerByYear = findLineTotalsByYear(budgetLines, 'RecurringManpower');
  const yearsCount = recurringManpowerByYear.length;
  for (let year = 0; year < yearsCount; year++) {
    const manpowerTotalForYear = manpower.reduce((sum, m) => {
      const positions = Number(m.positions) || 0;
      const hraPercent = Number(m.hraPercent) || 0;
      const monthly = Number(m.stipendByYear?.[year]) || 0;
      return sum + positions * (monthly + (monthly * hraPercent) / 100) * 12;
    }, 0);
    const recurringManpowerForYear = recurringManpowerByYear[year] ?? 0;
    if (Math.abs(manpowerTotalForYear - recurringManpowerForYear) > CENTS_TOLERANCE) {
      return `Manpower totals ₹${manpowerTotalForYear.toFixed(2)} for Year ${year + 1} but the ` +
        `Recurring: Manpower budget line totals ₹${recurringManpowerForYear.toFixed(2)} for that year — they must match.`;
    }
  }

  return null;
}
