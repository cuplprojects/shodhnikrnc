using API.Domain.Enums;

namespace API.Contracts.Projects;

/// <summary>
/// <paramref name="OwnerUserId"/> is null for the ordinary case -- the
/// caller creating their own project -- and only ever set when an office
/// user is entering a legacy/offline-sanctioned project on a PI's behalf
/// (this form is otherwise restricted to the office roles; see
/// PageCatalogue's projects.new entry). Defaulting to the caller keeps a
/// direct PI submission working unchanged.
/// </summary>
public record CreateProjectRequest(
    ProjectType ProjectType, string SanctionNo, DateOnly SanctionDate, string ProjectTitle,
    DateOnly StartDate, string Agency, int DurationMonths, decimal TotalSanctioned,
    IReadOnlyList<CollaboratorDto> Collaborators, IReadOnlyList<BudgetHeadDto> BudgetHeads,
    IReadOnlyList<SanctionedEquipmentDto> SanctionedEquipment,
    IReadOnlyList<SanctionedManpowerPositionDto> SanctionedManpowerPositions,
    Guid? OwnerUserId = null, decimal? OverheadPercent = null);
