using API.Domain.Enums;

namespace API.Application.Recruitment;

public record CreateRecruitmentInput(
    Guid ProjectId,
    Guid SanctionedManpowerPositionId);

/// <summary>
/// <paramref name="AdvertisementTemplateId"/> is optional: supplied, the
/// advertisement is rendered from that template's resolved sections and
/// <paramref name="Text"/> is replaced by a plain-text rendering of them;
/// omitted, <paramref name="Text"/> is stored verbatim exactly as before this
/// feature existed. <paramref name="FreeTextTokenValues"/> fills the
/// <c>{{Token}}</c> placeholders the template service could not resolve from
/// the recruitment's own entities.
/// </summary>
public record AdvertiseInput(
    Guid RecruitmentRequestId,
    DateOnly PublishedOn,
    DateOnly ClosingDate,
    string Text,
    string Remarks,
    Guid? AdvertisementTemplateId = null,
    IReadOnlyDictionary<string, string>? FreeTextTokenValues = null,
    string? RequiredQualifications = null,
    bool AllowDiplomaFor12th = true,
    bool RequireExperience = false,
    int MinExperienceMonths = 0,
    bool RequirePublications = false,
    bool RequireResume = true);

/// <summary>
/// Re-advertising records how many candidates the closing round drew, which is
/// the evidence for the BRD's "insufficient number of candidates" trigger.
/// </summary>
public record ReadvertiseInput(
    Guid RecruitmentRequestId,
    int CandidateCountAtClose,
    DateOnly PublishedOn,
    DateOnly ClosingDate,
    string Text,
    Guid? AdvertisementTemplateId = null,
    IReadOnlyDictionary<string, string>? FreeTextTokenValues = null,
    string? RequiredQualifications = null,
    bool AllowDiplomaFor12th = true,
    bool RequireExperience = false,
    int MinExperienceMonths = 0,
    bool RequirePublications = false,
    bool RequireResume = true);

/// <summary>
/// <paramref name="PrefillFromCandidateId"/> seeds the personal fields from one
/// of the applicant's own earlier applications. It must belong to the caller --
/// otherwise supplying someone else's id would disclose their details.
/// </summary>
public record ApplyInput(
    Guid RecruitmentRequestId,
    string FullName,
    string Mobile,
    string? Qualification,
    string? Experience,
    Guid? PrefillFromCandidateId);

public record SaveStep1PersonalInput(
    Guid CandidateId,
    string FullName,
    string Mobile,
    Gender? Gender,
    bool? IsMarried,
    DateOnly? DateOfBirth,
    string? FatherOrHusbandName,
    string? PresentAddress,
    string? PermanentAddress,
    string? Email,
    string? Nationality,
    CandidateCategory? Category,
    Guid? CategoryCertificateDocumentId,
    IdProofType? IdProofType = null,
    string? IdProofNumber = null,
    Guid? IdProofDocumentId = null);

public record SaveStep2QualificationsInput(
    Guid CandidateId,
    bool GateNetGpatQualified,
    string? GateNetGpatRollNo,
    int? GateNetGpatYear,
    string? GateNetGpatScore,
    IReadOnlyList<CandidateEducationInput> Education,
    Guid? GateNetGpatCertificateDocumentId = null);

public record CandidateEducationInput(
    Guid? Id,
    EducationLevel Level,
    string? OtherLevelName,
    string? Subject,
    string? BoardInstituteUniv,
    int? Year,
    string? MarksOrCgpa,
    string? Division,
    Guid? CertificateDocumentId);

public record SaveStep3ExperienceInput(
    Guid CandidateId,
    IReadOnlyList<CandidateExperienceInput> Experiences);

public record CandidateExperienceInput(
    Guid? Id,
    int SortOrder,
    string? Organization,
    string? Position,
    string? SalaryEmoluments,
    string? NatureOfDuties,
    string? NatureOfAppointment,
    int PeriodYears,
    int PeriodMonths,
    int PeriodDays,
    Guid? CertificateDocumentId);

public record SaveStep4PublicationsInput(
    Guid CandidateId,
    int SciJournalCount,
    int ScopusJournalCount,
    int NonSciJournalCount,
    int InternationalConfCount,
    int NationalConfCount,
    string? OtherInformation,
    bool WantsHigherDegreeRegistration,
    Guid? PublicationsDocumentId = null,
    string? PublicationName = null);

public record SaveStep5ResumeInput(
    Guid CandidateId,
    Guid? ResumeDocumentId = null,
    string? Remarks = null);

public record CommitteeMemberInput(
    CommitteeRole Role,
    string Name,
    string Department,
    string Position,
    bool IsExternal,
    Guid? ApplicationUserId = null,
    string? Email = null,
    bool IsOutsideInstitute = false,
    Guid? ConsentDocumentId = null);

public record RecordScreeningInput(
    Guid CandidateId,
    ScreeningResult Result,
    string? Remarks = null);

public record ScheduleInterviewInput(
    Guid RecruitmentRequestId,
    DateOnly InterviewDate,
    TimeOnly InterviewTime,
    string InterviewVenue);

