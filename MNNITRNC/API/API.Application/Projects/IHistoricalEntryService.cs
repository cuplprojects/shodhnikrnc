using API.Domain.Entities;

namespace API.Application.Projects;

/// <summary>
/// Direct, un-workflowed entry of a pre-existing project's historical
/// expenditure and grant-receipt figures -- RnC office staff only
/// (enforced at the controller, per PageCatalogue.Office), not the PI,
/// mirroring IRefundService's own reasoning: this is the office backfilling
/// history on the PI's behalf, not a self-service action.
/// </summary>
public interface IHistoricalEntryService
{
    Task<HistoricalExpenditure> RecordExpenditureAsync(
        Guid projectId, Guid recordedByUserId, Guid budgetHeadId,
        decimal amount, string description, DateOnly transactionDate,
        CancellationToken ct = default);

    Task DeleteExpenditureAsync(Guid id, Guid deletedByUserId, CancellationToken ct = default);

    Task<HistoricalGrantReceipt> RecordGrantReceiptAsync(
        Guid projectId, Guid recordedByUserId, Guid budgetHeadId,
        decimal amount, DateOnly receivedDate, string? remarks,
        CancellationToken ct = default);

    Task DeleteGrantReceiptAsync(Guid id, Guid deletedByUserId, CancellationToken ct = default);

    Task<HistoricalEntriesResult> ListForProjectAsync(Guid projectId, CancellationToken ct = default);
}
