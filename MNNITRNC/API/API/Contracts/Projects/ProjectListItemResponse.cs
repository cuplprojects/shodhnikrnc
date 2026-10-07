using API.Domain.Enums;

namespace API.Contracts.Projects;

public record ProjectListItemResponse(
    Guid Id, ProjectType ProjectType, string SanctionNo, string ProjectTitle, string Agency,
    decimal TotalSanctioned, DateOnly StartDate, int DurationMonths, Guid OwnerUserId,
    ProjectStatus Status = ProjectStatus.Active, Guid? WorkflowInstanceId = null);
