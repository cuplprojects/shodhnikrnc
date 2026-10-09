/**
 * Maps each navigable page key to the accordion category it appears under in
 * the sidebar. Purely a display grouping -- it has no bearing on access
 * control, which is still decided entirely by the API's page grants.
 *
 * A page key with no entry here falls into "General" (see CATEGORY_ORDER's
 * fallback in Sidebar.jsx) rather than being silently dropped, so a newly
 * added page still appears in the sidebar even if this map is not updated
 * for it right away.
 */
export const PAGE_CATEGORIES = {
  'dashboard.home': 'General',
  'travel.detail': 'General',

  'recruitment.list': 'Recruitment',
  'recruitment.advertisement-rnc-queue': 'Recruitment',
  'recruitment.advertisement-cc-queue': 'Recruitment',
  'applications.mine': 'Recruitment',

  'proposals.list': 'Proposal',
  'proposals-hod.queue': 'Proposal',
  'proposals-rnc.queue': 'Proposal',
  'grant-receipts-hod.queue': 'Proposal',
  'projects.reappropriations-queue': 'Proposal',
  'grant-receipts-rnc.queue': 'Proposal',
  'grant-receipts-da.queue': 'Proposal',
  'grant-receipts-superintendent.queue': 'Proposal',
  'grant-receipts-dr.queue': 'Proposal',
  'grant-receipts-dean.queue': 'Proposal',
  'projects.list': 'Proposal',
  'expenditure.details': 'Reports',
  'expenditure.add-grant': 'Proposal',
  'project-types.type1': 'Proposal',
  'project-types.type2': 'Proposal',
  'project-types.type3': 'Proposal',
  'project-types.type4': 'Proposal',
  'project-types.type5': 'Proposal',

  'process-bill.list': 'Payment',
  'hod.indents': 'Payment',
  'queues.assigned': 'Payment',
  'queues.processed': 'Payment',
  'queues.approved': 'Payment',
  'queues.forwarded': 'Payment',
  'payments.update': 'Payment',
  'payment.voucher': 'Payment',
  'noting.page': 'Payment',

  'fellowship.claims': 'Fellowship & Leave',
  'hod.fellowships': 'Fellowship & Leave',
  'hod.leaves': 'Fellowship & Leave',
  'hod.joining': 'Fellowship & Leave',
  'leave.requests': 'Fellowship & Leave',
  'travel.requests': 'Fellowship & Leave',
  'hod.travels': 'Fellowship & Leave',
  'noc.requests': 'Fellowship & Leave',
  'experience-certificate.requests': 'Fellowship & Leave',
  'medical-facility.requests': 'Fellowship & Leave',
  'id-card.requests': 'Fellowship & Leave',

  'hod.dashboard': 'HOD Portal',
  'hod.consultancy': 'HOD Portal',
  'hod.overhead': 'HOD Portal',

  'faculty-admin.create': 'Office Admin',
  'content.news': 'Office Admin',
  'content.announcements': 'Office Admin',
  'content.funding-agencies': 'Office Admin',
  'content.departments': 'Office Admin',
  'offer-letters.manpower': 'Office Admin',
  'offer-letters.view-generated': 'Office Admin',
  'office-expenditure.view': 'Office Admin',
  'projects.historical-entries': 'Office Admin',

  'reports.number-of-projects': 'Reports',
  'reports.grant-sanctioned': 'Reports',
  'reports.project-expenditure': 'Reports',
  'reports.project-overhead': 'Reports',
  'reports.refunds': 'Reports',
  'reports.staff-count': 'Reports',
  'reports.project-equipment': 'Reports',
  'reports.recruitment-funnel': 'Reports',

  'workflow-config.routes': 'Admin',
  'access-config.roles': 'Admin',
  'admin.users.manage': 'Admin',
};

export const DEFAULT_CATEGORY = 'General';

/** Fixed display order for categories; anything unlisted sorts after these. */
export const CATEGORY_ORDER = [
  'General',
  'Proposal',
  'Payment',
  'Recruitment',
  'Fellowship & Leave',
  'HOD Portal',
  'Reports',
  'Office Admin',
  'Admin',
];
