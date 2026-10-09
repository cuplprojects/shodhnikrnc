import { apiBlob, apiGet, apiPost, apiPostText, apiPut } from './apiClient';

// --- Applicant account (anonymous) -----------------------------------------

export const registerApplicant = (payload) =>
  apiPost('/api/auth/register', payload);

export const confirmEmail = (payload) =>
  apiPost('/api/auth/confirm-email', payload);

export const resendVerification = (email) =>
  apiPost('/api/auth/resend-verification', { email });

// --- PI-facing --------------------------------------------------------------

export const listRecruitmentsForProject = (projectId) =>
  apiGet(`/api/projects/${projectId}/recruitments`);

/** The PI's recruitments across all of their projects. */
export const listMyRecruitments = () =>
  apiGet('/api/my/recruitments');

export const listFacultyBrief = () =>
  apiGet('/api/faculty-users/brief');

// Real login accounts (ApplicationUser), for the committee-member picker --
// unlike listFacultyBrief above, every entry's `id` is a genuine account id
// that can later sign the merit list. Do not use listFacultyBrief for a
// picker whose selection is submitted back to the server as an id.
// Pass departmentId to scope the list to one department (the "within
// department" / "outside department, then pick a department" picker flow).
export const listFacultyDirectory = (departmentId) =>
  apiGet(departmentId ? `/api/recruitments/faculty-directory?departmentId=${departmentId}` : '/api/recruitments/faculty-directory');

export const createRecruitment = (projectId, payload) =>
  apiPost(`/api/projects/${projectId}/recruitments`, payload);

export const getRecruitment = (recruitmentId) =>
  apiGet(`/api/recruitments/${recruitmentId}`);

export const advertise = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/advertise`, payload);

/** Saves in-progress advertisement text so it survives closing the modal -- no workflow, no approval routing. */
export const saveAdvertisementDraft = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/advertisement-draft`, payload);

/** Renders the given (possibly unsaved) text through the real advertisement layout, as an HTML string. Persists nothing. */
export const previewAdvertisement = (recruitmentId, payload) =>
  apiPostText(`/api/recruitments/${recruitmentId}/advertisement-preview`, payload);

/** Live entity-bound token values (project title, PI name, salary figures, etc.) for the "Insert field" editor toolbar. */
export const getAdvertisementTokenValues = (recruitmentId) =>
  apiGet(`/api/recruitments/${recruitmentId}/advertisement-token-values`);

export const uploadAdvertisementImage = (recruitmentId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost(`/api/recruitments/${recruitmentId}/advertisement-images`, formData);
};

export const readvertise = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/readvertise`, payload);

export const listCandidates = (recruitmentId) =>
  apiGet(`/api/recruitments/${recruitmentId}/candidates`);

export const listCandidateDetails = (recruitmentId) =>
  apiGet(`/api/recruitments/${recruitmentId}/candidates/details`);

export const listCommittee = (recruitmentId, kind) =>
  apiGet(`/api/recruitments/${recruitmentId}/committee?kind=${kind}`);

export const submitScreeningCommittee = (recruitmentId, members) =>
  apiPost(`/api/recruitments/${recruitmentId}/screening-committee`, { members });

export const submitSelectionCommittee = (recruitmentId, members) =>
  apiPost(`/api/recruitments/${recruitmentId}/selection-committee`, { members });

// --- Screening/Selection Committee formation workflow (PI -> Dean) ---------

/**
 * PI submits the Screening Committee for the Dean's approval. The server
 * auto-adds the PI (Chairman) and Co-PI (if any) and forwards to the Dean to
 * nominate the one additional member -- no member list is sent here.
 */
export const submitScreeningCommitteeForApproval = (recruitmentId) =>
  apiPost(`/api/recruitments/${recruitmentId}/screening-committee/submit-for-approval`, {});

/** Dean only: nominates the additional Screening Committee member and approves. */
export const assignScreeningCommitteeMember = (recruitmentId, nominee) =>
  apiPost(`/api/recruitments/${recruitmentId}/screening-committee/assign`, { nominee });

/**
 * PI submits the Selection Committee for the Dean's approval: an optional
 * PI-chosen member plus 3-5 recommended members for the Dean to choose from.
 * The server auto-adds PI and HOD.
 */
export const submitSelectionCommitteeForApproval = (recruitmentId, optionalMember, recommendedMembers) =>
  apiPost(`/api/recruitments/${recruitmentId}/selection-committee/submit-for-approval`, {
    optionalMember, recommendedMembers,
  });

/** Dean only: picks one of the 3-5 recommended members to finalize the Selection Committee, and approves. */
export const selectSelectionCommitteeMember = (recruitmentId, selectedCommitteeMemberId) =>
  apiPost(`/api/recruitments/${recruitmentId}/selection-committee/select`, {
    selectedCommitteeMemberId,
  });

/** Dean only: returns the Selection Committee submission to the PI for edits. Remarks are required. */
export const returnSelectionCommittee = (recruitmentId, remarks) =>
  apiPost(`/api/recruitments/${recruitmentId}/selection-committee/return`, { remarks });

export const recordScreeningResult = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/screening-result`, payload);

