using API.Domain.Enums;

namespace API.Domain.Entities;

public class WorkflowStep
{
    public Guid Id { get; set; }
    public Guid WorkflowInstanceId { get; set; }
    public WorkflowStage Stage { get; set; }
    public WorkflowAction Action { get; set; }
    public Guid ActorUserId { get; set; }
    public string? Remarks { get; set; }

    /// <summary>
    /// False for Reject/Return (visible to the requester and their HOD --
    /// these actions directly concern them); true for every other action
    /// (internal office communication, e.g. Forward/Assign remarks).
    /// </summary>
    public bool IsInternal { get; set; }

    /// <summary>
    /// True once this step's own actor has undone it. The row is never
    /// deleted -- a reversed decision is itself meaningful history in an
    /// approval system, not something to silently erase.
    /// </summary>
    public bool IsUndone { get; set; }
    public DateTimeOffset? UndoneAt { get; set; }

    public DateTimeOffset Timestamp { get; set; }
}
