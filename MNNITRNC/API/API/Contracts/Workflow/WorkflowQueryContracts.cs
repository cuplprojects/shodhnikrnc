namespace API.Contracts.Workflow;

public record AskQueryRequest(Guid AskedOfUserId, string Question);
public record AnswerQueryRequest(string Answer);

public record WorkflowQueryResponse(
    Guid Id,
    Guid AskedByUserId,
    Guid AskedOfUserId,
    string Question,
    DateTimeOffset AskedAt,
    string? Answer,
    DateTimeOffset? AnsweredAt);
