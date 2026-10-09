using API.Domain.Enums;

namespace API.Domain.Entities;

public class ReappropriationRequest
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string Reason { get; set; }
    public ReappropriationRequestStatus Status { get; set; }
    public Guid? WorkflowInstanceId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Project? Project { get; set; }

    public ICollection<ReappropriationSourceLine> SourceLines { get; set; } = new List<ReappropriationSourceLine>();
    public ICollection<ReappropriationDestinationLine> DestinationLines { get; set; } = new List<ReappropriationDestinationLine>();
}
