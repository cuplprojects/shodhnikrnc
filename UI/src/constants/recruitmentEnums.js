export const RECRUITMENT_STAGES = {
  Draft: 'Draft',
  Advertised: 'Advertised',
  ScreeningInProgress: 'Screening in progress',
  SelectionScheduled: 'Selection scheduled',
  MeritListPrepared: 'Merit list prepared',
  Approved: 'Approved',
  OfferIssued: 'Offer issued',
  Joined: 'Joined',
  Closed: 'Closed',
};

/** Terminal and in-flight stages read differently at a glance. */
export const RECRUITMENT_STAGE_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  Advertised: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  Joined: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export const DEFAULT_STAGE_STYLE =
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';

export const SCREENING_RESULTS = [
  { value: 'Eligible', label: 'Eligible' },
  { value: 'Ineligible', label: 'Not eligible' },
];

export const INTERVIEW_MODES = [
  { value: 'Offline', label: 'Offline' },
  { value: 'Online', label: 'Online (needs Dean approval)' },
];

export const CANDIDATE_OUTCOMES = {
  Pending: 'Under consideration',
  NotSelected: 'Not selected',
  Selected: 'Selected',
};

export const COMMITTEE_KINDS = [
  { value: 'Screening', label: 'Screening Committee' },
  { value: 'Selection', label: 'Selection Committee' },
];

/**
 * BRD A2 composition. The server validates these on submission; the labels here
 * exist so the form can explain what is required rather than only rejecting it.
 *
 * All slots -- including the Dean's screening nominee (Member 3) and the two
 * selection nominees (Members 3-4) -- are entered together in one
 * CommitteeForm submission (client request, 2026-09-16). Only Member 1
 * (Chairman) and Member 2 are actually required by the server; Member 3
 * (Screening) and Members 3-4 (Selection) are optional rows the form adds by
 * default so the PI/HoD can fill them in immediately if already known, without
 * a second, separate nominate step -- SubmitCommitteeAsync already accepts and
 * validates these roles in the same call as Chairman/Co-PI/PI (see its own
 * remarks), so no backend change was needed for this.
 */
export const SCREENING_ROLES = [
  { value: 'Chairman', label: 'Member 1 — Chairman (Principal Investigator)' },
  { value: 'CoPrincipalInvestigator', label: 'Member 2 — Co-Principal Investigator' },
  { value: 'NominatedFaculty', label: 'Member 3 — Nominated Faculty (Dean)' },
];

export const SELECTION_ROLES = [
  { value: 'Chairman', label: 'Member 1 — Chairman (Head of Department)' },
  { value: 'PrincipalInvestigator', label: 'Member 2 — Principal Investigator' },
  { value: 'InternalNominee', label: 'Member 3 — Nominated Faculty' },
  { value: 'ExternalNominee', label: 'Member 4 — Nominated Faculty' },
];

export const SCREENING_COMPOSITION_NOTE =
  'Requires exactly one Chairman (the PI) and the Co-PI. Member 3 (the Dean’s nominee) can be added ' +
  'now if already known, or left for later — it does not block saving Members 1-2.';

export const SELECTION_COMPOSITION_NOTE =
  'Requires exactly one Chairman (the HoD) and the PI. Members 3-4 — at least one from outside the ' +
  'PI’s department — can be added now if already known, or left for later.';

export const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export const PAYMENT_MODES = [
  { value: 'Neft', label: 'NEFT' },
  { value: 'Rtgs', label: 'RTGS' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'DemandDraft', label: 'Demand Draft' },
  { value: 'Other', label: 'Other' },
];

/**
 * The offer letter is blocked until the project has a grant receipt carrying a
 * NEFT/RTGS transaction number. Shown where an offer is raised so the reason is
 * visible before the server rejects it.
 */
export const PAYMENT_GATE_NOTE =
  'An offer letter can only be issued once a grant receipt with its NEFT/RTGS ' +
  'transaction number has been recorded for this project.';

