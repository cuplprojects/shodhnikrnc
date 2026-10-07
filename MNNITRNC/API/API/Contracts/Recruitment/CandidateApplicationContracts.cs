using API.Domain.Enums;

namespace API.Contracts.Recruitment;

public record SaveStep1PersonalRequestBody(
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

public record CandidateEducationBody(
    Guid? Id,
    EducationLevel Level,
    string? OtherLevelName,
    string? Subject,
    string? BoardInstituteUniv,
    int? Year,
    string? MarksOrCgpa,
    string? Division,
    Guid? CertificateDocumentId);

public record SaveStep2QualificationsRequestBody(
    Guid CandidateId,
    bool GateNetGpatQualified,
    string? GateNetGpatRollNo,
    int? GateNetGpatYear,
    string? GateNetGpatScore,
    IReadOnlyList<CandidateEducationBody> Education,
    Guid? GateNetGpatCertificateDocumentId = null);

public record CandidateExperienceBody(
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

public record SaveStep3ExperienceRequestBody(
    Guid CandidateId,
    IReadOnlyList<CandidateExperienceBody> Experiences);

public record SaveStep4PublicationsRequestBody(
    Guid CandidateId,
    int SciJournalCount,
    int ScopusJournalCount,
    int NonSciJournalCount,
    int InternationalConfCount,
    int NationalConfCount,
    string? PublicationName,
    string? OtherInformation,
    bool WantsHigherDegreeRegistration,
    Guid? PublicationsDocumentId = null);

public record SaveStep5ResumeRequestBody(
    Guid CandidateId,
    Guid? ResumeDocumentId = null,
    string? Remarks = null);

/// <summary>Body of POST /api/candidates/{id}/submit. Carries the photograph and
/// signature Document ids, uploaded on the review step after the last save-step call.</summary>
public record SubmitDraftRequestBody(Guid? PhotoDocumentId, Guid? SignatureDocumentId = null);

/// <summary><paramref name="SourceCandidateId"/> must be one of the caller's own
/// earlier applications; the service rejects anything else.</summary>
public record PrefillRequest(Guid SourceCandidateId);
