export const TRAVELER_TYPES = [
  { value: 'Self', label: 'Self (Principal Investigator)' },
  { value: 'Manpower', label: 'Project Manpower' },
  { value: 'CoPi', label: 'Co-Principal Investigator' },
  { value: 'Other', label: 'Other' },
];

/** Labels match legacy's travel_by display strings. */
export const TRAVEL_MODES = [
  { value: 'Air', label: 'Air' },
  { value: 'Rail', label: 'Rail' },
  { value: 'RoadPrivateTaxi', label: 'Road: Private Taxi' },
  { value: 'RoadPersonalCar', label: 'Road: Personal Car' },
  { value: 'RoadCommonTransport', label: 'Road: Common Transport Mode' },
  { value: 'Other', label: 'Other' },
];

export const BOOKING_PLATFORMS = [
  { value: 'IRCTC', label: 'IRCTC' },
  { value: 'AshokaTravel', label: 'Ashoka Travel' },
  { value: 'BalmerLawrie', label: 'Balmer Lawrie' },
  { value: 'Other', label: 'Other' },
];

/** Leg mode options: does not include Other as requested */
export const LEG_TRAVEL_MODES = TRAVEL_MODES.filter((m) => m.value !== 'Other');

/** Eligible platforms for Air tickets (no Other allowed for Air) */
export const AIR_BOOKING_PLATFORMS = BOOKING_PLATFORMS.filter((p) => p.value !== 'Other');

/** Legacy alias */
export const LEG_BOOKING_PLATFORMS = AIR_BOOKING_PLATFORMS;

/** Shown at claim time, as the BRD requires. */
export const BOOKING_PLATFORM_DISCLAIMER =
  'Eligible booking platforms in case of air tickets: IRCTC, Ashoka Travel, Balmer Lawrie. Air ticket bookings made through other platforms will not be considered.';

/**
 * The BRD makes this a one-shot decision: taxi reimbursement not selected at
 * submission is not considered later. The server enforces it; this text exists
 * so the user knows before submitting.
 */
export const TAXI_OPT_IN_NOTICE =
  'If taxi travel option is not selected during claim submission, taxi travel reimbursement shall not be considered. A strong mandatory reason must be provided.';

export const TRAVEL_BUDGET_HEAD = 'RecurringTravel';

export function computeTravelTotal(journeys, accommodationCost, otherExpensesCost) {
  const legs = (journeys ?? []).reduce((sum, leg) => {
    const amount = Number(leg.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const accommodation = Number(accommodationCost);
  const other = Number(otherExpensesCost);

  return (
    legs +
    (Number.isFinite(accommodation) ? accommodation : 0) +
    (Number.isFinite(other) ? other : 0)
  );
}
