export const LEAVE_TYPES = [
  { value: 'Annual', label: 'Casual Leave', entitledDays: 30 },
  { value: 'Special', label: 'Special Leave (conference)', entitledDays: 15 },
];

export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

/** BRD A3's rate. The server computes it; this is for display alongside. */
export const HRA_RATE = 0.20;

export const HRA_SLIP_NOTE =
  'An HRA slip must be uploaded before the HRA component can be claimed.';

/**
 * Spec D2. Stated on the claim form so a fellow understands why they are being
 * asked for figures that do not change the amount shown.
 */
export const LEAVE_REPORTING_NOTE =
  'Leave and absence are recorded on the claim and printed on the stipend form. ' +
  'They do not change the amount calculated here — the Principal Investigator ' +
  'decides the amount to recommend.';

/**
 * Pending days count against the balance, so two requests that each fit could
 * otherwise together exceed the allowance.
 */
export const PENDING_LEAVE_NOTE =
  'Leave you have applied for but which is not yet approved is counted against ' +
  'your remaining balance.';

export const HRA_OVERRIDE_NOTE =
  'This changes the amount paid to the fellow. A reason is required and is ' +
  'recorded against the claim with your name.';

export const ID_CARD_GATE_NOTE =
  'Fellowship claims and leave become available once your ID card has been issued.';
