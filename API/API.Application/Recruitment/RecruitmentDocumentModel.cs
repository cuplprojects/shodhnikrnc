namespace API.Application.Recruitment;

/// <summary>
/// Flat view of everything the recruitment templates print, assembled by
/// <see cref="RecruitmentDocumentModelFactory"/> so templates never touch
/// entities or the database.
/// </summary>
public record RecruitmentDocumentModel(
    string ProjectTitle,
    string Agency,
    string SanctionNo,
    string PiName,
    string PiDesignation,
    string PiDepartment,
    string Designation,
    int Positions,
    decimal Stipend,
    decimal Hra,
    int AdvertisementRound,
    DateOnly? PublishedOn,
    DateOnly? ClosingDate,
    string? AdvertisementText,
    DateOnly? InterviewDate,
    TimeOnly? InterviewTime,
    string? InterviewVenue,
    IReadOnlyList<RecruitmentCandidateRow> Candidates,
    IReadOnlyList<RecruitmentCommitteeRow> ScreeningCommittee,
    IReadOnlyList<RecruitmentCommitteeRow> SelectionCommittee,
    string? CoPiName = null,
    IReadOnlyList<ResolvedAdvertisementSectionModel>? ResolvedAdvertisementSections = null);

/// <summary>
/// A resolved advertisement template section as the Advertisement template
/// prints it. A plain data-carrying twin of
/// <see cref="ResolvedAdvertisementSection"/> so this model -- which every
/// recruitment document shares -- carries no dependency on the template
/// service's own contracts; <see cref="RecruitmentService"/> maps between the
/// two at the call site.
/// </summary>
public record ResolvedAdvertisementSectionModel(
    API.Domain.Enums.AdvertisementSectionKey Key, string Content, bool IsIncluded);

public record RecruitmentCandidateRow(
    int SerialNumber,
    string Name,
    string Mobile,
    string? Qualification,
    string? Experience,
    string ScreeningResultLabel,
    string InterviewModeLabel,
    int? MeritRank);

public record RecruitmentCommitteeRow(
    int SerialNumber,
    string Name,
    string Department,
    string Position,
    string RoleLabel,
    bool IsExternal,
    bool HasSigned);

/// <summary>Offer letter fields, which legacy kept in its own snapshot table.</summary>
public record OfferLetterModel(
    string CandidateName,
    string Designation,
    string ProjectTitle,
    string Agency,
    string SanctionNo,
    string PiName,
    string PiDesignation,
    string PiDepartment,
    decimal FellowshipAmount,
    decimal HraAmount,
    DateOnly JoiningDate,
    DateOnly ValidTill,
    string? ParentName = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Pincode = null);
