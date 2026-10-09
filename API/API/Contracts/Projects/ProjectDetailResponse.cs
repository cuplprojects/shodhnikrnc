using API.Domain.Enums;

namespace API.Contracts.Projects;

public record ProjectDetailResponse(
    Guid Id, ProjectType ProjectType, string SanctionNo, DateOnly SanctionDate, string ProjectTitle,
    DateOnly StartDate, string Agency, int DurationMonths, decimal TotalSanctioned,
    IReadOnlyList<CollaboratorDto> Collaborators, IReadOnlyList<BudgetHeadDto> BudgetHeads,
    IReadOnlyList<SanctionedEquipmentDto> SanctionedEquipment,
    IReadOnlyList<SanctionedManpowerPositionDto> SanctionedManpowerPositions,
    DateOnly? SubmittedToAgencyOn = null, decimal? OverheadPercent = null, decimal TotalAmount = 0m,
    Guid? PiUserId = null, string? PiName = null, string? PiUsername = null,
    ProjectStatus Status = ProjectStatus.Active, Guid? WorkflowInstanceId = null);
