using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Workflow;

/// <summary>
/// Checks a proposed route before it is persisted.
/// </summary>
public interface IWorkflowDefinitionValidator
{
    /// <summary>
    /// Returns every problem with the proposed stages, empty when the route is
    /// valid. All rules are evaluated rather than stopping at the first, so an
    /// operator learns everything wrong in one round trip.
    /// </summary>
    Task<IReadOnlyList<string>> ValidateAsync(
        RequestType requestType,
        WorkflowPhase phase,
        IReadOnlyCollection<WorkflowStageDefinition> stages,
        int? resubmitEntrySequence = null,
        CancellationToken ct = default);
}
