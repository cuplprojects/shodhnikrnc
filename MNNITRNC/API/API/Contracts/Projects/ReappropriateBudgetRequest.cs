using System.ComponentModel.DataAnnotations;

using API.Application.Projects;

namespace API.Contracts.Projects;

public record RaiseReappropriationRequest(
    [Required] string Reason,
    [Required, MinLength(1)] IReadOnlyList<ReappropriationLineInput> Sources,
    [Required, MinLength(1)] IReadOnlyList<ReappropriationLineInput> Destinations,
    string? Remarks = null);

public record BudgetReappropriationLogResponse(
    Guid Id,
    Guid ProjectId,
    Guid? FromHeadId,
    string FromHeadName,
    Guid? ToHeadId,
    string ToHeadName,
    decimal Amount,
    string Reason,
    Guid PerformedByUserId,
    DateTimeOffset CreatedAt);

public record ReappropriationLineResponse(
    Guid Id,
    Guid BudgetHeadId,
    string HeadName,
    decimal Amount);

public record ReappropriationRequestResponse(
    Guid Id,
    Guid ProjectId,
    string Reason,
    string Status,
    Guid? WorkflowInstanceId,
    string? CurrentStage,
    Guid RequestedByUserId,
    DateTimeOffset CreatedAt,
    IReadOnlyList<ReappropriationLineResponse> Sources,
    IReadOnlyList<ReappropriationLineResponse> Destinations);

public record ReappropriationActionRequestBody(string? Remarks);
