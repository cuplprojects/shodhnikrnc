using API.Application.Documents;
using API.Domain.Enums;

namespace API.Contracts.Procurement;

public record IndentListItemResponse(
    Guid Id,
    string Name,
    decimal EstimatedCost,
    GemAvailability GemAvailability,
    ProcurementTier Tier,
    WorkflowStage CurrentStage,
    DateTimeOffset CreatedAt,
    Guid WorkflowInstanceId);