export const CANDIDATE_CATEGORIES = [
  { value: 'General', label: 'General (GEN)' },
  { value: 'OBC_NCL', label: 'OBC (Non-Creamy Layer)' },
  { value: 'OBC', label: 'OBC' },
  { value: 'SC', label: 'Scheduled Caste (SC)' },
  { value: 'ST', label: 'Scheduled Tribe (ST)' },
  { value: 'EWS', label: 'Economically Weaker Section (EWS)' },
  { value: 'PH', label: 'Persons with Disabilities (PwD / PH)' },
];

export const CANDIDATE_CATEGORY_LABELS = Object.fromEntries(
  CANDIDATE_CATEGORIES.map((c) => [c.value, c.label])
);

export const NATIONALITIES = [
  { value: 'Indian', label: 'Indian' },
  { value: 'OciPio', label: 'OCI / PIO' },
  { value: 'ForeignNational', label: 'Foreign National / Other' },
];

export const NATIONALITY_LABELS = Object.fromEntries(
  NATIONALITIES.map((n) => [n.value, n.label])
);

export const ID_PROOF_TYPES = [
  { value: 'AadhaarCard', label: 'Aadhaar Card' },
  { value: 'Passport', label: 'Passport' },
  { value: 'DrivingLicence', label: 'Driving Licence' },
  { value: 'VoterId', label: 'Voter ID' },
  { value: 'PanCard', label: 'PAN Card' },
];

export const ID_PROOF_TYPE_LABELS = Object.fromEntries(
  ID_PROOF_TYPES.map((i) => [i.value, i.label])
);

export const EDUCATION_LEVELS = [
  { value: 'Tenth', label: '10th / Secondary' },
  { value: 'Twelfth', label: '12th / Higher Secondary' },
  { value: 'Diploma', label: 'Diploma' },
  { value: 'Undergraduate', label: 'Undergraduate (UG / B.Tech / B.Sc)' },
  { value: 'Postgraduate', label: 'Postgraduate (PG / M.Tech / M.Sc)' },
  { value: 'Doctorate', label: 'Doctorate (Ph.D.)' },
  { value: 'PostDoctoral', label: 'Post-Doctoral' },
  { value: 'Other', label: 'Other Qualification / Degree' },
];

export const LEVEL_RANK = {
  Tenth: 1,
  Twelfth: 2,
  Diploma: 3,
  Undergraduate: 4,
  Postgraduate: 5,
  Doctorate: 6,
  PostDoctoral: 7,
  Other: 8,
};

export function sortEducationRows(educationList) {
  if (!educationList || !Array.isArray(educationList)) return [];
  return [...educationList].sort(
    (a, b) => (LEVEL_RANK[a.level] ?? 99) - (LEVEL_RANK[b.level] ?? 99)
  );
}

export const EDUCATION_LEVEL_LABELS = Object.fromEntries(
  EDUCATION_LEVELS.map((e) => [e.value, e.label])
);

export const ACADEMIC_DIVISIONS = [
  { value: 'FirstClassWithDistinction', label: 'First Class with Distinction' },
  { value: 'FirstClass', label: 'First Division / Class' },
  { value: 'SecondClass', label: 'Second Division / Class' },
  { value: 'ThirdClassPass', label: 'Third Division / Pass' },
  { value: 'GradeOrOther', label: 'Grade / CGPA / Other' },
];

export const ACADEMIC_DIVISION_LABELS = Object.fromEntries(
  ACADEMIC_DIVISIONS.map((d) => [d.value, d.label])
);

export const APPOINTMENT_NATURES = [
  { value: 'RegularPermanent', label: 'Regular / Permanent' },
  { value: 'Contractual', label: 'Contractual' },
  { value: 'TemporaryAdhoc', label: 'Temporary / Ad-hoc' },
  { value: 'ProjectStaff', label: 'Project Staff (JRF / SRF / RA)' },
  { value: 'GuestVisitingFaculty', label: 'Guest / Visiting Faculty' },
  { value: 'IndustryCorporate', label: 'Industry / Corporate' },
  { value: 'Other', label: 'Other' },
];

