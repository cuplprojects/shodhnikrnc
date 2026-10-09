using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A configured expectation that a request of a given type and phase should have a
/// document of a given kind. Satisfaction is computed by joining against Document rows;
/// it is not stored here. Advisory only — nothing gates a workflow transition on this.
/// </summary>
public class DocumentChecklistItem
{
    public Guid Id { get; set; }
    public RequestType RequestType { get; set; }
    public WorkflowPhase Phase { get; set; }
    public DocumentKind DocumentKind { get; set; }
    public required string Name { get; set; }
    public bool IsMandatory { get; set; }
    public int DisplayOrder { get; set; }
}
