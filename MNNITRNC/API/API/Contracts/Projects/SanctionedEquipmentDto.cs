namespace API.Contracts.Projects;

public record SanctionedEquipmentDto(Guid? Id, string Name, string Unit, decimal Amount, string? Status = null);