export const setNomineeAvailability = (memberId, availabilityDate) =>
  apiPost(`/api/recruitments/committee-members/${memberId}/availability`, { availabilityDate });

export const scheduleInterview = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/interview`, payload);

/** Idempotent -- candidates already notified are silently skipped server-side. */
export const sendNotEligibleNotifications = (recruitmentId) =>
  apiPost(`/api/recruitments/${recruitmentId}/screening/send-not-eligible-notifications`, {});

export const setInterviewMode = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/interview-mode`, payload);

export const submitMeritList = (recruitmentId, ranks) =>
  apiPost(`/api/recruitments/${recruitmentId}/merit-list`, { ranks });

/** Dean only. */
export const approveMeritList = (recruitmentId) =>
  apiPost(`/api/recruitments/${recruitmentId}/approve`, {});

export const issueOffer = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/offer`, payload);

/** RegularStaff only. Releases an offer once its approval chain is Approved. */
export const releaseOffer = (recruitmentId) =>
  apiPost(`/api/recruitments/${recruitmentId}/offer/release`, {});

/** Candidate's own action on an issued offer. */
export const acceptOffer = (candidateId) =>
  apiPost(`/api/recruitments/candidates/${candidateId}/offer/accept`, {});

export const declineOffer = (candidateId) =>
  apiPost(`/api/recruitments/candidates/${candidateId}/offer/decline`, {});

/** Manual escape hatch when no candidate accepted the offer. */
export const markNoCandidateAccepted = (recruitmentId) =>
  apiPost(`/api/recruitments/${recruitmentId}/no-candidate-accepted`, {});

export const recordJoining = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/joining`, payload);

export const submitJoiningReport = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/joining/submit`, payload);

// The joining details a PI already submitted for one candidate -- so HOD/
// Dean can see what they're verifying/approving, and so the panel's state
// survives a reload/different device instead of living only in the browser
// that submitted it.
export const getJoiningReport = (candidateId) =>
  apiGet(`/api/recruitments/candidates/${candidateId}/joining`);

export const listJoiningQueue = () =>
  apiGet('/api/recruitments/joining-queue');

/** The PI's own forward of the candidate's submitted joining report to HOD. */
export const forwardJoiningReportToHod = (candidateId, remarks = '') =>
  apiPost(`/api/recruitments/joining/${candidateId}/forward-to-hod`, { remarks });

export const forwardJoiningReport = (candidateId, remarks = '') =>
  apiPost(`/api/recruitments/joining/${candidateId}/forward`, { remarks });

export const approveJoiningReport = (candidateId, remarks = '') =>
  apiPost(`/api/recruitments/joining/${candidateId}/approve`, { remarks });

export const returnJoiningReport = (candidateId, remarks = '') =>
  apiPost(`/api/recruitments/joining/${candidateId}/return`, { remarks });

// --- Advertisement approval chain (PI -> RnC office -> Computer Centre) -----

export const forwardAdvertisement = (recruitmentId, remarks) =>
  apiPost(`/api/recruitments/${recruitmentId}/advertisement/forward`, { remarks: remarks || null });

export const approveAdvertisement = (recruitmentId, remarks) =>
  apiPost(`/api/recruitments/${recruitmentId}/advertisement/approve`, { remarks: remarks || null });

export const rejectAdvertisement = (recruitmentId, remarks) =>
  apiPost(`/api/recruitments/${recruitmentId}/advertisement/reject`, { remarks: remarks || null });

export const returnAdvertisement = (recruitmentId, remarks) =>
  apiPost(`/api/recruitments/${recruitmentId}/advertisement/return`, { remarks: remarks || null });

/** Recruitments whose advertisement is awaiting the RnC office's action. */
export const listAdvertisementRnCQueue = () =>
  apiGet('/api/recruitments/advertisement-rnc-queue');

/** Recruitments whose advertisement is awaiting the Computer Centre's action. */
export const listComputerCentreAdvertisementQueue = () =>
  apiGet('/api/recruitments/advertisement-cc-queue');

/** Recruitments this Computer Centre user has already published. */
export const listComputerCentreAdvertisementHistory = () =>
  apiGet('/api/recruitments/advertisement-cc-history');

export const approveInterviewMode = (candidateId, mode) =>
  apiPost(`/api/recruitments/candidates/${candidateId}/interview-mode/approve`, { mode });

export const nominateScreeningFaculty = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/screening-committee/nominate`, payload);

