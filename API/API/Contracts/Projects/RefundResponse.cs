namespace API.Contracts.Projects;

public record RefundResponse(
    Guid Id, Guid ProjectId, decimal Amount, DateOnly RefundDate, string Reason,
    Guid RecordedByUserId, DateTimeOffset CreatedAt);
