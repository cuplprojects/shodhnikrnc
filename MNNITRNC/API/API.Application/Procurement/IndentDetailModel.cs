using API.Domain.Enums;

namespace API.Application.Procurement;

public record IndentBudgetAllocationModel(
    Guid BudgetHeadId,
    string BudgetHeadName,
    OverheadSubHead? SubHead,
    decimal Amount,
    int OrderIndex);

public record IndentDetailModel(
    Guid Id,
    string IndentNumber,
    Guid ProjectId,
    Guid WorkflowInstanceId,
    IndentType IndentType,
    string Purpose,
    decimal TotalEstimatedCost,
    IReadOnlyList<IndentBudgetAllocationModel> Allocations,
    DateTimeOffset CreatedAt);