public record SetInterviewModeInput(
    Guid CandidateId,
    InterviewMode Mode);

public record MeritRankInput(
    Guid CandidateId,
    int Rank);

public record IssueOfferInput(
    Guid CandidateId,
    decimal RecommendedStipend,
    DateOnly JoiningDate);

public record RecordJoiningInput(
    Guid CandidateId,
    DateOnly JoinedOn,
    DateOnly ValidTill,
    decimal RecommendedStipend,
    string? AadharNo,
    string? PanNo,
    string? BankAccountNo,
    string? IfscCode,
    DateOnly? Dob,
    Gender? Gender);

public record IssueIdCardInput(
    Guid ManpowerSelectionId,
    string IdCardNumber);

public record RecruitmentSummary(
    Guid Id,
    Guid ProjectId,
    Guid SanctionedManpowerPositionId,
    RecruitmentStage Stage,
    int AdvertisementRound,
    DateOnly? InterviewDate,
    TimeOnly? InterviewTime,
    string? InterviewVenue,
    int CandidateCount,
    DateTimeOffset CreatedAt,
    string? Designation = null,
    string? ProjectTitle = null,
    string? Text = null,
    DateOnly? ClosingDate = null,
    // Lets the recruitment-detail page fetch the advertisement's own workflow
    // instance (GET /api/workflow/{id}) to render its approval chain/timeline --
    // null until the PI has generated an advertisement at least once.
    Guid? AdvertisementWorkflowInstanceId = null,
    Guid? ScreeningCommitteeWorkflowInstanceId = null,
    Guid? SelectionCommitteeWorkflowInstanceId = null,
    // In-progress "Save as Draft" content -- null unless the PI has saved a
    // draft at least once. Takes priority over Text/ClosingDate when the
    // advertise-time editor reopens, since it represents newer in-progress
    // work than whatever was last actually submitted.
    string? DraftAdvertisementText = null,
    DateOnly? DraftClosingDate = null,
    // Lets the recruitment-detail page fetch the offer's own workflow
    // instance (GET /api/workflow/{id}) to render/drive its approval chain --
    // null until an offer has been proposed (IssueOfferLetterAsync) at least
    // once.
    Guid? OfferWorkflowInstanceId = null,
    // The candidate an offer is currently pending approval/response for --
    // needed because Candidate.Outcome isn't set to Selected until the offer
    // is actually released, so it can't be used to identify the pending
    // candidate while OfferPendingApproval/OfferIssued is in progress.
    Guid? PendingOfferCandidateId = null,
    string? RequiredQualifications = null,
    bool AllowDiplomaFor12th = true,
    bool RequireExperience = false,
    int MinExperienceMonths = 0,
    bool RequirePublications = false,
    bool RequireResume = true,
    string? DraftRequiredQualifications = null,
    bool? DraftAllowDiplomaFor12th = null,
    bool? DraftRequireExperience = null,
    int? DraftMinExperienceMonths = null,
    bool? DraftRequirePublications = null,
    bool? DraftRequireResume = null,
    decimal? RecommendedStipend = null,
    decimal? Stipend = null);

public record CandidateSummary(
    Guid Id,
    Guid RecruitmentRequestId,
    Guid ApplicationUserId,
    string FullName,
    string Mobile,
    string? Qualification,
    string? Experience,
    ScreeningResult? ScreeningResult,
    string? ScreeningRemarks,
    InterviewMode InterviewMode,
    int? MeritRank,
    CandidateOutcome Outcome,
    CandidateOfferResponse? OfferResponse,
    DateTimeOffset AppliedAt,
    // Added for Task 9: ListOwnApplicationsAsync is the only source the
    // applicant's own "My Applications" page has for telling a resumable
    // Draft apart from an already-Submitted application (ListCandidatesAsync,
    // the PI-facing caller of the same ToSummary projection, already filters
    // to Submitted-only server-side, so this is harmless there).
    ApplicationStatus ApplicationStatus,
    // Populated only by ListOwnApplicationsAsync (candidate's own applications
    // page needs to know when it has an offer and should prompt the candidate
    // to submit their joining report, and how their submission is progressing
    // through HOD/Dean review) -- null for every other caller of ToSummary,
    // which do not need it.
    RecruitmentStage? Stage = null,
    decimal? RecommendedStipend = null,
    decimal? Stipend = null);

public record CandidateFullDetail(
    CandidateSummary Summary,
    CandidateDraftDetail Detail);

/// <summary>One row of a draft's academic-record or work-experience table, as
/// read back by <see cref="CandidateDraftDetail"/>. Deliberately separate from
/// the API layer's CandidateEducationBody/CandidateExperienceBody contracts --
/// API.Application does not reference API.Contracts -- but field-for-field
/// identical so the controller can project one into the other trivially.</summary>
public record CandidateEducationDetail(
    Guid Id,
    EducationLevel Level,
    string? OtherLevelName,
    string? Subject,
    string? BoardInstituteUniv,
    int? Year,
    string? MarksOrCgpa,
    string? Division,
    Guid? CertificateDocumentId);

