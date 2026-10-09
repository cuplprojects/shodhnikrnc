using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Workflow;

/// <summary>
/// Drives workflow instances along the route stored in
/// <see cref="WorkflowDefinition"/>.
/// </summary>
/// <remarks>
/// Every transition takes the actor's roles. From Task 7 the engine checks them
/// against the current stage's AllowedRoles, which is what makes the stored
/// route actually govern who may act -- while the check lived in [Authorize]
/// attributes, editing a stage's roles changed nothing at runtime.
///
/// Centralising it also closes a hole the attributes left: a service calling the
/// engine directly never passed through the controller, so it was never role
/// checked at all.
///
/// RaiseAsync and GetAsync take no roles. Raising is gated by the caller's own
/// domain rules (a fellow raises their own claim, a PI their own indent) rather
/// than by a stage, and reading is not a transition.
/// </remarks>
public interface IWorkflowEngineService
{
    Task<WorkflowInstance> RaiseAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, Guid actorUserId, CancellationToken ct = default);
    Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId, CancellationToken ct = default);
    Task<WorkflowInstance?> GetByRequestAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, CancellationToken ct = default);
    Task UploadSignedCopyAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task AssignAsync(Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Assigns a specific person and advances to the next stage by sequence, in
    /// one step -- the research proposal chain's equivalent of
    /// <see cref="AssignAsync"/>, usable from wherever the instance currently
    /// sits rather than <see cref="AssignAsync"/>'s hardcoded SignedCopyUploaded
    /// requirement. Once set, only the assignee (plus any role a stage lists
    /// beyond the one the assignment narrowed -- see RequireRoleAsync) may act
    /// at the stage this advances to.
    /// </summary>
    Task AssignAndForwardAsync(Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ForwardAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ApproveAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task RejectAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Sends an instance back for correction rather than concluding it. Re-enters
    /// at <see cref="WorkflowDefinition.ResubmitEntrySequence"/>, or the initial
    /// stage when the route leaves it unset -- which is every route shipped
    /// before this action existed.
    /// </summary>
    /// <remarks>
    /// Permitted from the same stages as <see cref="RejectAsync"/>
    /// (<c>CanReject</c>): the BRD names the same roles for returning a proposal
    /// for correction as for rejecting it outright, so both are decisions made
    /// from a stage that can conclude negatively, not two separate capabilities.
    /// </remarks>
    Task ReturnAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ForwardToDirectorAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task CancelAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Asks a specific person a clarifying question about this instance,
    /// without moving CurrentStage -- a conversation alongside the chain, not
    /// a transition. The target must already appear as an ActorUserId in this
    /// instance's own Steps history.
    /// </summary>
    Task<WorkflowQuery> AskQueryAsync(Guid workflowInstanceId, Guid askedByUserId, Guid askedOfUserId, string question, CancellationToken ct = default);

    /// <summary>Only the original AskedOfUserId may answer; one answer closes the thread.</summary>
    Task AnswerQueryAsync(Guid queryId, Guid actorUserId, string answer, CancellationToken ct = default);

    Task<IReadOnlyList<WorkflowQuery>> ListQueriesAsync(Guid workflowInstanceId, CancellationToken ct = default);

    /// <summary>
    /// Undoes the actor's own most recent step on this instance, reverting
    /// CurrentStage to what it was before that step -- only permitted if no
    /// step exists after it (nothing downstream has happened since). Does
    /// NOT handle the Sanction case (RecordSanctionAsync never calls
    /// AppendStep, so it has no WorkflowStep to undo here) -- see
    /// IResearchProposalService.UndoLastActionAsync for that.
    /// </summary>
    Task UndoLastActionAsync(Guid workflowInstanceId, Guid actorUserId, CancellationToken ct = default);
}
