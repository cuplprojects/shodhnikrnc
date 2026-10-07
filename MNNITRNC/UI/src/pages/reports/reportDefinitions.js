import { formatCurrency } from '../projects/utils/currency';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
}

/**
 * One entry per ReportsController action / ReportDtos.cs row shape. `key`
 * matches the route segment and the PageCatalogue page key suffix
 * (reports.{key}) exactly, and is what reportsApi.js's REPORT_PATHS is keyed
 * on. `columns` describe how to render each DTO field -- camelCase JSON
 * versions of the C# record properties.
 */
export const REPORT_DEFINITIONS = [
  {
    key: 'number-of-projects',
    title: 'Number of Projects',
    description: 'Project counts grouped by project type and department.',
    dateFilterable: true,
    rowKey: (r, i) => `${r.departmentId}-${r.projectType}-${i}`,
    columns: [
      { header: 'Project Type', render: (r) => r.projectType },
      { header: 'Department', render: (r) => r.departmentName },
      { header: 'Count', render: (r) => r.count, align: 'right' },
    ],
  },
  {
    key: 'grant-sanctioned',
    title: 'Grant Sanctioned',
    description: 'Project-wise grant sanctioned amounts.',
    dateFilterable: true,
    rowKey: (r) => r.projectId,
    columns: [
      { header: 'Project', render: (r) => r.projectTitle },
      { header: 'Agency', render: (r) => r.agency },
      { header: 'Sanction Date', render: (r) => formatDate(r.sanctionDate) },
      { header: 'Total Sanctioned', render: (r) => formatCurrency(r.totalSanctioned), align: 'right' },
    ],
  },
  {
    key: 'project-expenditure',
    title: 'Project-wise Expenditure',
    description: 'Expenditure per project, broken down by budget head and project year.',
    dateFilterable: true,
    rowKey: (r, i) => `${r.projectId}-${r.headName}-${r.projectYear}-${i}`,
    columns: [
      { header: 'Project', render: (r) => r.projectTitle },
      { header: 'Budget Head', render: (r) => r.headName },
      { header: 'Project Year', render: (r) => r.projectYear },
      { header: 'Amount', render: (r) => formatCurrency(r.amount), align: 'right' },
    ],
  },
  {
    key: 'project-overhead',
    title: 'Project-wise Overhead',
    description: 'Overhead receipts per project (Idf/Pdf/Ddf split).',
    dateFilterable: true,
    rowKey: (r, i) => `${r.projectId}-${r.subHead}-${i}`,
    columns: [
      { header: 'Project', render: (r) => r.projectTitle },
      { header: 'Sub-head', render: (r) => r.subHead },
      { header: 'Received', render: (r) => formatDate(r.receivedDate) },
      { header: 'Amount', render: (r) => formatCurrency(r.amount), align: 'right' },
    ],
  },
  {
    key: 'refunds',
    title: 'Refund Reports',
    description: 'Refunds recorded against projects.',
    dateFilterable: true,
    rowKey: (r, i) => `${r.projectId}-${r.refundDate}-${i}`,
    columns: [
      { header: 'Project', render: (r) => r.projectTitle },
      { header: 'Amount', render: (r) => formatCurrency(r.amount), align: 'right' },
      { header: 'Refund Date', render: (r) => formatDate(r.refundDate) },
      { header: 'Reason', render: (r) => r.reason },
    ],
  },
  {
    key: 'staff-count',
    title: 'Staff Count',
    description: 'Current staff counts by role and department (a snapshot -- not date-filterable).',
    dateFilterable: false,
    rowKey: (r, i) => `${r.departmentId}-${r.role}-${i}`,
    columns: [
      { header: 'Role', render: (r) => r.role },
      { header: 'Department', render: (r) => r.departmentName },
      { header: 'Count', render: (r) => r.count, align: 'right' },
    ],
  },
  {
    key: 'project-equipment',
    title: 'Project-wise Equipment List',
    description: 'Sanctioned equipment per project.',
    dateFilterable: true,
    rowKey: (r, i) => `${r.projectId}-${r.equipmentName}-${i}`,
    columns: [
      { header: 'Project', render: (r) => r.projectTitle },
      { header: 'Equipment', render: (r) => r.equipmentName },
      { header: 'Unit', render: (r) => r.unit },
      { header: 'Amount', render: (r) => formatCurrency(r.amount), align: 'right' },
    ],
  },
  {
    key: 'recruitment-funnel',
    title: 'Recruitment Funnel',
    description: 'Applicants per recruitment drive, broken down by screening and selection outcome.',
    dateFilterable: true,
    rowKey: (r, i) => `${r.projectId}-${i}`,
    columns: [
      { header: 'Project', render: (r) => r.projectTitle },
      { header: 'Department', render: (r) => r.departmentName },
      { header: 'Applied', render: (r) => r.applied, align: 'right' },
      { header: 'Screened Eligible', render: (r) => r.screenedEligible, align: 'right' },
      { header: 'Screened Ineligible', render: (r) => r.screenedIneligible, align: 'right' },
      { header: 'Selected', render: (r) => r.selected, align: 'right' },
      { header: 'Not Selected', render: (r) => r.notSelected, align: 'right' },
      { header: 'Pending', render: (r) => r.pending, align: 'right' },
      { header: 'Stage', render: (r) => r.latestStage },
    ],
  },
];

export const REPORT_BY_KEY = Object.fromEntries(REPORT_DEFINITIONS.map((r) => [r.key, r]));
