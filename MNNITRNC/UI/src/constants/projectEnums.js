export const PROJECT_TYPES = [
  { value: 'TypeIResearch', label: 'Type-I: Research Projects' },
  { value: 'TypeIIIndustrySponsored', label: 'Type-II: Industry Sponsored Projects' },
  { value: 'TypeIIIConsultancy', label: 'Type-III: Consultancy Project' },
  { value: 'TypeIVTesting', label: 'Type IV: Testing' },
  { value: 'TypeVOther', label: 'Type V: Other Activities' },
];

export const BUDGET_HEAD_NAMES = [
  { value: 'EquipmentNonRecurring', label: 'Equipment/Non-recurring' },
  { value: 'RecurringConsumable', label: 'Recurring: Consumable' },
  { value: 'RecurringContingency', label: 'Recurring: Contingency' },
  { value: 'RecurringTravel', label: 'Recurring: Travel' },
  { value: 'RecurringOverhead', label: 'Recurring: Overhead' },
  { value: 'RecurringFieldCharges', label: 'Recurring: Field Charges' },
  { value: 'RecurringManpower', label: 'Recurring: Manpower' },
  { value: 'Other', label: 'Other' },
];

export const OVERHEAD_SUB_HEADS = [
  { value: 'Ddf', label: 'DDF (20%)' },
  { value: 'Pdf', label: 'PDF (40%)' },
  { value: 'Idf', label: 'IDF (40%)' },
];

export const OVERHEAD_HEAD_VALUE = 'RecurringOverhead';

export const ACTION_LABELS = {
  Raise: "Raised",
  UploadSignedCopy: "Indent Raised Uploaded",
  Assign: "Assigned",
  Forward: "Forwarded",
  Approve: "Approved",
  Reject: "Rejected",
  ForwardToDirector: "Sent to Director",
  Cancel: "Cancelled",
};

export const ACTION_COLORS = {
  Raise: "bg-blue-600 dark:bg-blue-500",
  UploadSignedCopy: "bg-sky-600 dark:bg-sky-500",
  Assign: "bg-indigo-600 dark:bg-indigo-500",
  Forward: "bg-violet-600 dark:bg-violet-500",
  Approve: "bg-emerald-600 dark:bg-emerald-500",
  Reject: "bg-rose-600 dark:bg-rose-500",
  ForwardToDirector: "bg-amber-500 dark:bg-amber-400",
  Cancel: "bg-slate-500 dark:bg-slate-400",
};

export const getBudgetHeadDisplay = (headName, customLabel) => {
  if (customLabel && customLabel.trim()) return customLabel.trim();
  const found = BUDGET_HEAD_NAMES.find(n => n.value === headName || n.label === headName);
  return found ? found.label : (headName || 'Unknown budget head');
};
