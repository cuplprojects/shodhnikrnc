import { apiBlob, apiGet } from './apiClient';

/**
 * The BRD Prompt 6 reports (ReportsController) plus Recruitment Funnel.
 * Each JSON fetch and its matching Excel/PDF export hit the exact same GET
 * endpoint -- the only
 * difference is a `format` query param, per the backend's own RespondAsync
 * short-circuit (format=excel|pdf returns a file, anything else returns the
 * JSON rows). from/to are ISO date strings (e.g. "2025-01-01") and are
 * omitted from the query entirely when not set, rather than sent empty.
 */

const REPORT_PATHS = {
  'number-of-projects': '/api/reports/number-of-projects',
  'grant-sanctioned': '/api/reports/grant-sanctioned',
  'project-expenditure': '/api/reports/project-expenditure',
  'view-transaction-details': '/api/reports/view-transaction-details',
  'project-overhead': '/api/reports/project-overhead',
  refunds: '/api/reports/refunds',
  'staff-count': '/api/reports/staff-count',
  'project-equipment': '/api/reports/project-equipment',
  'recruitment-funnel': '/api/reports/recruitment-funnel',
};

/** Staff Count is a snapshot -- it takes no from/to, per StaffCountAsync. */
export const DATE_FILTERABLE_REPORTS = new Set(
  Object.keys(REPORT_PATHS).filter((key) => key !== 'staff-count'),
);

function buildQuery({ format, projectId, from, to } = {}) {
  const params = new URLSearchParams();
  if (format) params.append('format', format);
  if (projectId) params.append('projectId', projectId);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** JSON rows for the given report key, optionally date-filtered. */
export function getReport(reportKey, { projectId, from, to } = {}) {
  const path = REPORT_PATHS[reportKey];
  if (!path) throw new Error(`Unknown report: ${reportKey}`);
  return apiGet(`${path}${buildQuery({ projectId, from, to })}`);
}

const EXTENSIONS = { excel: 'xlsx', pdf: 'pdf' };

/**
 * Downloads the report as Excel or PDF, reusing fellowshipApi.js's
 * downloadStipendForm blob-download pattern exactly (apiBlob -> object URL ->
 * synthetic anchor click).
 */
export async function downloadReport(reportKey, format, { projectId, from, to } = {}) {
  const path = REPORT_PATHS[reportKey];
  if (!path) throw new Error(`Unknown report: ${reportKey}`);

  const blob = await apiBlob(`${path}${buildQuery({ format, projectId, from, to })}`);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportKey}.${EXTENSIONS[format] ?? format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
