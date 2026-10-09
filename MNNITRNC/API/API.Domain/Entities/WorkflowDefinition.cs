using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// The approval route for one kind of request: which stages it passes through,
/// in what order, and who may act at each. One definition per
/// (<see cref="RequestType"/>, <see cref="WorkflowPhase"/>) pair.
/// </summary>
/// <remarks>
/// Before this existed the route was a static dictionary in
/// WorkflowEngineService and a set of [Authorize] attributes on
/// WorkflowController, so every request type necessarily shared one chain and
/// one set of approvers. Storing it makes the route data a SuperAdmin can edit.
///
/// Keyed on the pair rather than RequestType alone because a single request can
/// raise more than one instance: Travel raises an Indent workflow and, later, a
/// Bill workflow, and those should not be forced to share a route.
///
/// RequestType and WorkflowPhase persist as ints on WorkflowInstance and are
/// append-only. Reordering either enum would silently repoint every stored
/// definition and every live instance at the wrong route.
/// </remarks>
public class WorkflowDefinition
{
    public Guid Id { get; set; }
    public RequestType RequestType { get; set; }
    public WorkflowPhase Phase { get; set; }

    /// <summary>Human-readable name, shown in the SuperAdmin editor.</summary>
    public required string Name { get; set; }

    /// <summary>
    /// An inactive definition is retained but not used to route new instances.
    /// Deleting a definition that live instances are sitting on would strand
    /// them, so deactivating is the safe way to retire a route.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Where a returned instance re-enters the route, by <see cref="WorkflowStageDefinition.Sequence"/>.
    /// Null means restart at the initial stage.
    /// </summary>
    /// <remarks>
    /// BRD Prompt 0: "resubmission behavior is configurable per workflow
    /// definition" -- Prompt 1 gives the concrete case, a resubmitted proposal
    /// re-entering at the Dealing Assistant rather than back at the Dean. Every
    /// route shipped before Phase 9 leaves this null, which is exactly today's
    /// behaviour, so nothing already routing instances changes.
    /// </remarks>
    public int? ResubmitEntrySequence { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public ICollection<WorkflowStageDefinition> Stages { get; set; } = new List<WorkflowStageDefinition>();
}
