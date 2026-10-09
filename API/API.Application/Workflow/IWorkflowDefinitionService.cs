using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Workflow;

/// <summary>
/// Reads the stored approval route. The engine consults this instead of the
/// static chain it used to carry.
/// </summary>
public interface IWorkflowDefinitionService
{
    /// <summary>The active route for a request type and phase.</summary>
    /// <exception cref="WorkflowConfigurationException">
    /// No active definition exists for the pair.
    /// </exception>
    Task<WorkflowDefinition> GetAsync(RequestType requestType, WorkflowPhase phase, CancellationToken ct = default);

    /// <summary>The row describing one stage of that route.</summary>
    /// <exception cref="WorkflowConfigurationException">
    /// The route has no row for that stage -- which strands any instance sitting
    /// on it, so it is reported rather than treated as "nothing to do".
    /// </exception>
    Task<WorkflowStageDefinition> GetStageAsync(
        RequestType requestType, WorkflowPhase phase, WorkflowStage stage, CancellationToken ct = default);

    /// <summary>
    /// The row after <paramref name="stage"/> by sequence, or null when the
    /// route ends there.
    /// </summary>
    Task<WorkflowStageDefinition?> GetNextStageAsync(
        RequestType requestType, WorkflowPhase phase, WorkflowStage stage, CancellationToken ct = default);
}
