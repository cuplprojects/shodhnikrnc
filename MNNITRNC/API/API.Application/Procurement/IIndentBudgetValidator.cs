namespace API.Application.Procurement;

public interface IIndentBudgetValidator
{
    Task<IndentBudgetSnapshot> GetSnapshotAsync(
        Guid budgetHeadId, DateOnly asOfDate, CancellationToken ct = default,
        Guid? excludeWorkflowInstanceId = null, API.Domain.Enums.OverheadSubHead? subHead = null);

    Task EnsureSufficientAsync(
        Guid budgetHeadId, DateOnly asOfDate, decimal requestedAmount,
        CancellationToken ct = default, API.Domain.Enums.OverheadSubHead? subHead = null);
}
