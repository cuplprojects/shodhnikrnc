namespace API.Contracts.Projects;

public record ProjectDaAssignmentLogResponse(
    Guid Id,
    Guid? FromUserId,
    string? FromUserName,
    Guid ToUserId,
    string ToUserName,
    string Reason,
    Guid PerformedByUserId,
    DateTimeOffset CreatedAt);
