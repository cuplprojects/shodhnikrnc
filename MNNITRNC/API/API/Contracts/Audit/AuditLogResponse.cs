namespace API.Contracts.Audit;

public record AuditLogResponse(
    Guid Id, string EntityType, Guid EntityId, string Action, Guid ActorUserId,
    DateTimeOffset Timestamp, string? Detail);
