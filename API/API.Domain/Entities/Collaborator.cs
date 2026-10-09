namespace API.Domain.Entities;

public class Collaborator
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public bool IsInsideInstitute { get; set; }
    public required string Institute { get; set; }
    public required string Faculty { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }
}
