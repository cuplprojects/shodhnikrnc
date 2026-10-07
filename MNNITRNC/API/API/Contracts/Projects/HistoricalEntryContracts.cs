namespace API.Contracts.Projects;

public record RecordHistoricalExpenditureRequest(
    Guid BudgetHeadId, decimal Amount, string Description, DateOnly TransactionDate);

public record RecordHistoricalGrantReceiptRequest(
    Guid BudgetHeadId, decimal Amount, DateOnly ReceivedDate, string? Remarks);

public record HistoricalExpenditureResponse(
    Guid Id, Guid ProjectId, Guid BudgetHeadId, string HeadName, decimal Amount,
    string Description, DateOnly TransactionDate, Guid RecordedByUserId, DateTimeOffset CreatedAt);

public record HistoricalGrantReceiptResponse(
    Guid Id, Guid ProjectId, Guid BudgetHeadId, string HeadName, decimal Amount,
    DateOnly ReceivedDate, string? Remarks, Guid RecordedByUserId, DateTimeOffset CreatedAt);

public record HistoricalEntriesResponse(
    IReadOnlyList<HistoricalExpenditureResponse> Expenditures,
    IReadOnlyList<HistoricalGrantReceiptResponse> GrantReceipts);

public record HistoricalEntryProjectItem(
    Guid ProjectId, string ProjectTitle, string SanctionNo,
    Guid DepartmentId, string DepartmentName,
    Guid OwnerUserId, string OwnerName);
