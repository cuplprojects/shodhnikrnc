using API.Domain.Enums;

namespace API.Application.Workflow;

/// <summary>
/// Answers "which workflow instances currently sit at a stage this caller's
/// roles may act on" for one (RequestType, Phase) pair. Knows nothing about
/// any specific domain (proposals, indents, ...) -- every request type's own
/// service layers department/ownership scoping on top of this.
/// </summary>
public interface IWorkflowPendingQueryService
{
    /// <summary>
    /// Every WorkflowInstance for <paramref name="requestType"/>/<paramref name="phase"/>
    /// whose current stage's AllowedRoles intersects <paramref name="callerRoles"/>
    /// (case-insensitive). A stage with an empty AllowedRoles list never
    /// matches -- unlike WorkflowEngineService.RequireRoleAsync, which treats
    /// "no roles configured" as "anyone may act," this method must not
    /// surface every untouched initial-stage instance to every caller.
    ///
    /// At a RegularStaff-listed stage, an instance whose AssignedToUserId came
    /// from the project's permanent Dealing Assistant
    /// (IsAssignedViaProjectDa) is only returned when
    /// <paramref name="callerUserId"/> is that assignee, or the caller holds
    /// Superintendent/DeputyRegistrar/Dean -- the same rule
    /// WorkflowEngineService.RequireRoleAsync enforces on action. A null
    /// <paramref name="callerUserId"/> fails closed for such instances.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, WorkflowStage>> ListPendingInstancesAsync(
        RequestType requestType,
        WorkflowPhase phase,
        IReadOnlyCollection<string> callerRoles,
        Guid? callerUserId = null,
        CancellationToken ct = default);
}
