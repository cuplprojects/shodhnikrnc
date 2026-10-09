export const INDENT_TYPES = [
  { value: 'Consumable', label: 'Consumable', apiSegment: 'consumable-indents', requestType: 'Consumable' },
  { value: 'Contingency', label: 'Contingency', apiSegment: 'contingency-indents', requestType: 'Contingency' },
  { value: 'Equipment', label: 'Equipment', apiSegment: 'equipment-indents', requestType: 'Equipment' },
  { value: 'Travel', label: 'Travel', apiSegment: 'travel-requests', requestType: 'Travel' },
];

export const GEM_AVAILABILITY = [
  { value: 'Yes', label: 'Available on GeM' },
  { value: 'No', label: 'Not available on GeM' },
];

export const COMMITTEE_ROLES = [
  { value: 'Chairperson', label: 'Chairperson (HoD)' },
  { value: 'FacultyMember', label: 'Faculty Member' },
  { value: 'Indenter', label: 'Indenter' },
  { value: 'RnCRepresentative', label: 'AR (R&C) / Dy. Registrar' },
  { value: 'AdminRepresentative', label: 'AR (Admin-III)' },
  { value: 'FinanceRepresentative', label: 'FIP' },
];

export const PROCUREMENT_TIERS = {
  GemRule149: { label: 'GeM Rule 149 / Direct Purchase', annexure: 'GeM' },
  GemL1: { label: 'GeM L1 Buying', annexure: 'GeM' },
  GemBidding: { label: 'GeM Bidding', annexure: 'GeM' },
  NonGemRule154: { label: 'Rule 154 — Direct Purchase', annexure: 'Non-GeM' },
  NonGemRule155: { label: 'Rule 155', annexure: 'Non-GeM' },
};

/** Only this tier prints a committee roster (Annexure 11). */
export const COMMITTEE_TIER = 'NonGemRule155';

export const WORKFLOW_STAGE_LABELS = {
  // Candidate -> PI -> HOD -> Clerk -> OSRC -> DR -> Dean flow mappings
  Raised: 'Raised',
  WithPI: 'PI',
  WithPIFellowship: 'PI',
  WithPIAdvertisement: 'PI',
  WithPITravel: 'With PI',
  Draft: 'Draft',

  SignedCopyUploaded: 'HOD',
  WithHOD: 'HOD',
  WithHODFellowship: 'HOD',
  WithHODGrantReceipt: 'HOD',
  IndentWithHOD: 'HOD',

  Assigned: 'Clerk',
  AssignedToDealingAssistant: 'Clerk',
  IndentAssignedToDA: 'Clerk',
  AssignedToDAGrantReceipt: 'Clerk',

  Forwarded: 'OSRC',
  WithSuperintendent: 'OSRC',
  WithRnCOffice: 'OSRC',
  WithRnCOfficeGrantReceipt: 'OSRC',
  IndentWithRnCOffice: 'OSRC',
  IndentWithSuperintendent: 'OSRC',
  WithSuperintendentGrantReceipt: 'OSRC',

  ForwardedOSRC: 'DR',
  WithDeputyRegistrar: 'DR',
  IndentWithDeputyRegistrar: 'DR',
  WithDeputyRegistrarGrantReceipt: 'DR',

  ForwardedDR: 'Dean',
  Director: 'Dean',
  WithDean: 'Dean',
  WithDeanFellowship: 'Dean',
  WithDeanGrantReceipt: 'Dean',
  IndentWithDean: 'Dean',

  Approved: 'Approved',
  IndentApproved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',

  ReturnedToPI: 'Returned to PI',
  ReturnedByHODToPI: 'Returned to PI',
  ReturnedByDeanToPI: 'Returned to PI',
  ReturnedToPIAdvertisement: 'Returned to PI',
  ReturnedToPIGrantReceipt: 'Returned to PI',
  IndentReturnedToPI: 'Returned to PI',
};

const BIDDING_THRESHOLD = 2_500_000;

/**
 * Mirrors the server's tier rules for display only. The server recomputes the
 * tier on every raise, so this never determines what is submitted — it exists so
 * the user can see which annexure they are about to generate before submitting.
 *
 * Returns null when the cost is not yet a usable number, or 'BiddingRequired'
 * when a non-GeM cost exceeds the supported ceiling.
 */
export function computeTierPreview(gemAvailability, estimatedCost) {
  const cost = Number(estimatedCost);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  if (gemAvailability === 'Yes') {
    if (cost <= 50_000) return 'GemRule149';
    if (cost <= 10_00_000) return 'GemL1';
    return 'GemBidding';
  }

  if (cost > BIDDING_THRESHOLD) return 'BiddingRequired';
  if (cost <= 2_00_000) return 'NonGemRule154';
  return 'NonGemRule155';
}