export const APPOINTMENT_NATURE_LABELS = Object.fromEntries(
  APPOINTMENT_NATURES.map((a) => [a.value, a.label])
);

export const NATIONAL_EXAMS = [
  { value: 'GATE', label: 'GATE' },
  { value: 'CSIR_UGC_NET_JRF', label: 'CSIR-UGC NET (JRF)' },
  { value: 'CSIR_UGC_NET_LS', label: 'CSIR-UGC NET (Lectureship / Assistant Professor)' },
  { value: 'UGC_NET_JRF', label: 'UGC-NET (JRF)' },
  { value: 'UGC_NET_LS', label: 'UGC-NET (Assistant Professor)' },
  { value: 'GPAT', label: 'GPAT' },
  { value: 'ICMR_JRF', label: 'ICMR-JRF' },
  { value: 'ICAR_NET', label: 'ICAR-NET' },
  { value: 'OtherNationalExam', label: 'Other National Examination' },
];

export const NATIONAL_EXAM_LABELS = Object.fromEntries(
  NATIONAL_EXAMS.map((e) => [e.value, e.label])
);

export const HIGHER_DEGREES = [
  { value: 'PhD', label: 'Ph.D.' },
  { value: 'MTech', label: 'M.Tech.' },
  { value: 'MSByResearch', label: 'M.S. (by Research)' },
  { value: 'Other', label: 'Other Degree' },
];

export const HIGHER_DEGREE_LABELS = Object.fromEntries(
  HIGHER_DEGREES.map((d) => [d.value, d.label])
);

const CURRENT_YEAR = new Date().getFullYear();

export const PASSING_YEARS = Array.from(
  { length: CURRENT_YEAR - 1960 + 1 },
  (_, i) => String(CURRENT_YEAR - i)
);

export const SCHOOL_BOARDS = [
  { value: 'CBSE', label: 'Central Board of Secondary Education (CBSE)' },
  { value: 'CISCE / ICSE / ISC', label: 'CISCE / ICSE / ISC' },
  { value: 'UP Board', label: 'Uttar Pradesh State Board (UPMSP)' },
  { value: 'Bihar Board (BSEB)', label: 'Bihar School Examination Board (BSEB)' },
  { value: 'Maharashtra State Board', label: 'Maharashtra State Board (MSBSHSE)' },
  { value: 'Rajasthan Board (RBSE)', label: 'Rajasthan Board of Secondary Education (RBSE)' },
  { value: 'Madhya Pradesh Board (MPBSE)', label: 'Madhya Pradesh Board (MPBSE)' },
  { value: 'West Bengal Board', label: 'West Bengal Board (WBBSE / WBCHSE)' },
  { value: 'Haryana Board (HBSE)', label: 'Board of School Education Haryana (HBSE)' },
  { value: 'Punjab School Education Board (PSEB)', label: 'Punjab School Education Board (PSEB)' },
  { value: 'Tamil Nadu State Board', label: 'Tamil Nadu State Board' },
  { value: 'Karnataka State Board', label: 'Karnataka State Examination Board (KSEEB)' },
  { value: 'Andhra Pradesh Board', label: 'Andhra Pradesh Board (BIEAP / BSEAP)' },
  { value: 'Telangana Board', label: 'Telangana Board (TSBIE / BSE)' },
  { value: 'Gujarat Board (GSHSEB)', label: 'Gujarat State Board (GSHSEB)' },
  { value: 'Kerala Board', label: 'Kerala State Education Board' },
  { value: 'Odisha Board (BSE / CHSE)', label: 'Odisha Board (BSE / CHSE)' },
  { value: 'Assam Board (SEBA / AHSEC)', label: 'Assam State Board (SEBA / AHSEC)' },
  { value: 'Jharkhand Academic Council (JAC)', label: 'Jharkhand Academic Council (JAC)' },
  { value: 'Uttarakhand Board (UBSE)', label: 'Uttarakhand Board of School Education (UBSE)' },
  { value: 'Chhattisgarh Board (CGBSE)', label: 'Chhattisgarh Board (CGBSE)' },
  { value: 'Himachal Pradesh Board (HPBOSE)', label: 'Himachal Pradesh Board (HPBOSE)' },
  { value: 'Jammu & Kashmir Board (JKBOSE)', label: 'J&K Board of School Education (JKBOSE)' },
  { value: 'NIOS', label: 'National Institute of Open Schooling (NIOS)' },
  { value: 'Cambridge / IGCSE / IB', label: 'International (IB / Cambridge IGCSE)' },
  { value: 'Other State Board', label: 'Other State Board' },
];

