namespace API.Contracts.Projects;

public record SanctionedManpowerPositionDto(Guid? Id, string Designation, int Positions, decimal Stipend, decimal Hra, string? Status = null);
