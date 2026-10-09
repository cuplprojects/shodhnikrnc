using System.ComponentModel.DataAnnotations;
using API.Domain.Enums;

namespace API.Contracts.Workflow;

/// <summary>A configured route, as the SuperAdmin editor lists and loads it.</summary>
public record WorkflowDefinitionResponse(
    Guid Id,
    RequestType RequestType,
    WorkflowPhase Phase,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<WorkflowStageResponse> Stages);

public record WorkflowStageResponse(
    int Sequence,
    WorkflowStage Stage,
    IReadOnlyList<string> AllowedRoles,
    bool IsInitial,
    bool IsTerminal,
    bool CanApprove,
    bool CanReject,
    bool CanReturn);

/// <summary>
/// A replacement stage list. The whole route is sent, not a delta.
/// </summary>
/// <remarks>
/// A route is only meaningful as a complete sequence -- per-stage edits invite
/// exactly the gaps and orphaned stages the validator exists to catch.
/// </remarks>
public record UpdateWorkflowDefinitionRequest
{
    [Required]
    public string Name { get; init; } = string.Empty;

    public bool IsActive { get; init; } = true;

    [Required]
    [MinLength(1, ErrorMessage = "A workflow definition must have at least one stage.")]
    public IReadOnlyList<UpdateWorkflowStageRequest> Stages { get; init; } = [];
}

public record UpdateWorkflowStageRequest
{
    public int Sequence { get; init; }
    public WorkflowStage Stage { get; init; }

    /// <summary>
    /// Empty means the stage is not role-restricted -- the initial stage belongs
    /// to whoever raised the request. It does not mean nobody may act.
    /// </summary>
    public IReadOnlyList<string> AllowedRoles { get; init; } = [];

    public bool IsInitial { get; init; }
    public bool IsTerminal { get; init; }
    public bool CanApprove { get; init; }
    public bool CanReject { get; init; }
    public bool CanReturn { get; init; }
}

/// <summary>
/// Validation failures for a proposed route. Every problem is listed, not just
/// the first, so an operator can fix them in one pass.
/// </summary>
public record WorkflowValidationResponse(bool IsValid, IReadOnlyList<string> Errors);
