namespace API.Contracts.Projects;

public record RecordRefundRequest(decimal Amount, DateOnly RefundDate, string Reason);