public record CandidateExperienceDetail(
    Guid Id,
    int SortOrder,
    string? Organization,
    string? Position,
    string? SalaryEmoluments,
    string? NatureOfDuties,
    string? NatureOfAppointment,
    int PeriodYears,
    int PeriodMonths,
    int PeriodDays,
    Guid? CertificateDocumentId);

/// <summary>
/// Full current state of one application in progress, consumed only by the
/// frontend wizard's review step (Task 9) -- every field the save-step
/// endpoints accept, read back so the applicant can confirm what will be
/// submitted before they submit it.
/// </summary>
public record CandidateDraftDetail(
    Guid Id,
    Guid RecruitmentRequestId,
    ApplicationStatus ApplicationStatus,
    string FullName,
    string Mobile,
    Gender? Gender,
    bool? IsMarried,
    DateOnly? DateOfBirth,
    string? FatherOrHusbandName,
    string? PresentAddress,
    string? PermanentAddress,
    string? Email,
    string? Nationality,
    CandidateCategory? Category,
    Guid? CategoryCertificateDocumentId,
    bool GateNetGpatQualified,
    string? GateNetGpatRollNo,
    int? GateNetGpatYear,
    string? GateNetGpatScore,
    IReadOnlyList<CandidateEducationDetail> Education,
    IReadOnlyList<CandidateExperienceDetail> Experiences,
    int SciJournalCount,
    int ScopusJournalCount,
    int NonSciJournalCount,
    int InternationalConfCount,
    int NationalConfCount,
    string? OtherInformation,
    bool WantsHigherDegreeRegistration,
    Guid? PhotoDocumentId,
    DateTimeOffset? DeclarationAcceptedAt,
    IdProofType? IdProofType = null,
    string? IdProofNumber = null,
    Guid? IdProofDocumentId = null,
    Guid? GateNetGpatCertificateDocumentId = null,
    Guid? PublicationsDocumentId = null,
    Guid? ResumeDocumentId = null,
    string? Remarks = null,
    Guid? SignatureDocumentId = null,
    string? PublicationName = null);

public record CommitteeMemberSummary(
    Guid Id,
    CommitteeKind Kind,
    CommitteeRole Role,
    string Name,
    string Department,
    string Position,
    bool IsExternal,
    DateOnly? AvailabilityDate,
    Guid? ApplicationUserId,
    string? Email,
    bool IsOutsideInstitute,
    Guid? ConsentDocumentId,
    bool IsSelectedByDean = false);

/// <summary>
/// One entry in the committee-member picker: a real login account, so
/// ApplicationUserId is always a genuine ApplicationUser.Id and a member
/// picked from this list can later sign the merit list under their own
/// account (see CommitteeMember.ApplicationUserId's own remarks). Deliberately
/// NOT sourced from FacultyProfiles -- that table's UserId is a legacy import
/// key (plain employee numbers, or malformed strings), not a real account id,
/// and using it here produced applicationUserId values the backend could not
/// even parse as a Guid.
///
/// <see cref="Designation"/> is the one exception: it IS looked up from
/// FacultyProfiles, but safely -- joined by FacultyProfile.ApplicationUserId
/// (the real, nullable back-link set once an account holder completes their
/// own profile), never by the legacy UserId key. Null whenever no profile is
/// linked yet; the picker (CommitteeForm.jsx) leaves it editable in that case
/// rather than blocking the pick.
/// </summary>
public record FacultyDirectoryEntry(Guid Id, string FullName, string? Email, string? Department, string? Designation, Guid? DepartmentId = null);

/// <summary>
/// The joining report a PI submitted for one candidate, read back for HOD/
/// Dean review -- the counterpart to RecordJoiningInput/SubmitJoiningReportAsync.
/// </summary>
public record JoiningReportDetail(
    Guid CandidateId,
    DateOnly JoinedOn,
    DateOnly ValidTill,
    decimal RecommendedStipend,
    string? AadharNo,
    string? PanNo,
    string? BankAccountNo,
    string? IfscCode,
    DateOnly? Dob,
    Gender? Gender,
    // The two documents SaveJoiningReportAsync required before this report
    // could even be submitted -- surfaced here so PI/HOD/Dean review can
    // view/download them (Document ids, owned by this same CandidateId),
    // null only if a pre-existing joining record predates this gate.
    Guid? SignedOfferLetterDocumentId = null,
    Guid? ContractOfEngagementDocumentId = null);

public record JoiningQueueItemSummary(
    Guid CandidateId,
    Guid RecruitmentRequestId,
    string ReferenceNo,
    string CandidateName,
    string Designation,
    decimal StipendAmount,
    decimal HraAmount,
    string Department,
    string ProjectTitle,
    string PiName,
    int MeritRank,
    DateOnly? InterviewDate,
    DateOnly JoiningDate,
    string CommitteeChair,
    string Status,
    DateTimeOffset SubmittedAt);
