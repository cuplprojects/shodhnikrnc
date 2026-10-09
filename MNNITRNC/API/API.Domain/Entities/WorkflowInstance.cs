using API.Domain.Enums;

namespace API.Domain.Entities;

public class WorkflowInstance
{
    public Guid Id { get; set; }
    public RequestType RequestType { get; set; }
    public Guid RequestId { get; set; }
    public WorkflowPhase Phase { get; set; }
    public WorkflowStage CurrentStage { get; set; }
    public Guid? AssignedToUserId { get; set; }

    /// <summary>
    /// True when <see cref="AssignedToUserId"/> was set by the permanent
    /// per-project Dealing Assistant auto-population (at raise time, or by a
    /// DA reassignment migrating open instances), rather than by a manual
    /// per-instance Assign/AssignAndForward action. Only DA-originated
    /// assignments narrow who may act at RegularStaff-listed stages.
    /// </summary>
    public bool IsAssignedViaProjectDa { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }

    /// <summary>
    /// Which stage issued the most recent Return, while the instance sits at a branch
    /// stage (e.g. ReturnedToPI) waiting on the requester. Null once the requester
    /// forwards back out -- read once by ForwardAsync to pick the correct rejoin point,
    /// then cleared.
    /// </summary>
    public WorkflowStage? ReturnedFromStage { get; set; }

    public ICollection<WorkflowStep> Steps { get; set; } = new List<WorkflowStep>();
}
