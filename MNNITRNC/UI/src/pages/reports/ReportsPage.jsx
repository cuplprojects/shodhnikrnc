import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getReport } from '../../api/reportsApi';
import { REPORT_DEFINITIONS, REPORT_BY_KEY } from './reportDefinitions';
import DateRangeFilter from './components/DateRangeFilter';
import ExportButtons from './components/ExportButtons';
import ReportTable from './components/ReportTable';

/**
 * The seven BRD Prompt 6 reports (ReportsController), sharing one page.
 *
 * A single tabbed page reads cleaner than seven near-identical files here:
 * every report is the same shape (a data table), driven by the same
 * date-filter/export mechanics, differing only in which columns render and
 * whether date-filtering applies (Staff Count is a snapshot). Seven copies
 * of that chrome would just be seven places to keep the loading/error/empty
 * states and export wiring in sync. The route still carries the report key
 * (`/reports/:reportKey`, matching PageCatalogue's seeded per-report routes
 * exactly), so each report is still its own sidebar link, its own guarded
 * route, and its own browser-back-able URL -- only the component is shared.
 */
export default function ReportsPage() {
  const { reportKey: routeKey } = useParams();
  const navigate = useNavigate();
  const reportKey = routeKey && REPORT_BY_KEY[routeKey] ? routeKey : REPORT_DEFINITIONS[0].key;
  const definition = REPORT_BY_KEY[reportKey];

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const params = definition.dateFilterable ? { from: from || undefined, to: to || undefined } : {};
    setRows(await getReport(reportKey, params) ?? []);
  }, [reportKey, definition.dateFilterable, from, to]);

  useEffect(() => {
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsLoading(true);
    setError(null);
    load()
      .catch((err) => { if (active) setError(err.message ?? 'Failed to load report.'); })
      .finally(() => { if (active) setIsLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { active = false; };
  }, [load]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Reports</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Research track reporting -- projects, grants, expenditure and staff.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {REPORT_DEFINITIONS.map((def) => (
          <button
            key={def.key}
            type="button"
            onClick={() => navigate(`/reports/${def.key}`)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
              def.key === reportKey
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {def.title}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{definition.title}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{definition.description}</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          {definition.dateFilterable ? (
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          ) : <div />}
          <ExportButtons reportKey={reportKey} from={definition.dateFilterable ? from : undefined} to={definition.dateFilterable ? to : undefined} />
        </div>

        <ReportTable definition={definition} rows={rows} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}
