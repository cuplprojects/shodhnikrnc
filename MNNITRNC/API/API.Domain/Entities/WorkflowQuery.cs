namespace API.Domain.Entities;

/// <summary>
/// A lightweight, parallel-to-the-chain question/answer exchange between two
/// people who have both acted on the same WorkflowInstance -- never a
/// WorkflowStep, because it never changes CurrentStage. Always internal
/// (mirrors WorkflowStep.IsInternal's default): visible to office/RnC roles
/// and the two participants, never surfaced to the PI or their HOD's
/// filtered view (see WorkflowController.Get's existing IsInternal filter).
/// </summary>
public class WorkflowQuery
{
    public Guid Id { get; set; }
    public Guid WorkflowInstanceId { get; set; }
    public Guid AskedByUserId { get; set; }
    public Guid AskedOfUserId { get; set; }
    public required string Question { get; set; }
    public DateTimeOffset AskedAt { get; set; }
    public string? Answer { get; set; }
    public DateTimeOffset? AnsweredAt { get; set; }
}
