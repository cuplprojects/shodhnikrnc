const LABEL_CLASS = 'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide';
const FIELD_CLASS = 'mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 '
  + 'bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 '
  + 'focus:outline-none focus:ring-2 focus:ring-blue-500';

/**
 * From/to date pickers for the six date-filterable reports. Staff Count is a
 * snapshot with no date params (StaffCountAsync takes none), so the caller
 * simply does not render this component for that report rather than this
 * component disabling itself.
 */
export default function DateRangeFilter({ from, to, onFromChange, onToChange }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="report-from">From</label>
        <input
          id="report-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label className={LABEL_CLASS} htmlFor="report-to">To</label>
        <input
          id="report-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
    </div>
  );
}
