using API.Domain.Enums;

namespace API.Contracts.Projects;

public record UpdateProjectRequest(
    ProjectType ProjectType, string SanctionNo, DateOnly SanctionDate, string ProjectTitle,
    DateOnly StartDate, string Agency, int DurationMonths, decimal TotalSanctioned,
    IReadOnlyList<CollaboratorDto> Collaborators, IReadOnlyList<BudgetHeadDto> BudgetHeads,
    IReadOnlyList<SanctionedEquipmentDto> SanctionedEquipment,
    IReadOnlyList<SanctionedManpowerPositionDto> SanctionedManpowerPositions,
    decimal? OverheadPercent = null);
