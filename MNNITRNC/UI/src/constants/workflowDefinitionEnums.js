/**
 * Mirrors API.Domain.Enums.WorkflowStage. The API serialises enums as names, so
 * these strings are the wire format, not display sugar.
 */
export const WORKFLOW_STAGES = [
  { value: 'Raised', label: 'Raised' },
  { value: 'SignedCopyUploaded', label: 'Indent Raised Uploaded' },
  { value: 'Assigned', label: 'Assigned to Staff' },
  { value: 'Forwarded', label: 'Forwarded' },
  { value: 'ForwardedOSRC', label: 'Forwarded to Deputy Registrar' },
  { value: 'ForwardedDR', label: 'Forwarded to Dean' },
  { value: 'Director', label: 'With the Director' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export const WORKFLOW_STAGE_ROLE_MAP = {
  // PI / Requester
  'Raised': 'PI',
  'Draft': 'PI (Draft)',
  'WithPI': 'PI',
  'ReturnedToPI': 'Returned to PI',
  'ReturnedByHODToPI': 'Returned to PI',
  'ReturnedByDeanToPI': 'Returned to PI',
  'ReturnedToPIAdvertisement': 'Returned to PI',
  'ReturnedToPIGrantReceipt': 'Returned to PI',
  'IndentReturnedToPI': 'Returned to PI',
  'WithPITravel': 'PI',
  'WithPIFellowship': 'PI',
  'WithPIAdvertisement': 'PI',

  // HOD
  'SignedCopyUploaded': 'With HOD',
  'WithHOD': 'With HOD',
  'WithHODFellowship': 'With HOD',
  'WithHODGrantReceipt': 'With HOD',
  'IndentWithHOD': 'With HOD',

  // Dealing Assistant / Staff / R&C Office
  'Assigned': 'R&C Office',
  'AssignedToDealingAssistant': 'Dealing Assistant (DA)',
  'IndentAssignedToDA': 'Dealing Assistant (DA)',
  'AssignedToDAGrantReceipt': 'Dealing Assistant (DA)',
  'WithRnCOffice': 'R&C Office',
  'WithRnCOfficeGrantReceipt': 'R&C Office',
  'IndentWithRnCOffice': 'R&C Office',
  'WithRnCOfficeAdvertisement': 'R&C Office',

  // Superintendent
  'Forwarded': 'Superintendent',
  'WithSuperintendent': 'Superintendent',
  'IndentWithSuperintendent': 'Superintendent',
  'WithSuperintendentGrantReceipt': 'Superintendent',

  // Deputy Registrar
  'ForwardedOSRC': 'Deputy Registrar (DR)',
  'WithDeputyRegistrar': 'Deputy Registrar (DR)',
  'IndentWithDeputyRegistrar': 'Deputy Registrar (DR)',
  'WithDeputyRegistrarGrantReceipt': 'Deputy Registrar (DR)',

  // Dean / Director
  'ForwardedDR': 'Dean (R&C)',
  'WithDean': 'Dean (R&C)',
  'WithDeanFellowship': 'Dean (R&C)',
  'WithDeanGrantReceipt': 'Dean (R&C)',
  'IndentWithDean': 'Dean (R&C)',
  'Director': 'With Director',

  // Computer Centre
  'WithComputerCentre': 'Computer Centre',

  // Terminal
  'Approved': 'Approved',
  'IndentApproved': 'Approved',
  'Rejected': 'Rejected',
  'Cancelled': 'Cancelled',
};

export const getStageDisplayLabel = (stage) => {
  if (!stage) return 'PI';
  if (WORKFLOW_STAGE_ROLE_MAP[stage]) return WORKFLOW_STAGE_ROLE_MAP[stage];
  return stage.replace(/([A-Z])/g, ' $1').trim();
};

export const stageLabel = (value) =>
  WORKFLOW_STAGE_ROLE_MAP[value] ?? WORKFLOW_STAGES.find((s) => s.value === value)?.label ?? value;

/**
 * The roles a stage can be assigned to. Matches DbSeeder's list.
 *
 * SuperAdmin is deliberately absent: it configures routes rather than acting on
 * requests, and granting it a stage would blur the separation the role exists
 * to draw.
 */
export const ASSIGNABLE_ROLES = [
  'Faculty',
  'RegularStaff',
  'Superintendent',
  'DeputyRegistrar',
  'Dean',
  'Director',
  'Fellow',
  'Applicant',
];

export const NO_ROLES_NOTE =
  'A stage with no roles is not restricted — it belongs to whoever raised the request. '
  + 'It does not mean nobody can act.';

export const SEQUENCE_NOTE =
  'Stages run in the order shown. Forwarding moves a request to the next stage down, '
  + 'so the order is the route itself.';

export const LIVE_INSTANCE_NOTE =
  'A stage cannot be removed while requests are sitting on it — they would be stranded '
  + 'with no way forward.';

export const CONCLUDE_NOTE =
  'At least one stage must be able to approve, or requests on this route can never be completed.';
