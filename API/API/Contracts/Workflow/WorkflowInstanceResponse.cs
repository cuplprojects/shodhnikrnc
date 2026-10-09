using API.Domain.Enums;

namespace API.Contracts.Workflow;

public record WorkflowInstanceResponse(
    Guid Id,
    RequestType RequestType,
    Guid RequestId,
    WorkflowPhase Phase,
    WorkflowStage CurrentStage,
    Guid? AssignedToUserId,
    IReadOnlyList<WorkflowStepResponse> Steps);

public record WorkflowStepResponse(
    WorkflowStage Stage,
    WorkflowAction Action,
    Guid ActorUserId,
    string? ActorName,
    string? ActorEmployeeId,
    string? Remarks,
    DateTimeOffset Timestamp,
    string StepName,
    int SequenceOrder);
