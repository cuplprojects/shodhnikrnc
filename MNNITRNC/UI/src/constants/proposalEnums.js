import { BUDGET_HEAD_NAMES } from './projectEnums';

/** Reused so proposal budget lines pick from the same head names a Project uses. */
export { BUDGET_HEAD_NAMES };

/**
 * WorkflowStage values the proposal chain uses, mirrored from the backend
 * enum (API.Domain.Enums.WorkflowStage) -- append-only there, so this must
 * stay in sync by hand rather than by codegen.
 */
export const PROPOSAL_STAGE_LABELS = {
  Draft: 'Draft',
  WithHOD: 'With HOD',
  WithRnCOffice: 'With R&C Office',
  AssignedToDealingAssistant: 'With Dealing Assistant',
  WithSuperintendent: 'With Superintendent',
  WithDeputyRegistrar: 'With Deputy Registrar',
  WithDean: 'With Dean',
  Approved: 'Approved',
  ReturnedToPI: 'Returned to PI',
};

const STAGE_STYLE_APPROVED =
  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
const STAGE_STYLE_RETURNED =
  'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
const STAGE_STYLE_DRAFT =
  'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
const STAGE_STYLE_DEFAULT =
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

export const PROPOSAL_STAGE_STYLES = {
  Draft: STAGE_STYLE_DRAFT,
  Approved: STAGE_STYLE_APPROVED,
  ReturnedToPI: STAGE_STYLE_RETURNED,
};

export function proposalStageStyle(stage) {
  return PROPOSAL_STAGE_STYLES[stage] ?? STAGE_STYLE_DEFAULT;
}

/** ProposalStatus values (API.Domain.Enums.ProposalStatus), append-only. */
export const PROPOSAL_STATUS_LABELS = {
  Draft: 'Draft',
  UnderApproval: 'Under Approval',
  Approved: 'Approved (internal)',
  SubmittedToAgency: 'Submitted to Agency',
  Sanctioned: 'Sanctioned',
  NotFunded: 'Not Funded',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
};

const STATUS_STYLE_GOOD =
  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
const STATUS_STYLE_BAD =
  'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
const STATUS_STYLE_NEUTRAL =
  'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
const STATUS_STYLE_PROGRESS =
  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';

export const PROPOSAL_STATUS_STYLES = {
  Draft: STATUS_STYLE_NEUTRAL,
  UnderApproval: STATUS_STYLE_PROGRESS,
  Approved: STATUS_STYLE_PROGRESS,
  SubmittedToAgency: STATUS_STYLE_PROGRESS,
  Sanctioned: STATUS_STYLE_GOOD,
  NotFunded: STATUS_STYLE_BAD,
  Rejected: STATUS_STYLE_BAD,
  Withdrawn: STATUS_STYLE_NEUTRAL,
};

export function proposalStatusStyle(status) {
  return PROPOSAL_STATUS_STYLES[status] ?? STATUS_STYLE_NEUTRAL;
}

/**
 * Which stages a PI may act at (submit from Draft, forward from Draft or
 * ReturnedToPI, both PI-only stages the backend enforces by ownership -- see
 * ResearchProposalService.ForwardAsync's ownership check for roleless stages).
 */
export const PI_ACTIONABLE_STAGES = new Set(['Draft', 'ReturnedToPI']);

/** Stages the RnC office roles (RegularStaff/Superintendent/DeputyRegistrar/Dean) forward through. */
export const OFFICE_ROLES = ['Dean', 'DeputyRegistrar', 'Superintendent', 'RegularStaff'];
