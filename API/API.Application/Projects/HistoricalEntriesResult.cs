namespace API.Application.Projects;

public record HistoricalEntriesResult(
    IReadOnlyList<HistoricalExpenditureItem> Expenditures,
    IReadOnlyList<HistoricalGrantReceiptItem> GrantReceipts);

public record HistoricalExpenditureItem(
    Guid Id, Guid BudgetHeadId, string HeadName, decimal Amount,
    string Description, DateOnly TransactionDate, Guid RecordedByUserId, DateTimeOffset CreatedAt);

public record HistoricalGrantReceiptItem(
    Guid Id, Guid BudgetHeadId, string HeadName, decimal Amount,
    DateOnly ReceivedDate, string? Remarks, Guid RecordedByUserId, DateTimeOffset CreatedAt);
