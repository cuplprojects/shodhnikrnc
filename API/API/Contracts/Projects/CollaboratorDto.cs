namespace API.Contracts.Projects;

public record CollaboratorDto(Guid? Id, string Institute, string Faculty, bool IsInsideInstitute = false, string? Department = null, string? Designation = null);
