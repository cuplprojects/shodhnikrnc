namespace API.Contracts.Notifications;

public record EmailLogResponse(
    Guid Id, string TemplateKey, string ToAddress, string Subject,
    bool Succeeded, string? ErrorMessage, DateTimeOffset SentAt,
    string RelatedEntityType, Guid RelatedEntityId);
