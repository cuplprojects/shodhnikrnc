using System.ComponentModel.DataAnnotations;
using API.Application.Recruitment;
using API.Domain.Enums;

namespace API.Contracts.Recruitment;

public record CreateRecruitmentRequestBody(Guid SanctionedManpowerPositionId);

/// <summary>
/// <paramref name="AdvertisementTemplateId"/> and
/// <paramref name="FreeTextTokenValues"/> are optional; omitted, the request
/// behaves exactly as it did before advertisement templates existed and
/// <paramref name="Text"/> is stored verbatim.
/// </summary>
public record AdvertiseRequestBody(
    DateOnly PublishedOn,
    DateOnly ClosingDate,
    string Text,
    [Required] string Remarks,
    Guid? AdvertisementTemplateId = null,
    Dictionary<string, string>? FreeTextTokenValues = null,
    string? RequiredQualifications = null,
    bool AllowDiplomaFor12th = true,
    bool RequireExperience = false,
    int MinExperienceMonths = 0,
    bool RequirePublications = false,
    bool RequireResume = true);

public record ReadvertiseRequestBody(
    int CandidateCountAtClose,
    DateOnly PublishedOn,
    DateOnly ClosingDate,
    string Text,
    Guid? AdvertisementTemplateId = null,
    Dictionary<string, string>? FreeTextTokenValues = null,
    string? RequiredQualifications = null,
    bool AllowDiplomaFor12th = true,
    bool RequireExperience = false,
    int MinExperienceMonths = 0,
    bool RequirePublications = false,
    bool RequireResume = true);

public record SaveAdvertisementDraftRequestBody(
    string Text,
    DateOnly? ClosingDate = null,
    string? RequiredQualifications = null,
    bool? AllowDiplomaFor12th = null,
    bool? RequireExperience = null,
    int? MinExperienceMonths = null,
    bool? RequirePublications = null,
    bool? RequireResume = null);

/// <summary>
/// <paramref name="PrefillFromCandidateId"/> must reference one of the caller's
/// own earlier applications; the service rejects anything else.
/// </summary>
public record ApplyRequestBody(
    string FullName,
    string Mobile,
    string? Qualification,
    string? Experience,
    Guid? PrefillFromCandidateId);

public record CommitteeMemberBody(
    CommitteeRole Role, string Name, string Department, string Position, bool IsExternal,
    Guid? ApplicationUserId = null, string? Email = null,
    bool IsOutsideInstitute = false, Guid? ConsentDocumentId = null);

public record SubmitCommitteeRequestBody(IReadOnlyList<CommitteeMemberBody> Members);

public record SubmitScreeningCommitteeForApprovalRequestBody();

public record AssignScreeningCommitteeMemberRequestBody(CommitteeMemberInput Nominee);

public record SubmitSelectionCommitteeForApprovalRequestBody(
    CommitteeMemberInput? OptionalMember,
    IReadOnlyList<CommitteeMemberInput> RecommendedMembers);

public record SelectSelectionCommitteeMemberRequestBody(Guid SelectedCommitteeMemberId);

public record ReturnSelectionCommitteeRequestBody([Required] string Remarks);

public record RecordScreeningRequestBody(Guid CandidateId, ScreeningResult Result, string? Remarks = null);

public record SetAvailabilityRequestBody(DateOnly AvailabilityDate);

public record ScheduleInterviewRequestBody(DateOnly InterviewDate, TimeOnly InterviewTime, string InterviewVenue);

/// <summary>
/// <paramref name="DeanApprovalUserId"/> is required for Online mode -- the BRD
/// permits an online interview only with prior Dean approval.
/// </summary>
public record SetInterviewModeRequestBody(
    Guid CandidateId, InterviewMode Mode, Guid? DeanApprovalUserId);

public record MeritRankBody(Guid CandidateId, int Rank);

public record SubmitMeritListRequestBody(IReadOnlyList<MeritRankBody> Ranks);

public record IssueOfferRequestBody(
    Guid CandidateId, decimal RecommendedStipend, DateOnly JoiningDate);

public record RecordJoiningRequestBody(
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

public record IssueIdCardRequestBody(string IdCardNumber);

/// <summary>
/// Shared body shape for the advertisement approval chain's four actions
/// (forward/approve/reject/return). Equivalent to Proposals'
/// <c>ProposalActionRequestBody</c>, kept as a separate recruitment-namespaced
/// record rather than a cross-module reference: the two modules' controllers
/// don't otherwise share contract types, and a proposals-only namespace isn't
/// meant to be a dependency of the recruitment module.
/// </summary>
public record RemarksRequestBody(string? Remarks);
