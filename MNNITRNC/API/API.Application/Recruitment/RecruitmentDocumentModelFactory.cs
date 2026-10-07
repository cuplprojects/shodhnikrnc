using API.Application.Procurement;
using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Recruitment;

public static class RecruitmentDocumentModelFactory
{
    public static RecruitmentDocumentModel Build(
        RecruitmentRequest request,
        Project project,
        SanctionedManpowerPosition position,
        FacultyProfileInfo pi,
        Advertisement? currentAdvertisement,
        IReadOnlyList<Candidate> candidates,
        IReadOnlyList<CommitteeMember> committee,
        string? coPiName = null,
        IReadOnlyList<ResolvedAdvertisementSectionModel>? resolvedAdvertisementSections = null) =>
        new(
            project.ProjectTitle,
            project.Agency,
            project.SanctionNo,
            pi.Name,
            pi.Designation,
            pi.Department,
            position.Designation,
            position.Positions,
            position.Stipend,
            position.Hra,
            request.AdvertisementRound,
            currentAdvertisement?.PublishedOn,
            currentAdvertisement?.ClosingDate,
            currentAdvertisement?.Text,
            request.InterviewDate,
            request.InterviewTime,
            request.InterviewVenue,
            [
                .. candidates
                    .OrderBy(c => c.MeritRank ?? int.MaxValue)
                    .ThenBy(c => c.AppliedAt)
                    .Select((c, i) => new RecruitmentCandidateRow(
                        i + 1,
                        c.FullName,
                        c.Mobile,
                        c.Qualification,
                        c.Experience,
                        ScreeningLabel(c.ScreeningResult),
                        ModeLabel(c.InterviewMode),
                        c.MeritRank))
            ],
            CommitteeRows(committee, CommitteeKind.Screening),
            CommitteeRows(committee, CommitteeKind.Selection),
            coPiName,
            resolvedAdvertisementSections);

    public static OfferLetterModel BuildOffer(
        Candidate? candidate,
        Project project,
        SanctionedManpowerPosition position,
        FacultyProfileInfo pi,
        decimal fellowshipAmount,
        DateOnly joiningDate,
        DateOnly validTill,
        string? candidateNameOverride = null,
        string? parentName = null,
        string? address = null,
        string? city = null,
        string? state = null,
        string? pincode = null,
        decimal? hraAmountOverride = null) =>
        new(
            candidateNameOverride ?? candidate?.FullName ?? string.Empty,
            position.Designation,
            project.ProjectTitle,
            project.Agency,
            project.SanctionNo,
            pi.Name,
            pi.Designation,
            pi.Department,
            fellowshipAmount,
            hraAmountOverride ?? position.Hra,
            joiningDate,
            validTill,
            parentName,
            address,
            city,
            state,
            pincode);

    private static IReadOnlyList<RecruitmentCommitteeRow> CommitteeRows(
        IReadOnlyList<CommitteeMember> members, CommitteeKind kind) =>
    [
        .. members
            .Where(m => m.Kind == kind)
            .Select((m, i) => new RecruitmentCommitteeRow(
                i + 1, m.Name, m.Department, m.Position,
                RoleLabel(m.Role), m.IsExternal, HasSigned: false))
    ];

    private static string ScreeningLabel(ScreeningResult? result) => result switch
    {
        ScreeningResult.Eligible => "Eligible",
        ScreeningResult.Ineligible => "Not eligible",
        _ => "Not screened",
    };

    private static string ModeLabel(InterviewMode mode) => mode switch
    {
        InterviewMode.Online => "Online",
        _ => "Offline",
    };

    private static string RoleLabel(CommitteeRole role) => role switch
    {
        CommitteeRole.Chairman => "Chairman",
        CommitteeRole.PrincipalInvestigator => "Principal Investigator",
        CommitteeRole.CoPrincipalInvestigator => "Co-Principal Investigator",
        CommitteeRole.NominatedFaculty => "Nominated Faculty",
        CommitteeRole.InternalNominee => "Nominated Member (internal)",
        CommitteeRole.ExternalNominee => "Nominated Member (external)",
        _ => role.ToString(),
    };
}
