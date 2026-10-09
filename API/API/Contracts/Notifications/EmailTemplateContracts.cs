using System.ComponentModel.DataAnnotations;

namespace API.Contracts.Notifications;

public record EmailTemplateResponse(
    Guid Id, string Key, string Name, string Subject, string HtmlBody,
    bool IsSystemDefault, DateTimeOffset UpdatedAt, string[] Placeholders);

public record UpdateEmailTemplateRequest(
    [Required] string Subject,
    [Required] string HtmlBody);