export const UNIVERSITIES_INSTITUTES = [
  { value: 'MNNIT Allahabad', label: 'Motilal Nehru National Institute of Technology Allahabad (MNNIT)' },
  { value: 'IIT Bombay', label: 'IIT Bombay' },
  { value: 'IIT Delhi', label: 'IIT Delhi' },
  { value: 'IIT Kanpur', label: 'IIT Kanpur' },
  { value: 'IIT Kharagpur', label: 'IIT Kharagpur' },
  { value: 'IIT Madras', label: 'IIT Madras' },
  { value: 'IIT Roorkee', label: 'IIT Roorkee' },
  { value: 'IIT (BHU) Varanasi', label: 'IIT (BHU) Varanasi' },
  { value: 'IIT Guwahati', label: 'IIT Guwahati' },
  { value: 'Other IIT', label: 'Other Indian Institute of Technology (IIT)' },
  { value: 'NIT Trichy', label: 'NIT Trichy' },
  { value: 'NIT Surathkal', label: 'NIT Surathkal' },
  { value: 'NIT Rourkela', label: 'NIT Rourkela' },
  { value: 'NIT Warangal', label: 'NIT Warangal' },
  { value: 'NIT Calicut', label: 'NIT Calicut' },
  { value: 'Other NIT', label: 'Other National Institute of Technology (NIT)' },
  { value: 'IIIT Allahabad', label: 'Indian Institute of Information Technology Allahabad (IIIT-A)' },
  { value: 'Other IIIT', label: 'Other Indian Institute of Information Technology (IIIT)' },
  { value: 'IISc Bangalore', label: 'Indian Institute of Science Bangalore (IISc)' },
  { value: 'IISER', label: 'Indian Institute of Science Education & Research (IISER)' },
  { value: 'BITS Pilani', label: 'Birla Institute of Technology and Science (BITS Pilani)' },
  { value: 'University of Delhi (DU)', label: 'University of Delhi (DU)' },
  { value: 'Banaras Hindu University (BHU)', label: 'Banaras Hindu University (BHU)' },
  { value: 'Aligarh Muslim University (AMU)', label: 'Aligarh Muslim University (AMU)' },
  { value: 'Jawaharlal Nehru University (JNU)', label: 'Jawaharlal Nehru University (JNU)' },
  { value: 'University of Allahabad', label: 'University of Allahabad' },
  { value: 'University of Hyderabad', label: 'University of Hyderabad' },
  { value: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU / UPTU)', label: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU / UPTU)' },
  { value: 'Anna University', label: 'Anna University' },
  { value: 'Visvesvaraya Technological University (VTU)', label: 'Visvesvaraya Technological University (VTU)' },
  { value: 'Gujarat Technological University (GTU)', label: 'Gujarat Technological University (GTU)' },
  { value: 'Savitribai Phule Pune University', label: 'Savitribai Phule Pune University' },
  { value: 'University of Mumbai', label: 'University of Mumbai' },
  { value: 'University of Calcutta', label: 'University of Calcutta' },
  { value: 'Jadavpur University', label: 'Jadavpur University' },
  { value: 'Other Central University', label: 'Other Central University' },
  { value: 'Other State University', label: 'Other State University / Board' },
  { value: 'Other Deemed / Private University', label: 'Other Deemed / Private University' },
  { value: 'Foreign / International University', label: 'Foreign / International University' },
];