export const issueIdCard = (fellowAppointmentId, idCardNumber) =>
  apiPost(`/api/fellow-appointments/${fellowAppointmentId}/id-card`, { idCardNumber });

// --- Applicant-facing -------------------------------------------------------

export const listOpenRecruitments = () =>
  apiGet('/api/recruitments/open');

export const applyToRecruitment = (recruitmentId, payload) =>
  apiPost(`/api/recruitments/${recruitmentId}/apply`, payload);

/**
 * The applicant's own applications. Also the only legitimate source of candidate
 * ids for prefill -- the server rejects a prefill id belonging to anyone else.
 */
export const listMyApplications = () =>
  apiGet('/api/my/applications');

/** The candidate's own joining-report submission, once their offer is issued. */
export const submitMyJoiningReport = (candidateId, payload) =>
  apiPost(`/api/my/applications/${candidateId}/joining`, payload);

// --- Application wizard (multi-step draft flow) -----------------------------

/** Resumes the applicant's own live Draft for this recruitment, or creates one. */
export const startOrResumeDraft = (recruitmentId) =>
  apiPost(`/api/recruitments/${recruitmentId}/draft`);

/**
 * Starts (or resumes) a Draft for `recruitmentId` and copies every field from
 * `sourceCandidateId` (one of the caller's own earlier applications) into it.
 */
export const prefillDraft = (recruitmentId, sourceCandidateId) =>
  apiPost(`/api/recruitments/${recruitmentId}/draft/prefill`, { sourceCandidateId });

export const saveStep1Personal = (payload) =>
  apiPut('/api/candidates/draft/step1', payload);

export const saveStep2Qualifications = (payload) =>
  apiPut('/api/candidates/draft/step2', payload);

export const saveStep3Experience = (payload) =>
  apiPut('/api/candidates/draft/step3', payload);

export const saveStep4Publications = (payload) =>
  apiPut('/api/candidates/draft/step4', payload);

export const saveStep5Resume = (payload) =>
  apiPut('/api/candidates/draft/step5', payload);

/** Full current state of one still-Draft application, for the review step. */
export const getOwnDraft = (candidateId) =>
  apiGet(`/api/candidates/${candidateId}/draft`);

/**
 * Submits the draft. `photoDocumentId` is the passport photograph uploaded on
 * the review step -- it is the only field captured at submit time rather than
 * by a save-step call, and the server ignores a null so a resubmit never clears
 * an already-attached photo.
 */
export const submitDraft = (candidateId, photoDocumentId = null, signatureDocumentId = null) =>
  apiPost(`/api/candidates/${candidateId}/submit`, { photoDocumentId, signatureDocumentId });

// --- Documents --------------------------------------------------------------

/**
 * Recruitment documents are rendered on demand rather than stored, because they
 * reflect the live state of the drive. Returns a blob URL the caller must
 * revoke once the download has been triggered.
 */
export const RECRUITMENT_DOCUMENTS = [
  { kind: 'Advertisement', label: 'Advertisement' },
  { kind: 'ScreeningProforma', label: 'Screening Committee Proforma' },
  { kind: 'MinutesOfSelection', label: 'Minutes of Selection' },
  { kind: 'MeritList', label: 'Merit List' },
  { kind: 'OfferLetter', label: 'Offer Letter' },
  { kind: 'JoiningLetter', label: 'Joining Letter' },
];

export async function downloadRecruitmentDocument(recruitmentId, kind, params = {}) {
  const query = new URLSearchParams(params).toString();
  const urlPath = `/api/recruitments/${recruitmentId}/documents/${kind}` + (query ? `?${query}` : '');
  const blob = await apiBlob(urlPath);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const getDocumentData = (recruitmentId, kind) =>
  apiGet(`/api/recruitments/${recruitmentId}/documents/${kind}/data`);

export const saveDocumentData = (recruitmentId, kind, data) =>
  apiPost(`/api/recruitments/${recruitmentId}/documents/${kind}/data`, data);

export const getOfferLetterData = (recruitmentId) =>
  apiGet(`/api/recruitments/${recruitmentId}/offer-letter-data`);

